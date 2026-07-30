/**
 * mealBuilder.js — "plate mode": build a meal off a kitchen scale without
 * re-zeroing between items. See PROJECT BIBLE §3.8 for the full spec.
 *
 * Core rule, applied on every confirmed item:
 *   - previousTotal = the scale's last known displayed reading (starts at 0)
 *   - reading       = what the person just typed in
 *   - autoZeroed    = reading < previousTotal   (display can't drop unless it was reset)
 *   - zeroed        = the person's toggle overrides autoZeroed if they touch it
 *   - itemWeight    = zeroed ? reading : (reading - previousTotal)
 *   - previousTotal becomes `reading` either way, since that's what the scale
 *     shows right now regardless of whether it was just zeroed.
 */

let plateSession = null; // { items: [], runningTotal: number }
let plateSelectedFood = null;

function resetPlateSession() {
  plateSession = { items: [], runningTotal: 0 };
  plateSelectedFood = null;
  document.getElementById('plate-food-search').value = '';
  document.getElementById('plate-reading').value = '';
  document.getElementById('plate-zeroed-toggle').checked = false;
  document.getElementById('plate-zeroed-toggle').dataset.userTouched = 'false';
  document.getElementById('plate-item-error').hidden = true;
  document.getElementById('plate-item-preview').textContent = '—';
  document.getElementById('build-meal-label').value = '';
  renderPlateItems();
}

/** The core math described above, as a pure function so it's easy to reason about. */
function computePlateItemWeight(reading, previousTotal, userForcedZeroed) {
  const autoZeroed = reading < previousTotal;
  const zeroed = userForcedZeroed === null ? autoZeroed : userForcedZeroed;
  const weight = zeroed ? reading : reading - previousTotal;
  return { weight, autoZeroed, zeroed };
}

async function populatePlateFoodDatalist() {
  const items = await PlateDB.getAllFoodItems();
  const datalist = document.getElementById('plate-food-list');
  // Map name -> most-recently-updated item, so the datalist stays simple
  // (typed name -> single food) even if names collide; last-updated wins.
  const byName = {};
  items
    .sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''))
    .forEach((i) => { byName[i.name] = i; });
  window._plateFoodByName = byName;
  datalist.innerHTML = items.map((i) => `<option value="${escapeHtml(i.name)}"></option>`).join('');
}

function updatePlateItemPreview() {
  const errorEl = document.getElementById('plate-item-error');
  const previewEl = document.getElementById('plate-item-preview');
  errorEl.hidden = true;

  const name = document.getElementById('plate-food-search').value.trim();
  const food = (window._plateFoodByName || {})[name];
  plateSelectedFood = food || null;

  const readingInput = document.getElementById('plate-reading');
  const reading = parseFloat(readingInput.value);

  if (!food) {
    previewEl.textContent = name ? 'Pick a food from your library (type to search).' : '—';
    return { valid: false };
  }
  if (!Number.isFinite(reading) || reading < 0) {
    previewEl.textContent = `${food.name} — enter the scale reading`;
    return { valid: false };
  }

  const toggle = document.getElementById('plate-zeroed-toggle');
  const userForcedZeroed = toggle.dataset.userTouched === 'true' ? toggle.checked : null;
  const { weight, autoZeroed, zeroed } = computePlateItemWeight(reading, plateSession.runningTotal, userForcedZeroed);

  if (userForcedZeroed === null) {
    toggle.checked = autoZeroed; // reflect the auto-guess until the user overrides it
  }

  if (weight <= 0) {
    previewEl.textContent = "That reading doesn't work out to a positive weight — check the toggle above.";
    return { valid: false };
  }

  const kcal = Math.round((food.calories_per_100 || 0) * (weight / 100));
  previewEl.textContent = `${food.name} — ${round(weight)}g · ${kcal} kcal${zeroed ? ' (scale was zeroed)' : ''}`;
  return { valid: true, food, weight, kcal };
}

function plateItemRowHtml(item, index) {
  return `
    <div class="log-item">
      <div>
        <div class="name">${escapeHtml(item.name)}${item.zeroed ? '<span class="zeroed-chip">zeroed</span>' : ''}</div>
        <div class="detail">${round(item.weight)}g</div>
      </div>
      <div class="log-item-actions">
        <div class="kcal">${Math.round(item.calories)}</div>
        <button type="button" class="row-icon-btn" data-remove-index="${index}" aria-label="Remove from plate">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>`;
}

function renderPlateItems() {
  const listEl = document.getElementById('plate-items-list');
  const totalsEl = document.getElementById('plate-totals');
  const finishBtn = document.getElementById('finish-meal-btn');

  if (!plateSession.items.length) {
    listEl.innerHTML = '<p class="empty-state">Nothing added yet.</p>';
    totalsEl.hidden = true;
    finishBtn.disabled = true;
    return;
  }

  listEl.innerHTML = plateSession.items.map(plateItemRowHtml).join('');
  const totalKcal = plateSession.items.reduce((sum, i) => sum + i.calories, 0);
  document.getElementById('plate-total-kcal').textContent = `${Math.round(totalKcal)} kcal`;
  totalsEl.hidden = false;
  finishBtn.disabled = false;
}

function handlePlateConfirmItem() {
  const result = updatePlateItemPreview();
  if (!result.valid) {
    document.getElementById('plate-item-error').textContent = 'Pick a valid food and a scale reading before adding it to the plate.';
    document.getElementById('plate-item-error').hidden = false;
    return;
  }

  const toggle = document.getElementById('plate-zeroed-toggle');
  const reading = parseFloat(document.getElementById('plate-reading').value);
  const userForcedZeroed = toggle.dataset.userTouched === 'true' ? toggle.checked : null;
  const { weight, zeroed } = computePlateItemWeight(reading, plateSession.runningTotal, userForcedZeroed);
  const scale = weight / 100;
  const food = result.food;

  plateSession.items.push({
    food_item_id: food.id,
    name: food.name,
    weight,
    zeroed,
    calories: (food.calories_per_100 || 0) * scale,
    protein_g: (food.protein_per_100 || 0) * scale,
    carbs_g: (food.carbs_per_100 || 0) * scale,
    fat_g: (food.fat_per_100 || 0) * scale,
    fiber_g: (food.fiber_per_100 || 0) * scale,
    sugar_g: (food.sugar_per_100 || 0) * scale,
    sodium_mg: (food.sodium_mg_per_100 || 0) * scale,
  });

  // The scale's current display is exactly the reading just entered,
  // regardless of whether this item was zeroed first — see header comment.
  plateSession.runningTotal = reading;

  // Reset the entry sub-form for the next item, but keep the running total.
  document.getElementById('plate-food-search').value = '';
  document.getElementById('plate-reading').value = '';
  toggle.checked = false;
  toggle.dataset.userTouched = 'false';
  document.getElementById('plate-item-preview').textContent = '—';
  document.getElementById('plate-item-error').hidden = true;
  plateSelectedFood = null;

  renderPlateItems();
}

function handlePlateRemoveItem(index) {
  plateSession.items.splice(index, 1);
  // Recompute the running total from scratch as the sum of confirmed weights,
  // since removing a mid-session item makes the literal "last reading" stale.
  plateSession.runningTotal = plateSession.items.reduce((sum, i) => sum + i.weight, 0);
  renderPlateItems();
}

async function handleFinishMeal() {
  if (!plateSession.items.length) return;
  const mealLabel = document.getElementById('build-meal-label').value || undefined;
  const groupId = PlateDB.uid();
  const date = todayDateStr();
  const now = new Date().toISOString();

  for (const item of plateSession.items) {
    await PlateDB.saveLogEntry({
      date,
      food_item_id: item.food_item_id,
      name: item.name,
      quantity: item.weight,
      unit: 'g',
      meal_label: mealLabel,
      meal_group_id: groupId,
      serving_display: `${round(item.weight)}g`,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fiber_g: item.fiber_g,
      sugar_g: item.sugar_g,
      sodium_mg: item.sodium_mg,
      logged_at: now,
    });
    await PlateDB.markFoodUsed(item.food_item_id);
  }

  resetPlateSession();
  showView('today');
}

function handleCancelMeal() {
  if (plateSession && plateSession.items.length && !confirm('Discard everything on the plate?')) return;
  resetPlateSession();
  showView('today');
}

function wireMealBuilder() {
  document.getElementById('plate-food-search').addEventListener('input', updatePlateItemPreview);
  document.getElementById('plate-reading').addEventListener('input', updatePlateItemPreview);
  document.getElementById('plate-zeroed-toggle').addEventListener('change', (evt) => {
    evt.target.dataset.userTouched = 'true';
    updatePlateItemPreview();
  });
  document.getElementById('plate-confirm-item-btn').addEventListener('click', handlePlateConfirmItem);
  document.getElementById('finish-meal-btn').addEventListener('click', handleFinishMeal);
  document.getElementById('cancel-meal-btn').addEventListener('click', handleCancelMeal);

  document.getElementById('plate-items-list').addEventListener('click', (evt) => {
    const btn = evt.target.closest('[data-remove-index]');
    if (!btn) return;
    handlePlateRemoveItem(parseInt(btn.dataset.removeIndex, 10));
  });
}

/** Called from showView() whenever the Build view is opened. */
async function enterMealBuilder() {
  if (!plateSession) resetPlateSession();
  await populatePlateFoodDatalist();
  renderPlateItems();
}

/**
 * app.js — Phase 1 shell: navigation between views + today's live totals.
 * Manual entry, library, scan/OCR, and meal builder logic land in later phases
 * (see PROJECT BIBLE §7 for the phase order). The nav and data layer here are
 * built to be reused as-is once those views get real functionality.
 */

const VIEWS = ['today', 'library', 'scan', 'build', 'manual', 'settings', 'history'];

async function seedStarterFoods() {
  const seeded = await PlateDB.getSetting('starter_db_seeded', false);
  if (!seeded) {
    for (const food of STARTER_FOODS) {
      await PlateDB.saveFoodItem(food);
    }
    await PlateDB.setSetting('starter_db_seeded', true);
    return;
  }
  // Already seeded before — but new starter items (like a later addition to
  // STARTER_FOODS) still need to reach existing installs. Add only the ones
  // missing by id, so this never overwrites a starter item the person has
  // since edited or deleted on purpose.
  for (const food of STARTER_FOODS) {
    const existing = await PlateDB.getFoodItem(food.id);
    if (!existing) await PlateDB.saveFoodItem(food);
  }
}

function todayDateStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, used as the log index key
}

function formatDateHeading() {
  const d = new Date();
  return d.toLocaleDateString(currentLocale(), { weekday: 'long', month: 'short', day: 'numeric' });
}

function showToast(message) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'app-toast';
    document.querySelector('.app-shell').appendChild(el);
  }
  el.textContent = message;
  el.classList.remove('is-visible');
  // Force reflow so re-triggering the animation works if a toast is already showing.
  void el.offsetWidth;
  el.classList.add('is-visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

function showView(name) {
  if (!VIEWS.includes(name)) return;

  document.querySelectorAll('.view').forEach((el) => {
    el.hidden = el.dataset.view !== name;
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.nav === name);
  });

  window.location.hash = name;
  if (name === 'today') renderToday();
  if (name === 'library') renderLibrary();
  if (name === 'settings') loadGoalsIntoForm();
  if (name === 'history') renderHistory();
  if (name === 'build') enterMealBuilder();
}

function wireNav() {
  // data-nav="manual" buttons are wired separately in wireFoodForm(), since
  // they need to reset the form to blank rather than just switching views.
  document.querySelectorAll('[data-nav]:not([data-nav="manual"])').forEach((el) => {
    el.addEventListener('click', () => showView(el.dataset.nav));
  });
}

function round(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

async function renderToday() {
  document.getElementById('today-date').textContent = formatDateHeading();

  const entries = await PlateDB.getLogEntriesForDate(todayDateStr());
  entries.sort((a, b) => (a.logged_at || '').localeCompare(b.logged_at || ''));

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein_g || 0),
      carbs: acc.carbs + (e.carbs_g || 0),
      fat: acc.fat + (e.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  document.getElementById('today-calories').textContent = Math.round(totals.calories);
  document.getElementById('today-protein').textContent = `${round(totals.protein)}g`;
  document.getElementById('today-carbs').textContent = `${round(totals.carbs)}g`;
  document.getElementById('today-fat').textContent = `${round(totals.fat)}g`;

  renderMacroCalorieSplit(totals);

  const goals = await getDailyGoals();
  const goalLineEl = document.getElementById('today-goal-line');
  if (goals.calories) {
    const remaining = Math.round(goals.calories - totals.calories);
    goalLineEl.textContent = remaining >= 0
      ? t('kcalLeftOfGoal', remaining, Math.round(goals.calories))
      : t('kcalOverGoal', Math.abs(remaining), Math.round(goals.calories));
    goalLineEl.hidden = false;
  } else {
    goalLineEl.hidden = true;
  }

  const listEl = document.getElementById('today-log-list');
  if (entries.length === 0) {
    listEl.innerHTML = `<p class="empty-state">${t('todayEmptyState')}</p>`;
    return;
  }

  todayEntryCache = entries;
  listEl.innerHTML = groupTodayEntries(entries).map(todayRowHtml).join('');
}

/**
 * Kcal-per-gram for each macro, used to turn grams logged today into each
 * macro's share of today's macro calories — not tied to any goal.
 */
const MACRO_KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

/**
 * Shows what % of today's macro calories each macro (protein/carbs/fat)
 * represents so far — e.g. "40g · 36%" — independent of any goal, and
 * always visible (0% once something's logged, hidden only before any
 * macro has been logged at all today).
 *
 * Calorie-weighted, not gram-weighted: fat is 9 kcal/g vs. 4 kcal/g for
 * protein/carbs, so a straight gram ratio would understate fat's actual
 * share of the day's energy. percent = (macro's kcal) / (sum of all three
 * macros' kcal) * 100.
 */
function renderMacroCalorieSplit(totals) {
  const macroKcal = {
    protein: totals.protein * MACRO_KCAL_PER_G.protein,
    carbs: totals.carbs * MACRO_KCAL_PER_G.carbs,
    fat: totals.fat * MACRO_KCAL_PER_G.fat,
  };
  const totalMacroKcal = macroKcal.protein + macroKcal.carbs + macroKcal.fat;

  for (const key of ['protein', 'carbs', 'fat']) {
    const el = document.getElementById(`today-${key}-pct`);
    if (totalMacroKcal <= 0) {
      el.hidden = true;
      continue;
    }
    const pct = Math.round((macroKcal[key] / totalMacroKcal) * 100);
    el.textContent = `${pct}%`;
    el.hidden = false;
  }
}

/**
 * Collapses log entries into display groups: entries that share a
 * meal_group_id (from Meal Builder or a quick-add meal) become one group,
 * everything else stays its own single-item group. Order follows each
 * group's first occurrence in `entries`, so the already-chronological sort
 * from renderToday is preserved.
 */
function groupTodayEntries(entries) {
  const groups = [];
  const byGroupId = new Map();
  for (const e of entries) {
    if (e.meal_group_id) {
      let group = byGroupId.get(e.meal_group_id);
      if (!group) {
        group = { groupId: e.meal_group_id, items: [] };
        byGroupId.set(e.meal_group_id, group);
        groups.push(group);
      }
      group.items.push(e);
    } else {
      groups.push({ groupId: null, items: [e] });
    }
  }
  return groups;
}

// The entries currently on screen, kept so click delegation on #today-log-list
// can look an entry up by id without a fresh DB round-trip.
let todayEntryCache = [];

// Which meal-group cards are expanded, keyed by meal_group_id. Lives outside
// renderToday so it survives a re-render (e.g. after editing a sub-item).
const expandedMealGroups = new Set();

function estimatedBadge(e) {
  return e.is_estimated ? `<span class="estimated-badge">${t('estimatedBadge')}</span>` : '';
}

function todayRowHtml(group) {
  if (group.items.length === 1) {
    const e = group.items[0];
    const mealTag = e.meal_label ? ` · ${mealLabelText(e.meal_label)}` : '';
    return `
      <div class="log-item is-tappable" data-action="edit-entry" data-id="${e.id}" role="button" tabindex="0">
        <div>
          <div class="name">${escapeHtml(e.name || t('itemFallbackName'))}${estimatedBadge(e)}</div>
          <div class="detail">${escapeHtml(e.serving_display || '')}${mealTag}</div>
        </div>
        <div class="kcal">${Math.round(e.calories || 0)}</div>
      </div>`;
  }

  // Consolidated meal: one expandable card for all entries sharing a meal_group_id.
  const total = group.items.reduce((sum, e) => sum + (e.calories || 0), 0);
  const label = mealLabelText(group.items[0].meal_label) || t('mealFallbackLabel');
  const itemNames = group.items.map((e) => escapeHtml(e.name || t('itemFallbackName'))).join(', ');
  const isOpen = expandedMealGroups.has(group.groupId);

  const subitems = group.items
    .map(
      (e) => `
      <div class="meal-subitem is-tappable" data-action="edit-entry" data-id="${e.id}" role="button" tabindex="0">
        <div>
          <div class="name">${escapeHtml(e.name || t('itemFallbackName'))}${estimatedBadge(e)}</div>
          <div class="detail">${escapeHtml(e.serving_display || '')}</div>
        </div>
        <div class="log-item-actions">
          <div class="kcal">${Math.round(e.calories || 0)}</div>
          <button type="button" class="row-icon-btn" data-action="delete-entry" data-id="${e.id}" aria-label="${t('deleteThisItemAria')}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="meal-group-card">
      <div class="log-item meal-group-summary" data-action="toggle-group" data-group-id="${group.groupId}" role="button" tabindex="0">
        <div>
          <div class="name">${label} <span class="meal-group-count">· ${group.items.length} ${t('itemsSuffix')}</span></div>
          <div class="detail">${itemNames}</div>
        </div>
        <div class="log-item-actions">
          <div class="kcal">${Math.round(total)}</div>
          <button type="button" class="row-icon-btn" data-action="delete-group" data-group-id="${group.groupId}" aria-label="${t('deleteWholeMealAria')}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
          <svg class="chevron${isOpen ? ' is-open' : ''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      ${isOpen ? `<div class="meal-group-sublist">${subitems}</div>` : ''}
    </div>`;
}

async function handleTodayListClick(evt) {
  const btn = evt.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'toggle-group') {
    evt.stopPropagation();
    const groupId = btn.dataset.groupId;
    if (expandedMealGroups.has(groupId)) expandedMealGroups.delete(groupId);
    else expandedMealGroups.add(groupId);
    renderToday();
    return;
  }

  if (action === 'delete-group') {
    evt.stopPropagation();
    const groupId = btn.dataset.groupId;
    const items = todayEntryCache.filter((e) => e.meal_group_id === groupId);
    if (!confirm(t('deleteMealConfirm', items.length))) return;
    for (const item of items) await PlateDB.deleteLogEntry(item.id);
    expandedMealGroups.delete(groupId);
    renderToday();
    return;
  }

  if (action === 'delete-entry') {
    evt.stopPropagation();
    const id = btn.dataset.id;
    if (!confirm(t('deleteEntryConfirm'))) return;
    await PlateDB.deleteLogEntry(id);
    renderToday();
    return;
  }

  if (action === 'edit-entry') {
    const id = btn.dataset.id;
    const entry = todayEntryCache.find((e) => e.id === id);
    if (entry) openEntrySheet(entry);
  }
}

function wireTodayListDelegation() {
  const listEl = document.getElementById('today-log-list');
  listEl.addEventListener('click', handleTodayListClick);
  listEl.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      const target = evt.target.closest('[data-action]');
      if (target) {
        evt.preventDefault();
        handleTodayListClick(evt);
      }
    }
  });
}

let libraryFilter = 'all';

function libraryRowHtml(item) {
  const servingAmount = (item.default_serving && item.default_serving.amount) || 100;
  const unit = (item.default_serving && item.default_serving.unit) || 'g';
  const unitLabel = (typeof UNIT_LABELS !== 'undefined' && UNIT_LABELS[unit]) || unit;
  const kcalForServing = Math.round((item.calories_per_100 || 0) * (servingAmount / 100));
  return `
    <div class="log-item is-tappable" data-id="${item.id}" role="button" tabindex="0">
      <div>
        <div class="name">${escapeHtml(displayFoodName(item))}</div>
        <div class="detail">${t('perServing', servingAmount, unitLabel)}${item.brand ? ' · ' + escapeHtml(item.brand) : ''}</div>
      </div>
      <div class="log-item-actions">
        <button type="button" class="row-icon-btn${item.favorite ? ' is-favorite' : ''}" data-action="favorite" data-id="${item.id}" aria-label="${t('toggleFavoriteAria')}" aria-pressed="${item.favorite ? 'true' : 'false'}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${item.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        <button type="button" class="row-icon-btn" data-action="edit" data-id="${item.id}" aria-label="${t('editFoodAria')}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button type="button" class="row-icon-btn" data-action="share" data-id="${item.id}" aria-label="${t('shareFoodAria')}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>
        </button>
        <div class="kcal">${kcalForServing}</div>
      </div>
    </div>`;
}

async function getVisibleLibraryItems() {
  const items = await PlateDB.getAllFoodItems();
  const searchInput = document.getElementById('library-search');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = items;
  if (libraryFilter === 'favorites') {
    filtered = filtered.filter((i) => i.favorite);
  } else if (libraryFilter === 'recent') {
    filtered = filtered.filter((i) => i.last_used_at);
  }
  if (q) filtered = filtered.filter((i) => displayFoodName(i).toLowerCase().includes(q));

  filtered = libraryFilter === 'recent'
    ? filtered.sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || '')).slice(0, 15)
    : filtered.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  return filtered;
}

function libraryEmptyMessages() {
  return {
    all: t('libraryEmptyState'),
    favorites: t('noFavoritesEmpty'),
    recent: t('noRecentEmpty'),
    meals: t('noMealsEmpty'),
  };
}

function libraryHints() {
  return {
    all: t('libraryHint'),
    favorites: t('libraryHint'),
    recent: t('libraryHint'),
    meals: t('mealsHint'),
  };
}

function mealTemplateRowHtml(meal) {
  const mealTag = meal.meal_label ? ' · ' + mealLabelText(meal.meal_label) : '';
  return `
    <div class="log-item is-tappable" data-type="meal" data-id="${meal.id}" role="button" tabindex="0">
      <div>
        <div class="name">${escapeHtml(meal.name)}</div>
        <div class="detail">${meal.items.length} ${t('itemsSuffix')}${mealTag}</div>
      </div>
      <div class="log-item-actions">
        <button type="button" class="row-icon-btn" data-action="delete-meal" data-id="${meal.id}" aria-label="${t('deleteMealTemplateAria')}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>
      </div>
    </div>`;
}

async function renderLibrary() {
  const listEl = document.getElementById('library-list');
  document.getElementById('library-hint').textContent = libraryHints()[libraryFilter];

  if (libraryFilter === 'meals') {
    const meals = await PlateDB.getAllMealTemplates();
    const searchInput = document.getElementById('library-search');
    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filtered = (q ? meals.filter((m) => m.name.toLowerCase().includes(q)) : meals)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    listEl.innerHTML = filtered.length
      ? filtered.map(mealTemplateRowHtml).join('')
      : `<p class="empty-state">${q ? t('noMatches') : libraryEmptyMessages().meals}</p>`;
    return;
  }

  const items = await getVisibleLibraryItems();
  if (items.length === 0) {
    const searchInput = document.getElementById('library-search');
    const hasQuery = searchInput && searchInput.value.trim();
    listEl.innerHTML = `<p class="empty-state">${hasQuery ? t('noMatches') : libraryEmptyMessages()[libraryFilter]}</p>`;
    return;
  }

  listEl.innerHTML = items.map(libraryRowHtml).join('');
}

function wireLibraryTabs() {
  document.querySelectorAll('#library-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      libraryFilter = btn.dataset.filter;
      document.querySelectorAll('#library-tabs .tab-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderLibrary();
    });
  });
}

/** Logs every item in a saved meal template to today, using each food's *current* nutrition data (so edits to a food since the template was saved are reflected). */
async function logMealTemplateNow(template) {
  const groupId = PlateDB.uid();
  const date = todayDateStr();
  const now = new Date().toISOString();
  let loggedCount = 0;

  for (const templateItem of template.items) {
    const food = await PlateDB.getFoodItem(templateItem.food_item_id);
    if (!food) continue; // food was deleted from the library since this template was saved
    const scale = templateItem.weight / 100;
    await PlateDB.saveLogEntry({
      date,
      food_item_id: food.id,
      name: displayFoodName(food),
      quantity: templateItem.weight,
      unit: 'g',
      meal_label: template.meal_label,
      meal_group_id: groupId,
      serving_display: `${round(templateItem.weight)}g`,
      calories: (food.calories_per_100 || 0) * scale,
      protein_g: (food.protein_per_100 || 0) * scale,
      carbs_g: (food.carbs_per_100 || 0) * scale,
      fat_g: (food.fat_per_100 || 0) * scale,
      fiber_g: (food.fiber_per_100 || 0) * scale,
      sugar_g: (food.sugar_per_100 || 0) * scale,
      sodium_mg: (food.sodium_mg_per_100 || 0) * scale,
      logged_at: now,
    });
    await PlateDB.markFoodUsed(food.id);
    loggedCount++;
  }

  if (loggedCount === 0) {
    alert(t('templateLogFailedAlert', template.name));
    return;
  }
  if (loggedCount < template.items.length) {
    showToast(t('templateLogPartialToast', template.name, loggedCount, template.items.length));
  } else {
    showToast(t('templateLoggedToast', template.name));
  }
  showView('today');
}

async function handleLibraryListClick(evt) {
  const actionBtn = evt.target.closest('.row-icon-btn');
  if (actionBtn) {
    evt.stopPropagation();
    const id = actionBtn.dataset.id;
    if (actionBtn.dataset.action === 'favorite') {
      await PlateDB.toggleFavorite(id);
      renderLibrary();
    } else if (actionBtn.dataset.action === 'edit') {
      const item = await PlateDB.getFoodItem(id);
      if (item) openManualForm(item);
    } else if (actionBtn.dataset.action === 'share') {
      await handleShareFoodItem(id);
    } else if (actionBtn.dataset.action === 'delete-meal') {
      if (confirm(t('removeMealTemplateConfirm'))) {
        await PlateDB.deleteMealTemplate(id);
        renderLibrary();
      }
    }
    return;
  }

  const row = evt.target.closest('.log-item[data-id]');
  if (!row) return;

  if (row.dataset.type === 'meal') {
    const template = (await PlateDB.getAllMealTemplates()).find((m) => m.id === row.dataset.id);
    if (template) logMealTemplateNow(template);
    return;
  }

  const item = await PlateDB.getFoodItem(row.dataset.id);
  if (item) openLogSheet(item);
}

function wireLibraryListDelegation() {
  const listEl = document.getElementById('library-list');
  listEl.addEventListener('click', handleLibraryListClick);
  listEl.addEventListener('keydown', (evt) => {
    if ((evt.key === 'Enter' || evt.key === ' ') && evt.target.classList.contains('log-item')) {
      handleLibraryListClick(evt);
    }
  });
}

/* ============================================
   Share a single library item (WhatsApp, AirDrop, email, etc.)

   Produces the same "one food item" JSON shape that Import (see
   settingsPanel.js) knows how to read — so no matter how the file
   travels to the other person (chat app, USB, email attachment), tapping
   Import on their end just adds it to their own library.
   ============================================ */

const SHARED_ITEM_EXPORT_TYPE = 'plate_food_item';

/** Strips personal/local-only fields before handing an item to someone else's browser. */
function buildShareableFoodItem(item) {
  const { id, created_at, updated_at, favorite, last_used_at, ...shareable } = item;
  return {
    exportType: SHARED_ITEM_EXPORT_TYPE,
    version: 1,
    exported_at: new Date().toISOString(),
    foodItem: shareable,
  };
}

function slugify(str) {
  return (
    (str || 'food')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'food'
  );
}

function downloadJsonFile(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleShareFoodItem(id) {
  const item = await PlateDB.getFoodItem(id);
  if (!item) return;

  const payload = buildShareableFoodItem(item);
  const json = JSON.stringify(payload, null, 2);
  const filename = `plate-item-${slugify(displayFoodName(item))}.json`;

  // Prefer the native share sheet (WhatsApp, Mail, AirDrop, Messages, ...)
  // when the browser can share files — Android Chrome and iOS Safari
  // 16.4+ support this. Everywhere else (most desktop browsers, older
  // iOS), fall back to a plain download the user can attach by hand.
  let file = null;
  try {
    file = new File([json], filename, { type: 'application/json' });
  } catch {
    // File constructor unsupported (very old browsers) — download fallback below handles it
  }

  if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: displayFoodName(item) });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet — not a failure
      // any other error: fall through to download below
    }
  }

  downloadJsonFile(json, filename);
  showToast(t('itemShareDownloaded'));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function wireLibrarySearch() {
  const input = document.getElementById('library-search');
  if (!input) return;
  input.addEventListener('input', renderLibrary);
}

/* ============================================
   Manual entry form (add / edit food)
   ============================================ */

function foodFormEls() {
  return {
    form: document.getElementById('food-form'),
    id: document.getElementById('food-id'),
    name: document.getElementById('food-name'),
    brand: document.getElementById('food-brand'),
    servingAmount: document.getElementById('food-serving-amount'),
    servingUnit: document.getElementById('food-serving-unit'),
    calories: document.getElementById('food-calories'),
    protein: document.getElementById('food-protein'),
    carbs: document.getElementById('food-carbs'),
    fat: document.getElementById('food-fat'),
    fiber: document.getElementById('food-fiber'),
    sugar: document.getElementById('food-sugar'),
    sodium: document.getElementById('food-sodium'),
    error: document.getElementById('form-error'),
    deleteBtn: document.getElementById('delete-food-btn'),
    heading: document.getElementById('manual-heading'),
    eyebrow: document.getElementById('manual-eyebrow'),
  };
}

function populateFormFromItem(els, item) {
  const servingAmount = (item.default_serving && item.default_serving.amount) || 100;
  const scale = servingAmount / 100;
  els.name.value = item.name || '';
  els.brand.value = item.brand || '';
  els.servingAmount.value = servingAmount;
  els.servingUnit.value = (item.default_serving && item.default_serving.unit) || 'g';
  els.calories.value = round((item.calories_per_100 || 0) * scale);
  els.protein.value = round((item.protein_per_100 || 0) * scale);
  els.carbs.value = round((item.carbs_per_100 || 0) * scale);
  els.fat.value = round((item.fat_per_100 || 0) * scale);
  els.fiber.value = round((item.fiber_per_100 || 0) * scale);
  els.sugar.value = round((item.sugar_per_100 || 0) * scale);
  els.sodium.value = round((item.sodium_mg_per_100 || 0) * scale);
}

/**
 * Opens the form in one of three modes:
 *   - no item              -> blank "new food"
 *   - item with an id      -> editing that existing library item
 *   - item without an id   -> prefilled but unsaved (e.g. an OCR read) —
 *                              same fields, but saving creates a new item
 */
function openManualForm(item) {
  const els = foodFormEls();
  els.form.reset();
  els.error.hidden = true;

  if (item && item.id) {
    populateFormFromItem(els, item);
    els.id.value = item.id;
    els.heading.textContent = t('editFoodHeading');
    els.eyebrow.textContent = t('editingEyebrow');
    els.deleteBtn.hidden = false;
  } else if (item) {
    populateFormFromItem(els, item);
    els.id.value = '';
    els.heading.textContent = t('fromScanHeading');
    els.eyebrow.textContent = t('fromScanEyebrow');
    els.deleteBtn.hidden = true;
  } else {
    els.id.value = '';
    els.servingAmount.value = 100;
    els.calories.value = '';
    ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'].forEach((k) => (els[k].value = 0));
    els.heading.textContent = t('newFoodHeading');
    els.eyebrow.textContent = t('addItemEyebrow');
    els.deleteBtn.hidden = true;
  }

  showView('manual');
  els.name.focus();
}

function num(input) {
  const v = parseFloat(input.value);
  return Number.isFinite(v) ? v : 0;
}

async function handleFoodFormSubmit(evt) {
  evt.preventDefault();
  const els = foodFormEls();

  const name = els.name.value.trim();
  const servingAmount = num(els.servingAmount);
  const calories = num(els.calories);

  if (!name || servingAmount <= 0 || els.calories.value === '') {
    els.error.textContent = t('formErrorRequired');
    els.error.hidden = false;
    return;
  }

  const scaleTo100 = 100 / servingAmount;
  const existing = els.id.value ? await PlateDB.getFoodItem(els.id.value) : null;

  const record = {
    ...existing,
    id: els.id.value || undefined,
    name,
    brand: els.brand.value.trim() || undefined,
    source: existing ? existing.source : 'manual',
    default_serving: { amount: servingAmount, unit: els.servingUnit.value },
    calories_per_100: calories * scaleTo100,
    protein_per_100: num(els.protein) * scaleTo100,
    carbs_per_100: num(els.carbs) * scaleTo100,
    fat_per_100: num(els.fat) * scaleTo100,
    fiber_per_100: num(els.fiber) * scaleTo100,
    sugar_per_100: num(els.sugar) * scaleTo100,
    sodium_mg_per_100: num(els.sodium) * scaleTo100,
  };

  try {
    const saved = await PlateDB.saveFoodItem(record);
    // Read it back rather than trusting the write silently succeeded —
    // if this ever throws or comes back empty, something is genuinely wrong
    // and the person needs to see that, not a form that just quietly resets.
    const confirmed = await PlateDB.getFoodItem(saved.id);
    if (!confirmed) throw new Error(t('saveDidNotStick'));
  } catch (err) {
    console.error('Failed to save food item:', err);
    els.error.textContent = t('formErrorSaveFail', err.message);
    els.error.hidden = false;
    return;
  }

  showToast(existing ? t('savedChangesToToast', name) : t('addedToLibraryToast', name));
  showView('today');
}

async function handleDeleteFood() {
  const els = foodFormEls();
  const id = els.id.value;
  if (!id) return;
  if (!confirm(t('removeFoodConfirm'))) return;
  await PlateDB.deleteFoodItem(id);
  showView('library');
}

/* ============================================
   Log-from-library sheet
   ============================================ */

let activeLogItem = null;

function openLogSheet(item) {
  activeLogItem = item;
  const servingAmount = (item.default_serving && item.default_serving.amount) || 100;
  const unit = (item.default_serving && item.default_serving.unit) || 'g';

  document.getElementById('log-sheet-name').textContent = displayFoodName(item);
  document.getElementById('log-amount').value = servingAmount;
  document.getElementById('log-unit').textContent = unit;
  document.getElementById('log-meal-label').value = '';
  updateLogPreview();
  document.getElementById('log-sheet-backdrop').hidden = false;
}

function closeLogSheet() {
  document.getElementById('log-sheet-backdrop').hidden = true;
  activeLogItem = null;
}

function updateLogPreview() {
  if (!activeLogItem) return;
  const amount = parseFloat(document.getElementById('log-amount').value) || 0;
  const kcal = Math.round((activeLogItem.calories_per_100 || 0) * (amount / 100));
  document.getElementById('log-preview').textContent = `${kcal} kcal`;
}

async function confirmLogEntry() {
  if (!activeLogItem) return;
  const amount = parseFloat(document.getElementById('log-amount').value) || 0;
  const unit = (activeLogItem.default_serving && activeLogItem.default_serving.unit) || 'g';
  const mealLabel = document.getElementById('log-meal-label').value || undefined;
  const scale = amount / 100;

  await PlateDB.saveLogEntry({
    date: todayDateStr(),
    food_item_id: activeLogItem.id,
    name: activeLogItem.name,
    quantity: amount,
    unit,
    meal_label: mealLabel,
    serving_display: `${amount}${unit}`,
    calories: (activeLogItem.calories_per_100 || 0) * scale,
    protein_g: (activeLogItem.protein_per_100 || 0) * scale,
    carbs_g: (activeLogItem.carbs_per_100 || 0) * scale,
    fat_g: (activeLogItem.fat_per_100 || 0) * scale,
    fiber_g: (activeLogItem.fiber_per_100 || 0) * scale,
    sugar_g: (activeLogItem.sugar_per_100 || 0) * scale,
    sodium_mg: (activeLogItem.sodium_mg_per_100 || 0) * scale,
    logged_at: new Date().toISOString(),
  });
  await PlateDB.markFoodUsed(activeLogItem.id);

  closeLogSheet();
  showView('today');
}

function wireFoodForm() {
  document.getElementById('food-form').addEventListener('submit', handleFoodFormSubmit);
  document.getElementById('delete-food-btn').addEventListener('click', handleDeleteFood);

  // "Add manually" entry points should always start from a blank form.
  document.querySelectorAll('[data-nav="manual"]').forEach((el) => {
    el.addEventListener('click', () => openManualForm(null));
  });
}

function wireLogSheet() {
  document.getElementById('log-amount').addEventListener('input', updateLogPreview);
  document.getElementById('log-confirm-btn').addEventListener('click', confirmLogEntry);
  document.getElementById('log-cancel-btn').addEventListener('click', closeLogSheet);
  document.getElementById('log-edit-btn').addEventListener('click', () => {
    const item = activeLogItem;
    closeLogSheet();
    if (item) openManualForm(item);
  });
  document.getElementById('log-sheet-backdrop').addEventListener('click', (evt) => {
    if (evt.target.id === 'log-sheet-backdrop') closeLogSheet();
  });
}

/* ============================================
   Log entry edit / estimate sheet
   ============================================
   One sheet, two purposes: editing an existing log entry (tapped from
   Today) and creating a brand-new "estimated" entry (from the quick
   action). An entry is in "scaled" mode when it's linked to a still-existing
   library food (its amount can be edited and macros recompute from that
   food's per-100 baseline); otherwise it's "estimated" mode, where the
   calories/macros are just the numbers typed in directly — no baseline to
   scale from, which is exactly what you want for a meal you couldn't weigh. */

let activeEntry = null; // null while creating a new estimated entry
let activeEntryFood = null;
let activeEntryMode = 'estimated';

function entrySheetEls() {
  return {
    backdrop: document.getElementById('entry-sheet-backdrop'),
    eyebrow: document.getElementById('entry-sheet-eyebrow'),
    nameField: document.getElementById('entry-name-field'),
    name: document.getElementById('entry-name'),
    amountField: document.getElementById('entry-amount-field'),
    amount: document.getElementById('entry-amount'),
    amountUnit: document.getElementById('entry-amount-unit'),
    caloriesField: document.getElementById('entry-calories-field'),
    calories: document.getElementById('entry-calories'),
    macroFields: document.getElementById('entry-macro-fields'),
    protein: document.getElementById('entry-protein'),
    carbs: document.getElementById('entry-carbs'),
    fat: document.getElementById('entry-fat'),
    mealLabel: document.getElementById('entry-meal-label'),
    preview: document.getElementById('entry-sheet-preview'),
    estimatedHint: document.getElementById('entry-estimated-hint'),
    error: document.getElementById('entry-sheet-error'),
    saveBtn: document.getElementById('entry-save-btn'),
    deleteBtn: document.getElementById('entry-delete-btn'),
  };
}

async function openEntrySheet(entry) {
  activeEntry = entry;
  activeEntryFood = entry.food_item_id ? await PlateDB.getFoodItem(entry.food_item_id) : null;
  activeEntryMode = !entry.is_estimated && activeEntryFood ? 'scaled' : 'estimated';

  const els = entrySheetEls();
  els.error.hidden = true;
  els.mealLabel.value = entry.meal_label || '';
  els.deleteBtn.hidden = false;

  if (activeEntryMode === 'scaled') {
    els.eyebrow.textContent = entry.name || t('editEntryEyebrow');
    els.nameField.hidden = true;
    els.amountField.hidden = false;
    els.amount.value = entry.quantity || '';
    els.amountUnit.textContent = entry.unit || 'g';
    els.caloriesField.hidden = true;
    els.macroFields.hidden = true;
    els.estimatedHint.hidden = true;
    els.saveBtn.textContent = t('saveChanges');
    updateEntrySheetPreview();
  } else {
    els.eyebrow.textContent = t('editEstimatedEntryEyebrow');
    els.nameField.hidden = false;
    els.name.value = entry.name || '';
    els.amountField.hidden = true;
    els.caloriesField.hidden = false;
    els.calories.value = entry.calories ? round(entry.calories) : '';
    els.macroFields.hidden = false;
    els.protein.value = entry.protein_g ? round(entry.protein_g) : '';
    els.carbs.value = entry.carbs_g ? round(entry.carbs_g) : '';
    els.fat.value = entry.fat_g ? round(entry.fat_g) : '';
    els.estimatedHint.hidden = false;
    els.saveBtn.textContent = t('saveChanges');
    updateEntrySheetPreview();
  }

  els.backdrop.hidden = false;
}

function openEstimateSheet() {
  activeEntry = null;
  activeEntryFood = null;
  activeEntryMode = 'estimated';

  const els = entrySheetEls();
  els.error.hidden = true;
  els.eyebrow.textContent = t('estimateMealEyebrow');
  els.nameField.hidden = false;
  els.name.value = '';
  els.amountField.hidden = true;
  els.caloriesField.hidden = false;
  els.calories.value = '';
  els.macroFields.hidden = false;
  els.protein.value = '';
  els.carbs.value = '';
  els.fat.value = '';
  els.mealLabel.value = '';
  els.estimatedHint.hidden = false;
  els.saveBtn.textContent = t('addToTodaysLog');
  els.deleteBtn.hidden = true;
  updateEntrySheetPreview();

  els.backdrop.hidden = false;
  els.name.focus();
}

function closeEntrySheet() {
  document.getElementById('entry-sheet-backdrop').hidden = true;
  activeEntry = null;
  activeEntryFood = null;
}

function updateEntrySheetPreview() {
  const els = entrySheetEls();
  if (activeEntryMode === 'scaled') {
    const amount = parseFloat(els.amount.value) || 0;
    const kcal = activeEntryFood ? Math.round((activeEntryFood.calories_per_100 || 0) * (amount / 100)) : 0;
    els.preview.textContent = `${kcal} kcal`;
  } else {
    const kcal = Math.round(parseFloat(els.calories.value) || 0);
    els.preview.textContent = `${kcal} kcal`;
  }
}

async function handleEntrySheetSave() {
  const els = entrySheetEls();
  els.error.hidden = true;

  if (activeEntryMode === 'scaled') {
    const amount = parseFloat(els.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      els.error.textContent = t('amountError');
      els.error.hidden = false;
      return;
    }
    const scale = amount / 100;
    const food = activeEntryFood;
    await PlateDB.saveLogEntry({
      ...activeEntry,
      quantity: amount,
      serving_display: `${round(amount)}${activeEntry.unit || 'g'}`,
      meal_label: els.mealLabel.value || undefined,
      calories: (food.calories_per_100 || 0) * scale,
      protein_g: (food.protein_per_100 || 0) * scale,
      carbs_g: (food.carbs_per_100 || 0) * scale,
      fat_g: (food.fat_per_100 || 0) * scale,
      fiber_g: (food.fiber_per_100 || 0) * scale,
      sugar_g: (food.sugar_per_100 || 0) * scale,
      sodium_mg: (food.sodium_mg_per_100 || 0) * scale,
    });
  } else {
    const name = els.name.value.trim();
    const calories = parseFloat(els.calories.value);
    if (!name) {
      els.error.textContent = t('nameRequiredError');
      els.error.hidden = false;
      return;
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      els.error.textContent = t('caloriesRequiredError');
      els.error.hidden = false;
      return;
    }
    await PlateDB.saveLogEntry({
      ...(activeEntry || { date: todayDateStr(), logged_at: new Date().toISOString() }),
      name,
      is_estimated: true,
      food_item_id: activeEntry ? activeEntry.food_item_id : undefined,
      quantity: undefined,
      unit: undefined,
      serving_display: 'Estimated',
      meal_label: els.mealLabel.value || undefined,
      calories,
      protein_g: parseFloat(els.protein.value) || 0,
      carbs_g: parseFloat(els.carbs.value) || 0,
      fat_g: parseFloat(els.fat.value) || 0,
      fiber_g: activeEntry ? activeEntry.fiber_g : 0,
      sugar_g: activeEntry ? activeEntry.sugar_g : 0,
      sodium_mg: activeEntry ? activeEntry.sodium_mg : 0,
    });
  }

  const wasNew = !activeEntry;
  closeEntrySheet();
  showToast(wasNew ? t('addedToTodaysLogToast') : t('savedChangesToast'));
  renderToday();
}

async function handleEntrySheetDelete() {
  if (!activeEntry) return;
  if (!confirm(t('deleteEntryConfirm'))) return;
  await PlateDB.deleteLogEntry(activeEntry.id);
  closeEntrySheet();
  renderToday();
}

function wireEntrySheet() {
  document.getElementById('estimate-meal-btn').addEventListener('click', openEstimateSheet);
  document.getElementById('entry-amount').addEventListener('input', updateEntrySheetPreview);
  document.getElementById('entry-calories').addEventListener('input', updateEntrySheetPreview);
  document.getElementById('entry-save-btn').addEventListener('click', handleEntrySheetSave);
  document.getElementById('entry-delete-btn').addEventListener('click', handleEntrySheetDelete);
  document.getElementById('entry-cancel-btn').addEventListener('click', closeEntrySheet);
  document.getElementById('entry-sheet-backdrop').addEventListener('click', (evt) => {
    if (evt.target.id === 'entry-sheet-backdrop') closeEntrySheet();
  });
}

function initialViewFromHash() {
  const fromHash = window.location.hash.replace('#', '');
  return VIEWS.includes(fromHash) ? fromHash : 'today';
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* offline support is a nice-to-have, not a hard requirement */
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  wireLanguageToggle();
  wireNav();
  wireTodayListDelegation();
  wireLibrarySearch();
  wireLibraryListDelegation();
  wireLibraryTabs();
  wireFoodForm();
  wireLogSheet();
  wireEntrySheet();
  wireSettingsPanel();
  wireMealBuilder();
  wireScanView();
  wireHistory();
  seedStarterFoods().then(() => {
    if (initialViewFromHash() === 'library') renderLibrary();
  });
  showView(initialViewFromHash());
  registerServiceWorker();
});

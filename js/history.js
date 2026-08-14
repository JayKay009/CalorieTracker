/**
 * history.js — simple past-days view. Groups all logEntries by date,
 * shows the last 14 days as a bar list (days with nothing logged still
 * appear, at zero, so gaps are visible rather than silently skipped).
 *
 * Tapping a day opens a read-only "day detail" sheet listing what was
 * actually logged that day — reusing the same meal_group_id grouping logic
 * as the Today screen (see groupTodayEntries in app.js), just without the
 * edit/delete affordances, since History is a look-back, not a place to
 * fix past entries.
 */

const HISTORY_DAYS = 14;

function lastNDateStrings(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const copy = new Date(d);
    copy.setDate(d.getDate() - i);
    out.push(copy.toISOString().slice(0, 10));
  }
  return out;
}

function formatHistoryDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = todayDateStr();
  if (dateStr === today) return t('todayLabel');
  return d.toLocaleDateString(currentLocale(), { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDayDetailHeading(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(currentLocale(), { weekday: 'long', month: 'short', day: 'numeric' });
}

async function renderHistory() {
  const listEl = document.getElementById('history-list');
  const allEntries = await PlateDB.getAllLogEntries();

  const byDate = {};
  allEntries.forEach((e) => {
    byDate[e.date] = (byDate[e.date] || 0) + (e.calories || 0);
  });

  const dates = lastNDateStrings(HISTORY_DAYS);
  const maxKcal = Math.max(1, ...dates.map((d) => byDate[d] || 0));

  listEl.innerHTML = dates
    .map((d) => {
      const kcal = Math.round(byDate[d] || 0);
      const pct = Math.round((kcal / maxKcal) * 100);
      return `
        <div class="history-day is-tappable" data-action="view-day" data-date="${d}" role="button" tabindex="0">
          <span class="hist-date">${formatHistoryDate(d)}</span>
          <span class="history-bar-track"><span class="history-bar-fill" style="width:${pct}%"></span></span>
          <span class="hist-kcal">${kcal}</span>
        </div>`;
    })
    .join('');
}

/* ============================================
   Day detail sheet
   ============================================ */

// Meal-group cards inside the day-detail sheet expand independently of the
// Today screen's own expandedMealGroups — a separate set, keyed the same way.
const dayDetailExpandedGroups = new Set();

function dayDetailRowHtml(group) {
  if (group.items.length === 1) {
    const e = group.items[0];
    const mealTag = e.meal_label ? ` · ${mealLabelText(e.meal_label)}` : '';
    return `
      <div class="log-item">
        <div>
          <div class="name">${escapeHtml(e.name || t('itemFallbackName'))}${estimatedBadge(e)}</div>
          <div class="detail">${escapeHtml(e.serving_display || '')}${mealTag}</div>
        </div>
        <div class="kcal">${Math.round(e.calories || 0)}</div>
      </div>`;
  }

  const total = group.items.reduce((sum, e) => sum + (e.calories || 0), 0);
  const label = mealLabelText(group.items[0].meal_label) || t('mealFallbackLabel');
  const itemNames = group.items.map((e) => escapeHtml(e.name || t('itemFallbackName'))).join(', ');
  const isOpen = dayDetailExpandedGroups.has(group.groupId);

  const subitems = group.items
    .map(
      (e) => `
      <div class="meal-subitem">
        <div>
          <div class="name">${escapeHtml(e.name || t('itemFallbackName'))}${estimatedBadge(e)}</div>
          <div class="detail">${escapeHtml(e.serving_display || '')}</div>
        </div>
        <div class="kcal">${Math.round(e.calories || 0)}</div>
      </div>`
    )
    .join('');

  return `
    <div class="meal-group-card">
      <div class="log-item meal-group-summary is-tappable" data-action="toggle-day-group" data-group-id="${group.groupId}" role="button" tabindex="0">
        <div>
          <div class="name">${label} <span class="meal-group-count">· ${group.items.length} ${t('itemsSuffix')}</span></div>
          <div class="detail">${itemNames}</div>
        </div>
        <div class="log-item-actions">
          <div class="kcal">${Math.round(total)}</div>
          <svg class="chevron${isOpen ? ' is-open' : ''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      ${isOpen ? `<div class="meal-group-sublist">${subitems}</div>` : ''}
    </div>`;
}

async function openDayDetail(dateStr) {
  dayDetailExpandedGroups.clear();
  await renderDayDetail(dateStr);
  document.getElementById('day-detail-backdrop').hidden = false;
  document.getElementById('day-detail-backdrop').dataset.date = dateStr;
}

function closeDayDetail() {
  document.getElementById('day-detail-backdrop').hidden = true;
}

async function renderDayDetail(dateStr) {
  const entries = await PlateDB.getLogEntriesForDate(dateStr);
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

  document.getElementById('day-detail-eyebrow').textContent =
    dateStr === todayDateStr() ? t('todayLabel') : t('loggedThatDayEyebrow');
  document.getElementById('day-detail-date').textContent = formatDayDetailHeading(dateStr);
  document.getElementById('day-detail-calories').textContent = Math.round(totals.calories);
  document.getElementById('day-detail-protein').textContent = `${round(totals.protein)}g`;
  document.getElementById('day-detail-carbs').textContent = `${round(totals.carbs)}g`;
  document.getElementById('day-detail-fat').textContent = `${round(totals.fat)}g`;

  const listEl = document.getElementById('day-detail-list');
  if (entries.length === 0) {
    listEl.innerHTML = `<p class="empty-state">${t('dayEmptyState')}</p>`;
    return;
  }
  listEl.innerHTML = groupTodayEntries(entries).map(dayDetailRowHtml).join('');
}

function handleHistoryListClick(evt) {
  const btn = evt.target.closest('[data-action="view-day"]');
  if (!btn) return;
  openDayDetail(btn.dataset.date);
}

function handleDayDetailListClick(evt) {
  const btn = evt.target.closest('[data-action="toggle-day-group"]');
  if (!btn) return;
  const groupId = btn.dataset.groupId;
  if (dayDetailExpandedGroups.has(groupId)) dayDetailExpandedGroups.delete(groupId);
  else dayDetailExpandedGroups.add(groupId);
  const dateStr = document.getElementById('day-detail-backdrop').dataset.date;
  renderDayDetail(dateStr);
}

function wireHistory() {
  document.getElementById('history-list').addEventListener('click', handleHistoryListClick);
  document.getElementById('history-list').addEventListener('keydown', (evt) => {
    if ((evt.key === 'Enter' || evt.key === ' ') && evt.target.closest('[data-action="view-day"]')) {
      evt.preventDefault();
      handleHistoryListClick(evt);
    }
  });
  document.getElementById('day-detail-list').addEventListener('click', handleDayDetailListClick);
  document.getElementById('day-detail-close-btn').addEventListener('click', closeDayDetail);
  document.getElementById('day-detail-backdrop').addEventListener('click', (evt) => {
    if (evt.target.id === 'day-detail-backdrop') closeDayDetail();
  });
}

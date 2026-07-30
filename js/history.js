/**
 * history.js — simple past-days view. Groups all logEntries by date,
 * shows the last 14 days as a bar list (days with nothing logged still
 * appear, at zero, so gaps are visible rather than silently skipped).
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
  if (dateStr === today) return 'Today';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
        <div class="history-day">
          <span class="hist-date">${formatHistoryDate(d)}</span>
          <span class="history-bar-track"><span class="history-bar-fill" style="width:${pct}%"></span></span>
          <span class="hist-kcal">${kcal}</span>
        </div>`;
    })
    .join('');
}

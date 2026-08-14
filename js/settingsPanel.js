/**
 * settingsPanel.js — daily goals (optional) + backup export/import.
 * Goals are stored as individual settings keys so "no goal set" is just
 * "key absent" rather than needing a separate enabled/disabled flag.
 */

const GOAL_KEYS = {
  calories: 'goal_calories',
  protein: 'goal_protein',
  carbs: 'goal_carbs',
  fat: 'goal_fat',
};

async function loadGoalsIntoForm() {
  const els = {
    calories: document.getElementById('goal-calories'),
    protein: document.getElementById('goal-protein'),
    carbs: document.getElementById('goal-carbs'),
    fat: document.getElementById('goal-fat'),
  };
  for (const key of Object.keys(GOAL_KEYS)) {
    const val = await PlateDB.getSetting(GOAL_KEYS[key], null);
    els[key].value = val === null ? '' : val;
  }
}

async function handleGoalsFormSubmit(evt) {
  evt.preventDefault();
  for (const key of Object.keys(GOAL_KEYS)) {
    const input = document.getElementById(`goal-${key}`);
    const raw = input.value.trim();
    if (raw === '') {
      await PlateDB.setSetting(GOAL_KEYS[key], null);
    } else {
      const num = parseFloat(raw);
      await PlateDB.setSetting(GOAL_KEYS[key], Number.isFinite(num) ? num : null);
    }
  }
  showFormStatus('goals-status', t('goalsSaved'));
}

async function handleClearGoals() {
  for (const key of Object.keys(GOAL_KEYS)) {
    await PlateDB.setSetting(GOAL_KEYS[key], null);
  }
  await loadGoalsIntoForm();
  showFormStatus('goals-status', t('goalsCleared'));
}

function showFormStatus(elId, message) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

/** Returns { calories, protein, carbs, fat } with nulls for unset goals. */
async function getDailyGoals() {
  const entries = await Promise.all(
    Object.entries(GOAL_KEYS).map(async ([key, storageKey]) => [key, await PlateDB.getSetting(storageKey, null)])
  );
  return Object.fromEntries(entries);
}

/* ============================================
   Backup export / import
   ============================================ */

async function handleExportData() {
  const data = await PlateDB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `plate-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showFormStatus('backup-status', t('backupDownloaded'));
}

async function handleImportData(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || (!data.foodItems && !data.logEntries && !data.settings)) {
      throw new Error(t('notAPlateBackup'));
    }
    const confirmed = confirm(
      t('importConfirm', (data.foodItems || []).length, (data.logEntries || []).length)
    );
    if (!confirmed) return;
    await PlateDB.importAll(data);
    showFormStatus('backup-status', t('backupImported'));
    if (document.getElementById('view-today') && !document.getElementById('view-today').hidden) renderToday();
  } catch (err) {
    showFormStatus('backup-status', t('importFailed', err.message));
  } finally {
    evt.target.value = '';
  }
}

function wireSettingsPanel() {
  document.getElementById('goals-form').addEventListener('submit', handleGoalsFormSubmit);
  document.getElementById('clear-goals-btn').addEventListener('click', handleClearGoals);
  document.getElementById('export-data-btn').addEventListener('click', handleExportData);
  document.getElementById('import-data-input').addEventListener('change', handleImportData);
}

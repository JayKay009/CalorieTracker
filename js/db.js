/**
 * db.js — IndexedDB data layer for Plate.
 *
 * Everything here is local to the current browser. There is no server.
 * Schema (see PROJECT BIBLE §4):
 *   foodItems  — the personal library (OCR'd, manual, and starter-database foods)
 *   logEntries — what was actually eaten, per day
 *   settings   — small key/value app settings (units, optional goals)
 */

const DB_NAME = 'plate-db';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('foodItems')) {
        const store = db.createObjectStore('foodItems', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('logEntries')) {
        const store = db.createObjectStore('logEntries', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('meal_group_id', 'meal_group_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const PlateDB = {
  uid,

  // ---- Food items (library) ----
  async saveFoodItem(item) {
    const store = await tx('foodItems', 'readwrite');
    const now = new Date().toISOString();
    const record = {
      id: item.id || uid(),
      created_at: item.created_at || now,
      ...item,
      updated_at: now,
    };
    await promisifyRequest(store.put(record));
    return record;
  },

  async getFoodItem(id) {
    const store = await tx('foodItems');
    return promisifyRequest(store.get(id));
  },

  async getAllFoodItems() {
    const store = await tx('foodItems');
    return promisifyRequest(store.getAll());
  },

  async deleteFoodItem(id) {
    const store = await tx('foodItems', 'readwrite');
    return promisifyRequest(store.delete(id));
  },

  async toggleFavorite(id) {
    const item = await this.getFoodItem(id);
    if (!item) return null;
    return this.saveFoodItem({ ...item, favorite: !item.favorite });
  },

  async markFoodUsed(id) {
    const item = await this.getFoodItem(id);
    if (!item) return null;
    // put() directly rather than saveFoodItem, so "last used" doesn't churn updated_at
    // (updated_at is meant to reflect edits, not usage).
    const store = await tx('foodItems', 'readwrite');
    const record = { ...item, last_used_at: new Date().toISOString() };
    await promisifyRequest(store.put(record));
    return record;
  },

  // ---- Log entries (diary) ----
  async saveLogEntry(entry) {
    const store = await tx('logEntries', 'readwrite');
    const record = { id: entry.id || uid(), ...entry };
    await promisifyRequest(store.put(record));
    return record;
  },

  async getLogEntriesForDate(dateStr) {
    const store = await tx('logEntries');
    const index = store.index('date');
    return promisifyRequest(index.getAll(dateStr));
  },

  async getAllLogEntries() {
    const store = await tx('logEntries');
    return promisifyRequest(store.getAll());
  },

  async deleteLogEntry(id) {
    const store = await tx('logEntries', 'readwrite');
    return promisifyRequest(store.delete(id));
  },

  // ---- Settings ----
  async getSetting(key, fallback = null) {
    const store = await tx('settings');
    const result = await promisifyRequest(store.get(key));
    return result ? result.value : fallback;
  },

  async setSetting(key, value) {
    const store = await tx('settings', 'readwrite');
    return promisifyRequest(store.put({ key, value }));
  },

  // ---- Backup / restore (the manual cross-browser workaround) ----
  async exportAll() {
    const [foodItems, settingsStore] = await Promise.all([
      this.getAllFoodItems(),
      tx('settings').then((s) => promisifyRequest(s.getAll())),
    ]);
    const db = await openDB();
    const logStore = db.transaction('logEntries').objectStore('logEntries');
    const logEntries = await promisifyRequest(logStore.getAll());

    return {
      exported_at: new Date().toISOString(),
      version: DB_VERSION,
      foodItems,
      logEntries,
      settings: settingsStore,
    };
  },

  async importAll(data) {
    const db = await openDB();
    const t = db.transaction(['foodItems', 'logEntries', 'settings'], 'readwrite');
    (data.foodItems || []).forEach((item) => t.objectStore('foodItems').put(item));
    (data.logEntries || []).forEach((entry) => t.objectStore('logEntries').put(entry));
    (data.settings || []).forEach((setting) => t.objectStore('settings').put(setting));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  },
};

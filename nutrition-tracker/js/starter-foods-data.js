/**
 * starter-foods-data.js — a small built-in reference database of common
 * single-ingredient "no label" foods, seeded into the library once on first
 * run (see seedStarterFoods() in app.js). All values are approximate
 * per-100g reference figures (general nutrition-database averages, not any
 * specific brand) — good enough for whole/generic foods; for anything with
 * an actual label, scanning or manual entry from the real label will always
 * be more accurate than this list.
 *
 * Fixed ids (e.g. "starter-chicken-breast") so re-running the seed never
 * creates duplicates — put() just overwrites the same record.
 */

const STARTER_FOODS = [
  { id: 'starter-chicken-breast', name: 'Chicken breast, cooked, skinless', calories_per_100: 165, protein_per_100: 31, carbs_per_100: 0, fat_per_100: 3.6, fiber_per_100: 0, sugar_per_100: 0, sodium_mg_per_100: 74 },
  { id: 'starter-egg', name: 'Egg, large, whole', calories_per_100: 143, protein_per_100: 12.6, carbs_per_100: 0.7, fat_per_100: 9.5, fiber_per_100: 0, sugar_per_100: 0.4, sodium_mg_per_100: 142 },
  { id: 'starter-white-rice', name: 'White rice, cooked', calories_per_100: 130, protein_per_100: 2.7, carbs_per_100: 28, fat_per_100: 0.3, fiber_per_100: 0.4, sugar_per_100: 0.1, sodium_mg_per_100: 1 },
  { id: 'starter-brown-rice', name: 'Brown rice, cooked', calories_per_100: 123, protein_per_100: 2.7, carbs_per_100: 26, fat_per_100: 0.9, fiber_per_100: 1.6, sugar_per_100: 0.4, sodium_mg_per_100: 4 },
  { id: 'starter-banana', name: 'Banana', calories_per_100: 89, protein_per_100: 1.1, carbs_per_100: 23, fat_per_100: 0.3, fiber_per_100: 2.6, sugar_per_100: 12, sodium_mg_per_100: 1 },
  { id: 'starter-apple', name: 'Apple, with skin', calories_per_100: 52, protein_per_100: 0.3, carbs_per_100: 14, fat_per_100: 0.2, fiber_per_100: 2.4, sugar_per_100: 10, sodium_mg_per_100: 1 },
  { id: 'starter-broccoli', name: 'Broccoli, steamed', calories_per_100: 35, protein_per_100: 2.4, carbs_per_100: 7.2, fat_per_100: 0.4, fiber_per_100: 3.3, sugar_per_100: 1.4, sodium_mg_per_100: 41 },
  { id: 'starter-olive-oil', name: 'Olive oil', calories_per_100: 884, protein_per_100: 0, carbs_per_100: 0, fat_per_100: 100, fiber_per_100: 0, sugar_per_100: 0, sodium_mg_per_100: 2 },
  { id: 'starter-butter', name: 'Butter', calories_per_100: 717, protein_per_100: 0.9, carbs_per_100: 0.1, fat_per_100: 81, fiber_per_100: 0, sugar_per_100: 0.1, sodium_mg_per_100: 11 },
  { id: 'starter-whole-milk', name: 'Whole milk', calories_per_100: 61, protein_per_100: 3.2, carbs_per_100: 4.8, fat_per_100: 3.3, fiber_per_100: 0, sugar_per_100: 5.1, sodium_mg_per_100: 43 },
  { id: 'starter-greek-yogurt', name: 'Greek yogurt, plain, whole milk', calories_per_100: 97, protein_per_100: 9, carbs_per_100: 3.9, fat_per_100: 5, fiber_per_100: 0, sugar_per_100: 3.9, sodium_mg_per_100: 35 },
  { id: 'starter-oats', name: 'Rolled oats, dry', calories_per_100: 379, protein_per_100: 13.2, carbs_per_100: 67.7, fat_per_100: 6.5, fiber_per_100: 10.1, sugar_per_100: 1, sodium_mg_per_100: 6 },
  { id: 'starter-almonds', name: 'Almonds', calories_per_100: 579, protein_per_100: 21.2, carbs_per_100: 21.6, fat_per_100: 49.9, fiber_per_100: 12.5, sugar_per_100: 4.4, sodium_mg_per_100: 1 },
  { id: 'starter-peanut-butter', name: 'Peanut butter', calories_per_100: 588, protein_per_100: 25, carbs_per_100: 20, fat_per_100: 50, fiber_per_100: 6, sugar_per_100: 9, sodium_mg_per_100: 459 },
  { id: 'starter-white-bread', name: 'White bread', calories_per_100: 265, protein_per_100: 9, carbs_per_100: 49, fat_per_100: 3.2, fiber_per_100: 2.7, sugar_per_100: 5, sodium_mg_per_100: 491 },
  { id: 'starter-salmon', name: 'Salmon, cooked', calories_per_100: 208, protein_per_100: 22, carbs_per_100: 0, fat_per_100: 13, fiber_per_100: 0, sugar_per_100: 0, sodium_mg_per_100: 59 },
  { id: 'starter-ground-beef', name: 'Ground beef, 85% lean, cooked', calories_per_100: 250, protein_per_100: 26, carbs_per_100: 0, fat_per_100: 17, fiber_per_100: 0, sugar_per_100: 0, sodium_mg_per_100: 75 },
  { id: 'starter-sweet-potato', name: 'Sweet potato, baked', calories_per_100: 90, protein_per_100: 2, carbs_per_100: 21, fat_per_100: 0.2, fiber_per_100: 3.3, sugar_per_100: 6.5, sodium_mg_per_100: 36 },
  { id: 'starter-avocado', name: 'Avocado', calories_per_100: 160, protein_per_100: 2, carbs_per_100: 8.5, fat_per_100: 14.7, fiber_per_100: 6.7, sugar_per_100: 0.7, sodium_mg_per_100: 7 },
  { id: 'starter-cheddar', name: 'Cheddar cheese', calories_per_100: 403, protein_per_100: 23, carbs_per_100: 1.3, fat_per_100: 33, fiber_per_100: 0, sugar_per_100: 0.5, sodium_mg_per_100: 621 },
].map((f) => ({
  ...f,
  brand: undefined,
  source: 'database',
  basis: 'mass',
  default_serving: { amount: 100, unit: 'g' },
}));

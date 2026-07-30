/**
 * units.js — converts entered serving units down to a base unit (grams for
 * mass, milliliters for volume) so nutrition baselines can always be stored
 * as "per 100 base units" regardless of what unit the person typed in.
 *
 * Honesty note (see PROJECT BIBLE — household units tradeoff): volume units
 * (tbsp, tsp, cup, fl oz) are converted using their exact physical volume,
 * then treated as if 1 ml ≈ 1 g. That's accurate for water-like liquids
 * (milk, broth, juice) but NOT for things like flour, sugar, or oil, which
 * are lighter or heavier per ml. Grams/oz/lb are always exact since those
 * are direct weight conversions with no density assumption involved.
 * Encourage weighing in grams for solids whenever precision matters.
 */

const MASS_TO_G = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_TO_ML = {
  ml: 1,
  tsp: 4.92892,
  tbsp: 14.7868,
  fl_oz: 29.5735,
  cup: 236.588,
};

const UNIT_LABELS = {
  g: 'g', oz: 'oz', lb: 'lb',
  ml: 'ml', tsp: 'tsp', tbsp: 'tbsp', fl_oz: 'fl oz', cup: 'cup',
};

function unitBasis(unit) {
  if (MASS_TO_G[unit] !== undefined) return 'mass';
  if (VOLUME_TO_ML[unit] !== undefined) return 'volume';
  return null;
}

/** Converts an amount+unit to its base-unit amount (grams if mass, ml if volume). */
function toBaseAmount(amount, unit) {
  if (MASS_TO_G[unit] !== undefined) {
    return { baseAmount: amount * MASS_TO_G[unit], basis: 'mass', baseUnit: 'g' };
  }
  if (VOLUME_TO_ML[unit] !== undefined) {
    return { baseAmount: amount * VOLUME_TO_ML[unit], basis: 'volume', baseUnit: 'ml' };
  }
  return { baseAmount: amount, basis: 'mass', baseUnit: 'g' }; // safe fallback
}

const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)', group: 'Weight — exact' },
  { value: 'oz', label: 'oz (ounces)', group: 'Weight — exact' },
  { value: 'lb', label: 'lb (pounds)', group: 'Weight — exact' },
  { value: 'ml', label: 'ml (milliliters)', group: 'Volume — approximate for non-liquids' },
  { value: 'tsp', label: 'tsp (teaspoon)', group: 'Volume — approximate for non-liquids' },
  { value: 'tbsp', label: 'tbsp (tablespoon)', group: 'Volume — approximate for non-liquids' },
  { value: 'fl_oz', label: 'fl oz', group: 'Volume — approximate for non-liquids' },
  { value: 'cup', label: 'cup', group: 'Volume — approximate for non-liquids' },
];

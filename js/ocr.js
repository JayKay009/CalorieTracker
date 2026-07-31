/**
 * ocr.js — label capture + OCR. Camera/photo -> downscale -> Tesseract.js
 * (loaded on demand, not on every page load) -> regex-based parsing of the
 * raw text -> handed to the normal add-food form as a starting point.
 *
 * Reads English and Dutch labels (Tesseract language 'eng+nld', and the
 * parser recognizes both English and Dutch nutrition keywords). Energy is
 * matched via the "kcal" unit text specifically wherever possible, since EU
 * labels show kJ and kcal side by side and grabbing the wrong one would be
 * a ~4x error. Sodium falls back to converting from salt/zout (g) using the
 * standard salt = sodium × 2.5 relationship when no direct sodium/natrium
 * (mg) figure is present, since that's how most EU labels report it.
 *
 * Honesty note: this is heuristic text parsing of noisy OCR output. It will
 * misread some labels — that's *why* the result always lands on the normal
 * editable form instead of saving directly. Nothing from this file ever
 * writes to the database on its own.
 */

const TESSERACT_CDN_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let scanState = { file: null, previewUrl: null, parsed: null };

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (window._tesseractLoadPromise) return window._tesseractLoadPromise;

  window._tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_CDN_URL;
    script.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR engine failed to initialize.')));
    script.onerror = () => reject(new Error('Could not load the OCR engine — check your connection and try again.'));
    document.head.appendChild(script);
  });

  return window._tesseractLoadPromise;
}

/** Draws the image onto a canvas capped at maxDim on its longest side, so a full-res phone photo doesn't crawl through OCR. */
function downscaleImageToCanvas(file, maxDim = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image file.'));
    };
    img.src = url;
  });
}

/**
 * Converts to grayscale and inverts if the image is dark-dominant (light
 * text on a dark/colored background — common on branded packaging). This is
 * color-agnostic: it works off overall brightness, not any specific color,
 * so it doesn't matter whether the background is blue, red, black, etc.
 * OCR engines are trained overwhelmingly on dark-text-on-light-background,
 * so light-on-dark labels often come back completely empty without this.
 */
function preprocessCanvasForOcr(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const inverted = grayscaleAndMaybeInvert(imageData.data);
  ctx.putImageData(imageData, 0, 0);
  return { canvas, inverted };
}

/** Pure pixel-buffer transform, factored out so it's testable without a real canvas. Mutates `data` in place (RGBA Uint8ClampedArray-like) and returns whether it inverted. */
function grayscaleAndMaybeInvert(data) {
  const pixelCount = data.length / 4;
  let totalLuminance = 0;
  const luminances = new Array(pixelCount);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    luminances[p] = lum;
    totalLuminance += lum;
  }

  const avgLuminance = totalLuminance / pixelCount;
  const shouldInvert = avgLuminance < 128;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const gray = shouldInvert ? 255 - luminances[p] : luminances[p];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  return shouldInvert;
}

/* ============================================
   Label text parsing (heuristic — see file header)
   ============================================ */

const LABEL_PATTERNS = {
  // "kcal" is written the same in English and Dutch, and EU labels show both
  // kJ and kcal side by side — matching the kcal-tagged number specifically
  // (rather than just "the number near the energy word") avoids accidentally
  // grabbing the kJ figure, which would be ~4x too high.
  caloriesByUnit: /(\d{1,4}(?:[.,]\d+)?)\s*k?cal\b/i,
  // Falls back to the keyword + nearby number if no explicit "kcal" text was
  // found at all (e.g. OCR dropped it). Optionally skips past a kJ-tagged
  // number first, since EU labels put kJ immediately before kcal — without
  // this, "Energie 950kJ 227" would grab 950 (the kJ figure) instead of 227.
  caloriesEnglish: /calories[\s\S]{0,15}?(?:\d+(?:[.,]\d+)?\s*kj[\s\S]{0,15}?)?(\d{1,4}(?:[.,]\d+)?)/i,
  caloriesDutch: /(?:energie(?:waarde)?|calorie[eë]n)[\s\S]{0,15}?(?:\d+(?:[.,]\d+)?\s*kj[\s\S]{0,15}?)?(\d{1,4}(?:[.,]\d+)?)/i,

  // Dutch nouns inflect (vet/vetten, eiwit/eiwitten) — matching only the
  // singular missed real labels ("Vetten 12g" wasn't matching "vet\b" at
  // all, since \b requires a boundary right after "vet" and "vetten"
  // continues with letters there). (?:ten)? on the stem covers both forms.
  protein: /(?:protein|eiwit(?:ten)?)[\s\S]{0,25}?(\d{1,3}(?:[.,]\d+)?)/i,
  totalFat: /(?:total\s*fat|tota(?:al|le)\s*vet(?:ten)?)[\s\S]{0,25}?(\d{1,3}(?:[.,]\d+)?)/i,
  anyFat: /\b(?:fat|vet(?:ten)?)\b[\s\S]{0,25}?(\d{1,3}(?:[.,]\d+)?)/i,
  carbs: /(?:total\s*carbohydrate|carbohydrate|carbs|koolhydra(?:ten|at))[\s\S]{0,25}?(\d{1,3}(?:[.,]\d+)?)/i,
  fiber: /(?:dietary\s*fiber|fiber|vezels|voedingsvezels?)[\s\S]{0,25}?(\d{1,3}(?:[.,]\d+)?)/i,
  sugar: /(?:total\s*sugars|sugars|sugar|suikers?)[\s\S]{0,25}?(\d{1,3}(?:[.,]\d+)?)/i,

  // Sodium (mg) — matched separately from salt (g), since EU labels almost
  // always list "Zout"/"Salt" in grams instead of sodium in mg directly.
  sodium: /(?:sodium|natrium)[\s\S]{0,20}?(\d{1,4}(?:[.,]\d+)?)/i,
  salt: /(?:\bsalt\b|zout)[\s\S]{0,20}?(\d{1,3}(?:[.,]\d+)?)/i,

  // See fraction-serving-size note below — the parenthetical metric amount
  // is preferred whenever present, in either language.
  servingSizeGrams: /(?:serving\s*size|portie(?:grootte)?)[\s\S]{0,40}?\((\d+(?:[.,]\d+)?)\s*(g|ml)\)/i,
  servingSize: /(?:serving\s*size|portie(?:grootte)?)[\s\S]{0,30}?(\d+(?:[.,]\d+)?)\s*(g|ml|fl\.?\s?oz|oz|tbsp|tablespoon|tsp|teaspoon|cup|lb)/i,
};

/** European labels use a comma as the decimal separator ("12,5" = 12.5). */
function parseLocaleNumber(str) {
  return parseFloat(str.replace(',', '.'));
}

function mapOcrUnitText(raw) {
  const t = (raw || '').toLowerCase();
  if (t.includes('fl') && t.includes('oz')) return 'fl_oz';
  if (t.includes('tbsp') || t.includes('tablespoon')) return 'tbsp';
  if (t.includes('tsp') || t.includes('teaspoon')) return 'tsp';
  if (t.includes('cup')) return 'cup';
  if (t.includes('lb')) return 'lb';
  if (t.includes('oz')) return 'oz';
  if (t.includes('ml')) return 'ml';
  if (t.includes('g')) return 'g';
  return null;
}

function extractNumber(text, regex) {
  const m = text.match(regex);
  return m ? parseLocaleNumber(m[1]) : null;
}

function parseLabelText(rawText) {
  // Calories: prefer an explicit kcal-tagged number (unambiguous, works in
  // both languages and can't be confused with a kJ figure). Fall back to
  // keyword-based matching if no "kcal" unit text was found at all.
  const calories =
    extractNumber(rawText, LABEL_PATTERNS.caloriesByUnit) ??
    extractNumber(rawText, LABEL_PATTERNS.caloriesEnglish) ??
    extractNumber(rawText, LABEL_PATTERNS.caloriesDutch);

  const protein = extractNumber(rawText, LABEL_PATTERNS.protein);
  const fat = extractNumber(rawText, LABEL_PATTERNS.totalFat) ?? extractNumber(rawText, LABEL_PATTERNS.anyFat);
  const carbs = extractNumber(rawText, LABEL_PATTERNS.carbs);
  const fiber = extractNumber(rawText, LABEL_PATTERNS.fiber);
  const sugar = extractNumber(rawText, LABEL_PATTERNS.sugar);

  // Sodium: prefer a direct sodium/natrium (mg) reading. If the label only
  // gives salt/zout (g, the EU standard), convert using the standard
  // salt = sodium × 2.5 relationship (i.e. sodium mg = salt g × 400).
  let sodium = extractNumber(rawText, LABEL_PATTERNS.sodium);
  let sodiumFromSalt = false;
  if (sodium === null) {
    const saltGrams = extractNumber(rawText, LABEL_PATTERNS.salt);
    if (saltGrams !== null) {
      sodium = saltGrams * 400;
      sodiumFromSalt = true;
    }
  }

  let servingAmount = null;
  let servingUnit = null;
  const gramsMatch = rawText.match(LABEL_PATTERNS.servingSizeGrams);
  if (gramsMatch) {
    servingAmount = parseLocaleNumber(gramsMatch[1]);
    servingUnit = gramsMatch[2].toLowerCase();
  } else {
    const servingMatch = rawText.match(LABEL_PATTERNS.servingSize);
    if (servingMatch) {
      servingAmount = parseLocaleNumber(servingMatch[1]);
      servingUnit = mapOcrUnitText(servingMatch[2]);
    }
  }

  return { calories, protein, fat, carbs, fiber, sugar, sodium, sodiumFromSalt, servingAmount, servingUnit, rawText };
}

/* ============================================
   View wiring
   ============================================ */

function scanPanels() {
  return {
    capture: document.getElementById('scan-capture-panel'),
    preview: document.getElementById('scan-preview-panel'),
    progress: document.getElementById('scan-progress-panel'),
    results: document.getElementById('scan-results-panel'),
  };
}

function showScanPanel(name) {
  const panels = scanPanels();
  Object.keys(panels).forEach((k) => { panels[k].hidden = k !== name; });
}

function resetScanView() {
  scanState = { file: null, previewUrl: null, parsed: null };
  const fileInput = document.getElementById('scan-file-input');
  fileInput.value = '';
  showScanPanel('capture');
}

function handleScanFileChange(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;
  scanState.file = file;
  scanState.previewUrl = URL.createObjectURL(file);
  document.getElementById('scan-preview-img').src = scanState.previewUrl;
  showScanPanel('preview');
}

function setScanStatus(text) {
  document.getElementById('scan-status').textContent = text;
}

async function handleScanRead() {
  if (!scanState.file) return;
  showScanPanel('progress');
  setScanStatus('Loading OCR engine…');

  try {
    const [Tesseract, canvas] = await Promise.all([loadTesseract(), downscaleImageToCanvas(scanState.file)]);
    const { inverted } = preprocessCanvasForOcr(canvas);

    setScanStatus(inverted ? 'Reading label (light-on-dark detected)…' : 'Reading label (English + Dutch)…');
    const { data } = await Tesseract.recognize(canvas, 'eng+nld', {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          setScanStatus(`Reading label… ${Math.round(m.progress * 100)}%`);
        } else if (m.status && m.status.includes('loading')) {
          setScanStatus('Loading language data (first scan is slower)…');
        }
      },
    });

    const parsed = parseLabelText(data.text || '');
    scanState.parsed = parsed;
    renderScanResults(parsed);
    showScanPanel('results');
  } catch (err) {
    alert(`Couldn't read that label: ${err.message}\n\nYou can try a clearer photo, or add the food manually instead.`);
    showScanPanel('preview');
  }
}

function scanResultEls() {
  return {
    servingAmount: document.getElementById('scan-serving-amount'),
    servingUnit: document.getElementById('scan-serving-unit'),
    calories: document.getElementById('scan-calories'),
    protein: document.getElementById('scan-protein'),
    carbs: document.getElementById('scan-carbs'),
    fat: document.getElementById('scan-fat'),
    fiber: document.getElementById('scan-fiber'),
    sugar: document.getElementById('scan-sugar'),
    sodium: document.getElementById('scan-sodium'),
  };
}

/** Populates the editable results fields from the parse — blank (not 0) for anything not found, so it's obvious what needs a manual fill-in rather than looking like a confirmed zero. */
function renderScanResults(parsed) {
  const els = scanResultEls();
  const blank = (v) => (v === null || v === undefined ? '' : round(v));

  els.servingAmount.value = blank(parsed.servingAmount) === '' ? 100 : round(parsed.servingAmount);
  els.servingUnit.value = parsed.servingUnit || 'g';
  els.calories.value = blank(parsed.calories);
  els.protein.value = blank(parsed.protein);
  els.carbs.value = blank(parsed.carbs);
  els.fat.value = blank(parsed.fat);
  els.fiber.value = blank(parsed.fiber);
  els.sugar.value = blank(parsed.sugar);
  els.sodium.value = blank(parsed.sodium);

  document.getElementById('scan-salt-note').hidden = !parsed.sodiumFromSalt;
}

function numOrZero(input) {
  const v = parseFloat(input.value);
  return Number.isFinite(v) ? v : 0;
}

function handleScanUse() {
  const els = scanResultEls();
  const servingAmount = parseFloat(els.servingAmount.value) || 100;
  const servingUnit = els.servingUnit.value || 'g';
  const scaleTo100 = 100 / servingAmount;

  const syntheticItem = {
    source: 'ocr',
    name: '',
    default_serving: { amount: servingAmount, unit: servingUnit },
    calories_per_100: numOrZero(els.calories) * scaleTo100,
    protein_per_100: numOrZero(els.protein) * scaleTo100,
    carbs_per_100: numOrZero(els.carbs) * scaleTo100,
    fat_per_100: numOrZero(els.fat) * scaleTo100,
    fiber_per_100: numOrZero(els.fiber) * scaleTo100,
    sugar_per_100: numOrZero(els.sugar) * scaleTo100,
    sodium_mg_per_100: numOrZero(els.sodium) * scaleTo100,
  };

  openManualForm(syntheticItem);
}

function wireScanView() {
  document.getElementById('scan-file-input').addEventListener('change', handleScanFileChange);
  document.getElementById('scan-retake-btn').addEventListener('click', resetScanView);
  document.getElementById('scan-read-btn').addEventListener('click', handleScanRead);
  document.getElementById('scan-rescan-btn').addEventListener('click', resetScanView);
  document.getElementById('scan-use-btn').addEventListener('click', handleScanUse);
}

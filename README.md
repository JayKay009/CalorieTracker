# Plate — nutrition tracker

A free, static, no-login nutrition tracker: log food by photo (OCR reads the
label), by manual entry, or by weighing a whole meal straight off a kitchen
scale. Everything runs client-side and lives in the browser's IndexedDB — no
backend, no accounts, hosted for free on GitHub Pages. See
`nutrition-tracker-project-bible.md` in this same folder for the full
original spec, data model, and feature rationale.

**Status: feature-complete and working.** All planned features are built
and the core flows have been tested on real devices (Brave on Android
confirmed working after the fixes below). If you're picking this up in a
new conversation: the app works, this file plus the project bible should be
enough context to keep going — no need to re-explain the idea from scratch.

## What's built

- **English/Dutch language toggle**: a "Nederlands"/"English" button in the
  Today header. English is the default and is never written to storage;
  switching to Dutch saves that choice (localStorage), switching back to
  English just clears it. All UI text, dates, and the 21 built-in starter
  foods translate; anything scanned or typed in by hand keeps its own name
  regardless of language, since only starter foods carry a Dutch name
  alongside the English one. See "Adding or changing UI text" below if
  you're extending this.
- **Library**: add/edit/delete foods, stored as a per-100g (or per-100ml)
  baseline so any serving size scales consistently. Favorites, recently-used,
  and quick-add-meals tabs, plus search.
- **Household units**: g/oz/lb (exact weight conversions) and ml/tsp/tbsp/fl
  oz/cup (volume, approximated as 1ml≈1g — accurate for liquids, an
  approximation for things like flour or oil; grams/oz/lb are always exact).
- **Logging**: tap a library item to log an amount to today, optionally
  tagged with a meal (breakfast/lunch/dinner/snack). Live running totals on
  the Today screen, with an optional daily calorie goal.
- **Today log is fully interactive**: tap any entry to edit its amount/meal
  tag or delete it. Entries built or logged together (Meal Builder, or a
  saved quick-add meal) show as one consolidated, expandable card — tap it
  to open/close the per-item breakdown, tap a sub-item to edit or delete
  just that one, or delete the whole meal in one go.
- **Estimate a meal**: for food you have no way to weigh (a restaurant plate,
  for example), "Estimate a meal" on the Today screen logs a one-off entry
  from just a name and a rough calorie number (macros optional), tagged
  "Estimated" so it's visually distinct from measured entries. No library
  item gets created — it's a single log entry, not reusable.
- **Meal Builder** (`Build a meal`): add plate items straight from a kitchen
  scale reading without re-zeroing between them — it works out each item's
  real weight from the running total and flags likely zero-resets. Can save
  a built plate as a reusable "quick-add meal" (e.g. a daily coffee).
- **Scan / OCR**: photo of a label → Tesseract.js (English + Dutch) → parsed
  into the normal, fully editable add-food form. Nothing saves without
  review. Handles EU-style labels specifically: kcal vs. kJ disambiguation,
  salt→sodium conversion, decimal commas, Dutch noun inflections
  (vet/vetten, eiwit/eiwitten), and auto-inverts light-text-on-dark-background
  labels before OCR (color-agnostic, brightness-based).
- **History**: last 14 days of logged calories, as a bar list. Tap any day
  to open a detail sheet showing exactly what was logged that day — same
  totals readout and meal-group cards as the Today screen, just read-only
  (no editing from History; go to Today to fix an entry).
- **Backup**: export/import the whole database as a JSON file — the
  workaround for "no accounts," since data otherwise lives only in the
  current browser on the current device (this is a deliberate tradeoff, not
  a bug — see the project bible for the reasoning).
- Offline-capable (PWA + service worker, network-first with cache fallback)
  and installable to a phone home screen.

## Things worth knowing if you're debugging this

- **Adding or changing UI text**: strings live in `js/i18n.js`'s `STRINGS`
  dictionary (`en` and `nl`, always kept in parity — every key must exist in
  both). Static markup uses `data-i18n` / `data-i18n-placeholder` /
  `data-i18n-aria` / `data-i18n-label` attributes on the element in
  `index.html`; JS-generated text calls `t('key', ...args)`. Watch for one
  trap: `data-i18n` on an element that has a nested child element will wipe
  that child when translated (`el.textContent = ...` replaces everything
  inside) — put a separate `data-i18n` span on each piece of text instead of
  nesting them. Meal labels (breakfast/lunch/dinner/snack) are stored as
  fixed English keys in the data regardless of UI language; only their
  *display* is translated, via `mealLabelText()`, never the stored value.

- **OCR is heuristic text parsing**, not guaranteed-correct. It'll
  occasionally misread a character (a 'g' as a '9', a missed comma) — that's
  inherent to OCR and expected, not a bug to chase. What *is* worth fixing:
  if an entire nutrient keyword never matches (e.g. a language variant or
  inflection the regex doesn't know about) — that's a real parsing gap, and
  the fix is usually a one-line regex addition once you know which word.
- **The service worker is network-first** (tries network, falls back to
  cache only when offline). This was a deliberate fix after a cache-first
  version caused real, confusing "my changes aren't showing up" bugs during
  development — don't regress it back to cache-first.
- **IndexedDB version is currently 2** (see top of `js/db.js`). If you add a
  new object store in the future, bump `DB_VERSION` and add the store
  creation inside `onupgradeneeded` — existing users' data upgrades
  automatically, nothing is lost.
- **"Estimated" log entries** (`LogEntry.is_estimated`) are just a plain
  extra field on existing `logEntries` records, not a new store or index —
  no `DB_VERSION` bump was needed to add them. They have no `food_item_id`
  baseline to scale from, so editing one edits the calorie/macro numbers
  directly rather than an amount.
- **iOS Safari input zoom**: any input/select under 16px font-size makes
  Safari auto-zoom the page on focus — and (Apple's implementation) it
  doesn't zoom back out on blur, so the whole app stays zoomed until the
  person manually pinches back out. All form inputs are 16px+ now (`.field
  input`, `.field select`, `.search-bar input`); if you add a new input
  anywhere, keep it at 16px or larger for the same reason.
- **iOS Safari nested scroll**: a `max-height` + `flex-direction: column`
  container with an internal `overflow-y: auto` child (e.g. `.sheet--tall` /
  `.day-detail-list` for the History day-detail sheet) needs `overflow:
  hidden` on the outer container in Safari specifically, or it won't clip
  to `max-height` and the inner list won't actually get a scrollable area —
  content just spills past the screen edge with no way to scroll. Also add
  `-webkit-overflow-scrolling: touch` on the scrolling child for proper
  momentum scrolling. If you build another tall sheet/modal, follow the
  same pattern.
- Known iOS Safari issues fixed based on your report (input zoom, day-detail
  scroll — see above); not independently re-verified on a device, so flag it
  if either one is still off. Desktop Firefox/Safari still untested.

## Run it locally

No build step — it's plain HTML/CSS/JS. Just serve the folder (opening
`index.html` directly via `file://` will block IndexedDB in some browsers,
so use a local server):

```bash
cd nutrition-tracker
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder's contents to a GitHub repo (this folder = repo root).
2. In the repo: **Settings → Pages → Source** → select the `main` branch,
   `/ (root)` folder → Save.
3. GitHub gives you a URL like `https://<username>.github.io/<repo-name>/`
   within a minute or two.
4. Open that URL on your phone → your browser should offer **"Add to Home
   Screen"** (the `manifest.json` + `sw.js` here make it installable).

No environment variables, no secrets, no server config — it's just static
files. Updates should show up within seconds of a push and a reload (thanks
to the network-first service worker).

## File structure

```
nutrition-tracker/
  index.html                  views + nav shell
  css/style.css                design system (tokens at the top of the file)
  js/db.js                      IndexedDB wrapper — the whole data layer
  js/units.js                    household-unit conversion helpers
  js/starter-foods-data.js        built-in whole-foods reference database
  js/mealBuilder.js               plate-scale "Build a meal" logic
  js/settingsPanel.js              daily goals + backup export/import
  js/history.js                     past-days view
  js/ocr.js                          label capture + OCR parsing
  js/app.js                           navigation, Today, Library, manual form
  manifest.json                        PWA manifest
  sw.js                                  offline app-shell cache (network-first)
  icons/                                  app icon (svg + generated png sizes)
  nutrition-tracker-project-bible.md       original full spec
```

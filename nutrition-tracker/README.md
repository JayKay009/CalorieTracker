# Plate — nutrition tracker

Static, no-login, no-backend nutrition tracker. See `nutrition-tracker-project-bible.md`
(one level up / in the project docs) for the full spec, data model, and build phases.

## Run it locally

No build step — it's plain HTML/CSS/JS. Just serve the folder (opening `index.html`
directly via `file://` will block IndexedDB in some browsers, so use a local server):

```bash
cd nutrition-tracker
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repo and push this folder's contents to it (this folder = repo root).
2. In the repo: **Settings → Pages → Source** → select the `main` branch, `/ (root)` folder → Save.
3. GitHub gives you a URL like `https://<username>.github.io/<repo-name>/` within a minute or two.
4. Open that URL on your phone → your browser should offer **"Add to Home Screen"**
   (the `manifest.json` + `sw.js` here make it installable and give it an app icon).

No environment variables, no secrets, no server config — it's just static files.

## Project status

All planned features are built:

- **Library**: add/edit/delete foods, stored as a per-100g (or per-100ml)
  baseline so any serving size scales consistently. Favorite and
  recently-used tabs, search.
- **Household units**: g/oz/lb (exact weight conversions) and ml/tsp/tbsp/fl
  oz/cup (volume, approximated as 1ml≈1g — accurate for liquids, an
  approximation for things like flour or oil; grams are always exact).
- **Logging**: tap a library item to log an amount to today, optionally
  tagged with a meal (breakfast/lunch/dinner/snack). Live running totals on
  the Today screen, with an optional daily calorie goal.
- **Meal Builder** (`Build a meal`): add plate items straight from a kitchen
  scale reading without re-zeroing between them — it works out each item's
  real weight from the running total and flags likely zero-resets.
- **Scan / OCR**: photo of a label → Tesseract.js (English + Dutch) → parsed
  into the normal editable add-food form. Nothing saves without you
  reviewing it first. Handles EU-style labels specifically (kcal vs. kJ,
  salt→sodium conversion, decimal commas).
- **History**: last 14 days of logged calories.
- **Backup**: export/import the whole database as a JSON file — the
  workaround for "no accounts," since data otherwise lives only in the
  current browser on the current device.
- Offline-capable (PWA + service worker app-shell cache) and installable to
  a phone home screen.

Known simplification: Meal Builder items are tagged with a shared meal
group in the data, but the Today screen doesn't yet visually collapse them
into one block — they show individually with the same meal tag.

## File structure

```
nutrition-tracker/
  index.html                views + nav shell
  css/style.css              design system (tokens at the top of the file)
  js/db.js                    IndexedDB wrapper — the whole data layer
  js/units.js                  household-unit conversion helpers
  js/starter-foods-data.js      built-in whole-foods reference database
  js/mealBuilder.js             plate-scale "Build a meal" logic
  js/settingsPanel.js            daily goals + backup export/import
  js/history.js                   past-days view
  js/ocr.js                        label capture + OCR parsing
  js/app.js                         navigation, Today, Library, manual form
  manifest.json                      PWA manifest
  sw.js                                offline app-shell cache
  icons/                                app icon (svg + generated png sizes)
```

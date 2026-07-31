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

## Recent fixes (this round)

- **Service worker was serving stale files** — this is the important one.
  It used a cache-first strategy, so once a file was cached, updates on
  GitHub never showed up until `sw.js` itself changed bytes. Several rounds
  of fixes changed `app.js`/`ocr.js`/etc. without touching `sw.js`, so
  browsers that had already loaded the app kept serving old code
  indefinitely — this is almost certainly why Brave showed no changes even
  hours after a push. **Now network-first**: it always tries the network
  first and only falls back to the cache when there's no connection, so
  deploys show up immediately going forward. The cache name was also bumped
  to force a clean break from the old stale cache this one time.
  **If you're still on an old version after this update**: in Brave/Chrome,
  open the site → DevTools (F12) → Application tab → Service Workers →
  "Unregister", then hard-reload. Or simpler: clear browsing data for the
  site once.
- **Verified the save path against real IndexedDB** (via the `fake-indexeddb`
  test library, not just reasoning about the code) — every save function
  (new food, edit, favorite, mark-used, log entry, meal template) was
  individually tested and confirmed working correctly, including the exact
  "brand new item" case that produced the Chrome error.
- **OCR on light-text/dark-background labels**: images are now auto-converted
  to grayscale and inverted when dark-dominant, before OCR runs. This is
  color-agnostic (works on brightness, not any specific color) so it doesn't
  matter what the actual background color is.
- **Scan results are now directly editable** — no more "not found" dead
  ends; every field is a normal input, pre-filled where OCR found something,
  blank where it didn't, so you can just fill in the gaps and continue.
- **Meal Builder's food search no longer uses a native `<datalist>`** — it's
  a custom-built dropdown now, since `<datalist>` suggestion rendering is
  unreliable on several mobile browsers (notably Chrome on Android).
- **Saving a food now gives clear feedback** (a toast) and navigates home
  instead of silently landing back on the library. The save itself is also
  now wrapped in a verify-after-write check, so a real failure surfaces as
  an error message instead of failing silently.
- **Quick-add meals**: in Meal Builder, check "save as quick-add meal" to
  store the current plate as a named, reusable combo (e.g. "Morning
  coffee"). It shows up under the new **Meals** tab in the Library — tap it
  to log every item in one tap, using each food's current nutrition data.

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

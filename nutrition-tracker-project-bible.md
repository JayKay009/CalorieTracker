# Nutrition Tracker — Project Bible

## 1. Overview

A free, no-login website (hosted on GitHub Pages) for logging food and estimating calories/macros. Core idea: snap a photo of a nutrition label, let OCR pull the numbers, correct anything wrong by hand, and save the item for next time. Also supports foods with no label (fresh chicken breast, an apple, etc.) via a built-in reference database.

**Constraints that shape everything below:**
- Static hosting only (GitHub Pages) → no custom backend, no server-side code.
- No accounts → all data lives in the browser itself.
- Data must survive closing and reopening the browser (persist across sessions).
- Must work consistently across browsers (Chrome, Brave, Firefox, Safari) — but each browser stores its own separate copy of the data, since there's no server to sync through. This is the one real tradeoff of the "no backend" approach and is called out explicitly so it's a known decision, not a surprise later. (Item sharing, §3.10, is the manual workaround for moving individual items between browsers/devices/people without a backend.)

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Hosting | GitHub Pages | Free, matches "website on GitHub" requirement |
| Structure | Static HTML/CSS/JS, or a lightweight framework (e.g. plain JS or a small React build) | No server needed; GitHub Pages only serves static files |
| Storage | **IndexedDB** (via a small wrapper like `idb`) for food items, saved items, and logs; `localStorage` only for tiny settings/flags | IndexedDB handles structured data, larger volumes, and images (photos) far better than localStorage; both persist across browser sessions on the same browser |
| Offline/installable | PWA manifest + service worker | Lets the site be "added to home screen" on a phone and cached for offline use, without needing a native app |
| OCR | **Tesseract.js** (runs entirely client-side, no API key, no server) | Fits the no-backend constraint; avoids exposing any API key in public client code |
| Food reference data | Local JSON dataset (common whole foods: chicken breast, banana, rice, etc.), expandable over time; optionally the free **USDA FoodData Central** API for on-demand lookups | Keeps the app useful without user having to add every basic food from scratch |
| Charts/trends | A lightweight charting lib (e.g. Chart.js) | For daily/weekly calorie and macro trends |

---

## 2.1 Decisions Locked In (v1)

- **No daily goals in v1**, but the settings/data model leaves room to add optional calorie/macro targets later without restructuring anything. *(Superseded — see §3.6: per-macro daily goals are implemented, stored as individual settings keys so "no goal set" is just "key absent.")*
- **Track everything** (calories, protein, carbs, fat, fiber, sugar, sodium) from the start — but **calories is the headline number** everywhere in the UI (largest, always visible); the rest are secondary/detail-level.
- Visual style: open — Claude will propose a distinct direction rather than a generic template when building the UI.

---

## 3. Core Features

### 3.1 Label capture & OCR
- Take a photo (mobile camera input) or upload an image of a nutrition label.
- Run OCR (Tesseract.js) to extract calories, serving size, protein, carbs, fat, fiber, sugar, sodium.
- Show the parsed fields in an editable form **before** saving — nothing is saved silently. OCR is a first draft, not the final word.
- If OCR fails or the label is unreadable, fall back gracefully to a blank manual-entry form.

### 3.2 Manual entry & correction
- Every OCR result opens into a normal editable form (same form used for fully manual entries).
- Fields: name, brand (optional), serving size + unit, calories, protein, carbs, fat, fiber, sugar, sodium, photo (optional).
- Users can always add or edit an item entirely by hand — OCR is optional, not required.

### 3.3 Saved items / quick reference
- Every item entered (via OCR or manually) gets saved into a personal library, searchable by name.
- Logging a repeat food becomes a search + tap, not re-entry.
- Items can be edited or deleted from the library at any time.
- "Recently used" and "Favorites" shortcuts for the most common foods.
- Each library item also has a **Share** action (§3.10) for sending that one item to another person.

### 3.4 No-label / whole foods
- Built-in starter database of common single-ingredient foods (chicken breast, eggs, rice, banana, olive oil, etc.) with per-100g values.
- Users can add their own no-label foods the same way (manual entry form), which then join their personal library.
- Optional: look up additional whole foods via USDA FoodData Central when the local list doesn't have something.

### 3.5 Logging a meal / diary
- Add an item (from library or database) to "today," specifying quantity/servings.
- Quantity scales calories/macros automatically (like the recipe-scaling logic you'd expect).
- Ability to log multiple items as a single "meal" (e.g. breakfast = yogurt + Cruesli).
- Edit or delete any past log entry.

### 3.6 Daily/weekly summary
- Running total for the day: calories, protein, carbs, fat (and fiber/sugar/sodium if tracked).
- Optional personal daily targets (calorie/macro goals), set once in Settings, stored per-macro (`goal_calories`, `goal_protein`, `goal_carbs`, `goal_fat` — each independently optional).
- **Calories**: when a calorie goal is set, the "today" screen shows a line stating kcal remaining (or over) against the goal.
- **Macros**: each of the three macro pills (protein/carbs/fat) on the "today" screen also shows what **% of today's total macro calories** that macro represents — e.g. "112g · 27%" — always visible once anything is logged (hidden only when nothing's been logged yet today), and independent of any goal. Calculated calorie-weighted, matching how macro splits like "40/30/30" are conventionally expressed: `pct = macro's kcal / (protein_kcal + carbs_kcal + fat_kcal) * 100`, using 4 kcal/g for protein and carbs and 9 kcal/g for fat. Deliberately not a straight gram ratio — a gram of fat carries more than double the energy of a gram of protein/carbs, so a gram-based split would understate fat's real share of the day's energy. This is today-only; the history/day-detail view does not show percentages.
- Simple history view / chart of past days.

### 3.7 Data persistence & portability
- All data (library, logs, settings) stored in IndexedDB — persists across browser close/reopen automatically.
- **Export/Import**: a "Backup" button that exports all data as a JSON file, and an "Import" button to restore it. This is the manual workaround for moving data between browsers or devices, since there's no account system.
- Clear warning in-app: data is tied to *this browser on this device* — export before switching browsers/clearing site data.
- The same Import control also accepts single shared items (§3.10) — it detects which kind of file it's given.

### 3.8 Meal Builder ("plate mode")

For building a meal directly off a kitchen scale, one item at a time, without re-zeroing between every item.

**Session flow:**
1. Start a "Build a meal" session → running plate total starts at 0g.
2. For each food: pick it from the library/database (or enter new), then type in the current scale reading.
3. The app computes that item's actual weight using this rule:
   - If `reading ≥ running total` → scale was **not** re-zeroed → item weight = `reading − running total`.
   - If `reading < running total` → scale **was** re-zeroed (weight can't drop otherwise) → item weight = `reading` itself.
4. A per-item toggle, **"Scale was zeroed before this item"** (off by default, auto-set based on the rule above), lets the user correct the rare case where the auto-guess is wrong — e.g. zeroing before an item that happens to weigh more than the running total so far.
5. Each confirmed item updates the running total and appears in a live list (name + computed weight + calories) so the user can see the plate build up.
6. "Finish meal" saves all items to today's log at once, tagged with a shared `meal_group_id` so they display bundled together (e.g. "Lunch: bread, ham, tomato — 410 kcal total") instead of as scattered separate entries.

**Data model addition:**
- `LogEntry.meal_group_id` (optional) — links entries created in the same Meal Builder session.
- Meal Builder session state itself is transient (kept in memory / a temp IndexedDB record) until "Finish meal" converts it into real `LogEntry` rows.

### 3.9 Unit & portion handling
- Support both metric (g, ml) and common household units (tbsp, cup, oz) with conversion.
- Per-100g baseline stored internally; displayed serving size is just a view/multiplier over that baseline, so scaling is always consistent.

### 3.10 Sharing a single library item

Lets one user hand a specific food item (their OCR'd/manual entry) to another user, so the recipient doesn't have to re-enter it from scratch. No backend involved — it's a JSON file that travels however the users like (WhatsApp, email, AirDrop, USB, etc.) and is read back in through the existing Import control.

**Export (sender side):**
- A share icon on each library row builds a JSON payload containing just that item: `{ exportType: "plate_food_item", version: 1, exported_at, foodItem: {...} }`.
- `foodItem` is the item's data (name, brand, per-100g baseline, default serving, source) with personal/local-only fields stripped: no `id` (meaningless outside the sender's browser), no `created_at`/`updated_at`, no `favorite`, no `last_used_at`.
- If the browser supports the Web Share API with file attachments (`navigator.share`/`navigator.canShare` with a `File`), the native share sheet opens directly — "Share to WhatsApp" etc. Otherwise the file downloads normally and the user attaches it manually.

**Import (recipient side):**
- The existing "Import" control (§3.7) now inspects the file's `exportType` to decide what it's looking at:
  - `plate_food_item` → single-item import. Recipient is asked to confirm (shown the item's name); if an item with the same name already exists in their library, they're warned and can still choose to add it as a separate entry.
  - Full backup shape (`foodItems`/`logEntries`/`settings`) → existing merge-import behavior, unchanged.
- On import, a **fresh `id` is always minted** — the sender's id is never trusted, since it could collide with something already in the recipient's library. `favorite` resets to unset and `last_used_at` is dropped, since neither describes the recipient's usage.

**Platform notes (Android vs. iOS):**
- The core flow (file picker → JSON → Import) is identical everywhere; no platform restriction on it.
- The one-tap native share sheet works on Android Chrome and iOS Safari 16.4+.
- Registering the app as a **share target** — i.e. appearing as a destination when a file is shared *into* the app from another app like WhatsApp — is Android-only (Web Share Target API isn't available to iOS PWAs). Not implemented; treated as a nice-to-have, not a dependency. The "download → open Plate → tap Import → pick file" path is the universal fallback and works on every platform regardless.

---

## 4. Data Model (conceptual)

**FoodItem**
- id, name, brand (optional), source (`"ocr"` | `"manual"` | `"database"`), photo (optional, stored as blob/base64 in IndexedDB)
- baseline: per 100g (or 100ml) — calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg
- default_serving: amount + unit (e.g. "30 g", "1 cup")
- favorite (bool), last_used_at (optional)
- created_at, updated_at

**LogEntry**
- id, food_item_id, date, meal_label (breakfast/lunch/dinner/snack — optional), meal_group_id (optional, see §3.8), quantity, unit, calculated totals (derived from FoodItem baseline × quantity)

**UserSettings**
- daily targets, stored per-macro and independently optional: `goal_calories`, `goal_protein`, `goal_carbs`, `goal_fat`
- units preference (metric/imperial default)

**Shared-item export file (transient, not stored — see §3.10)**
- `{ exportType: "plate_food_item", version, exported_at, foodItem }` where `foodItem` is a FoodItem stripped of `id`, `created_at`, `updated_at`, `favorite`, `last_used_at`.

---

## 5. Non-Functional Requirements

- **Cross-browser correctness**: test on Chrome, Brave, Firefox, Safari (desktop + mobile) — IndexedDB and camera input APIs are all standard, but camera permission UX differs slightly by browser, so this needs real device testing, not just assumption. The Web Share API (used for item sharing, §3.10) is treated as progressively-enhanced, not assumed: every browser that lacks it falls back to a plain file download.
- **Mobile-first responsive design**: this will primarily be opened on a phone.
- **Offline-friendly**: once loaded, logging/searching should work without a network connection (service worker caching); OCR already runs fully offline since Tesseract.js is client-side.
- **Privacy**: since there's no backend, no food/photo data ever leaves the user's device unless the user explicitly shares an item themselves (§3.10) — worth stating in-app as a feature, not just a limitation.
- **Performance**: OCR (Tesseract.js) can be slow-ish for a full-res photo — plan to downscale images before running OCR to keep it fast on a phone.

---

## 6. Known Tradeoffs (explicit, not hidden)

1. **No automatic cross-browser/cross-device sync.** Data lives per-browser. Mitigated two ways: full-library JSON export/import (§3.7) for moving your own data between your own browsers/devices, and single-item sharing (§3.10) for handing one item to someone else. Both are manual/explicit, not background sync. A future upgrade path (if ever wanted) would be adding a free-tier backend (e.g. Firebase) purely for optional sync — not in scope now.
2. **OCR accuracy varies** with photo quality/lighting/label design — this is why manual correction is a first-class part of the flow, not an edge case.
3. **GitHub Pages is static-only** — anything that seems to need a server (e.g. calling a paid API with a private key) isn't possible without exposing the key publicly. We're sidestepping this by choosing client-side OCR and free/keyless or public-key-safe data sources.
4. **Item sharing has no one-tap "receive" path on iOS.** Android can register the app as a share target so a file shared from WhatsApp can open directly into Plate's import; iOS has no equivalent API, so iOS recipients always go through a manual "save attachment → open Plate → tap Import" sequence. Not a blocker, just a small extra step on iOS.

---

## 7. Build Phases (suggested order)

1. **Skeleton**: static site shell, PWA manifest, mobile-responsive layout, GitHub Pages deploy working end-to-end.
2. **Manual entry + library + IndexedDB**: get the core data layer solid first (add/edit/delete FoodItems, save to IndexedDB, confirm persistence across a browser restart).
3. **Logging + daily summary**: add today's log, quantity scaling, daily totals.
4. **Starter whole-foods database**: seed common no-label foods.
5. **OCR capture flow**: camera/photo input → Tesseract.js → editable form → save.
6. **Export/Import backup**.
7. **Polish**: charts/trends, favorites, offline caching, settings/goals.
8. **Item sharing** (§3.10): per-item share export + Import format detection. *(Built.)*
9. **Macro calorie-split percentages** (§3.6): calorie-weighted % breakdown per macro on the "today" screen, independent of goals. *(Built.)*

---

## 8. Hosting

**GitHub Pages** works and is fine to go with — the whole app is static (HTML/CSS/JS) with all storage happening client-side in the browser (IndexedDB), so there's nothing about it that needs a "real" backend host. Free, HTTPS by default, custom domain supported if ever wanted, deploys straight from the repo.

Worth knowing about alternatives, since they're equally free and a couple of small conveniences might matter:

| | GitHub Pages | Netlify / Vercel | Cloudflare Pages |
|---|---|---|---|
| Cost | Free | Free tier | Free tier |
| Deploy | Push to repo (+ GitHub Actions for anything beyond plain static) | Push to repo, auto-detected | Push to repo, auto-detected |
| Preview deploys per branch/PR | Not built-in | Yes | Yes |
| Custom domain + HTTPS | Yes | Yes | Yes |
| CDN speed | Good | Good | Generally the fastest edge network |

None of this changes the app itself — same code runs anywhere. The only real reason to pick Netlify/Vercel/Cloudflare Pages over GitHub Pages is the automatic preview link for every branch/pull request, which is a nice-to-have while iterating but not a must-have. Given you already said GitHub, **GitHub Pages is the plan** unless you'd rather have preview deploys — happy to switch any time since it's a non-breaking change (just where the same files get served from).

## 9. Open Questions

- None blocking. Possible future nice-to-haves noted but explicitly out of scope for now: Android share-target registration for item sharing (§3.10, §6.4), optional backend sync (§6.1).

/**
 * i18n.js — a small, hand-rolled translation layer. No framework: strings
 * live in the STRINGS dictionary below, static markup is tagged with
 * data-i18n(-placeholder|-aria) attributes, and dynamic strings built in JS
 * call t('key') the same way this file's own helpers do.
 *
 * Persistence: only the non-default language is ever written to storage.
 * English is the default, so switching *to* Dutch saves 'nl'; switching
 * back to English just removes the saved key rather than writing 'en' —
 * next load falls back to the (English) default either way, but this keeps
 * localStorage empty for the common case, per the original ask.
 */

const LANG_STORAGE_KEY = 'plate_lang';
let currentLang = 'en';

const STRINGS = {
  en: {
    // Language toggle
    langToggleToNl: 'Nederlands',
    langToggleToEn: 'English',

    // Today view
    todayEyebrow: 'Today',
    settingsAria: 'Settings',
    caloriesReadoutLabel: 'calories',
    macroProtein: 'protein',
    macroCarbs: 'carbs',
    macroFat: 'fat',
    scanLabelTile: 'Scan label',
    libraryTile: 'Library',
    buildMealTile: 'Build a meal',
    addManuallyTile: 'Add manually',
    estimateMealTile: 'Estimate a meal',
    estimateMealSub: 'no scale needed — just enter a rough calorie count',
    loggedTodayLabel: 'Logged today',
    todayEmptyState: 'Nothing logged yet. Use one of the actions above to add your first item.',

    // Library view
    libraryEyebrow: 'Your foods',
    libraryHeading: 'Library',
    addItemAria: 'Add item',
    librarySearchPlaceholder: 'Search saved foods…',
    tabAll: 'All',
    tabFavorites: '★ Favorites',
    tabRecent: 'Recent',
    tabMeals: 'Meals',
    libraryHint: 'Tap a food to log it to today. Use the star to favorite, the pencil to edit.',
    libraryEmptyState: 'Your library is empty. Anything you scan or add manually will be saved here for quick reuse.',
    noMatchingFoods: 'No matching foods in your library.',
    perServing: (amount, unit) => `per ${amount}${unit}`,
    toggleFavoriteAria: 'Toggle favorite',
    editFoodAria: 'Edit food',
    noFavoritesEmpty: 'No favorites yet. Tap the star on any food to add it here.',
    noRecentEmpty: "Nothing logged yet — foods you've used will show up here.",
    noMealsEmpty: 'No quick-add meals yet. Build one in "Build a meal" and check "save as quick-add meal".',
    mealsHint: 'Tap a meal to log all its items to today instantly. Use the trash icon to remove it.',
    noMatches: 'No matches.',
    deleteMealTemplateAria: 'Delete this quick-add meal',

    // Shared: meal labels / field words
    mealLabel: 'Meal',
    optional: '(optional)',
    optionalShort: 'optional',
    noLabelOption: 'No label',
    breakfastOption: 'Breakfast',
    lunchOption: 'Lunch',
    dinnerOption: 'Dinner',
    snackOption: 'Snack',
    cancel: 'Cancel',
    itemFallbackName: 'Item',
    mealFallbackLabel: 'Meal',
    itemsSuffix: 'items',
    estimatedBadge: 'Estimated',
    deleteWholeMealAria: 'Delete this whole meal',
    deleteThisItemAria: 'Delete this item',

    // Log-from-library sheet
    logSheetAria: 'Log this food',
    amountEatenLabel: 'Amount eaten',
    addToTodaysLog: "Add to today's log",
    editThisFoodInstead: 'Edit this food instead',

    // Entry edit / estimate sheet
    entrySheetAria: 'Log entry',
    editEntryEyebrow: 'Edit entry',
    editEstimatedEntryEyebrow: 'Edit estimated entry',
    estimateMealEyebrow: 'Estimate a meal',
    whatWasItLabel: 'What was it?',
    restaurantPlaceholder: 'e.g. Restaurant steak, fries & a Sprite',
    roughCaloriesLabel: 'Roughly how many calories?',
    proteinGLabel: 'Protein (g)',
    carbsGLabel: 'Carbs (g)',
    fatGLabel: 'Fat (g)',
    saveChanges: 'Save changes',
    deleteEntry: 'Delete entry',
    estimatedHint: 'Logged as "Estimated" — this uses the number you enter directly, rather than scaling from a saved food. A good use for a meal you had no way to weigh, like something ordered at a restaurant.',
    amountError: 'Enter an amount greater than 0.',
    nameRequiredError: 'Give this meal a name.',
    caloriesRequiredError: 'Enter a rough calorie count greater than 0.',
    addedToTodaysLogToast: 'Added to today\u2019s log',
    savedChangesToast: 'Saved changes',
    deleteEntryConfirm: 'Delete this entry?',
    deleteMealConfirm: (n) => `Delete this whole meal (${n} item${n === 1 ? '' : 's'})? This can't be undone.`,
    removeMealTemplateConfirm: 'Remove this quick-add meal? This does not affect anything already logged.',
    removeFoodConfirm: 'Remove this food from your library? This does not affect anything already logged.',

    // Scan view
    addItemEyebrow: 'Add item',
    scanLabelHeading: 'Scan label',
    captureTileText: 'Take a photo or choose an image of the nutrition label',
    captureHint: 'Fill the frame with just the nutrition facts panel and keep it flat and well-lit for the best read.',
    readLabelBtn: 'Read label',
    retakePhotoBtn: 'Choose a different photo',
    resultsHeading: "Here's what was read off the label",
    reviewHint: 'Fix anything that\u2019s wrong or missing below — nothing is saved until the next screen.',
    servingSizeLabel: 'Serving size',
    unitLabel: 'Unit',
    weightOptgroup: 'Weight',
    volumeOptgroup: 'Volume',
    caloriesLabel: 'Calories',
    fiberGLabel: 'Fiber (g)',
    sugarGLabel: 'Sugar (g)',
    sodiumMgLabel: 'Sodium (mg)',
    saltNote: 'Sodium was estimated from a salt/zout reading (salt g × 400) — double-check this one.',
    continueToSave: 'Continue to save',
    tryDifferentPhoto: 'Try a different photo',
    preferTyping: 'Prefer typing it in?',
    addManuallyInstead: 'Add manually instead',
    ocrLoadingEngine: 'Loading OCR engine…',
    ocrReadingInverted: 'Reading label (light-on-dark detected)…',
    ocrReadingNormal: 'Reading label (English + Dutch)…',
    ocrReadingProgress: (pct) => `Reading label… ${pct}%`,
    ocrLoadingLangData: 'Loading language data (first scan is slower)…',
    ocrReadFailed: (msg) => `Couldn't read that label: ${msg}\n\nYou can try a clearer photo, or add the food manually instead.`,

    // Build a meal view
    plateModeEyebrow: 'Plate mode',
    buildMealHeading: 'Build a meal',
    buildMealHint: "Put the plate on the scale. Add one food at a time and type in whatever the scale reads — no need to zero between items, Plate will work out each item's weight from the running total. It'll flag if a reading looks like it was zeroed (lower than expected) so you can confirm or correct it.",
    foodLabel: 'Food',
    searchLibraryPlaceholder: 'Search your library…',
    scaleReadingLabel: 'Scale reading (g)',
    scaleReadingPlaceholder: 'e.g. 142',
    scaleZeroedCheckbox: 'Scale was zeroed before this item',
    addToPlateBtn: 'Add to plate',
    onThePlateLabel: 'On the plate',
    plateEmptyState: 'Nothing added yet.',
    plateTotalLabel: 'Plate total',
    saveAsMealCheckbox: 'Also save this as a quick-add meal (e.g. "Morning coffee")',
    mealNamePlaceholder: 'Name this meal…',
    finishMealBtn: "Finish meal — add to today's log",
    cancelMealBtn: 'Cancel and discard plate',
    plateItemErrorGeneric: 'Pick a valid food and a scale reading before adding it to the plate.',
    plateItemErrorMealName: 'Give the quick-add meal a name, or uncheck "save as quick-add meal".',
    platePickFoodPrompt: 'Pick a food from the list below (type to search).',
    platePreviewEnterReading: (name) => `${name} — enter the scale reading`,
    plateInvalidWeight: "That reading doesn't work out to a positive weight — check the toggle above.",
    platePreviewLine: (name, weight, kcal, zeroed) => `${name} — ${weight}g · ${kcal} kcal${zeroed ? ' (scale was zeroed)' : ''}`,
    zeroedChip: 'zeroed',
    removeFromPlateAria: 'Remove from plate',
    discardPlateConfirm: 'Discard everything on the plate?',
    savedMealTemplateToast: (name) => `Saved "${name}" as a quick-add meal`,
    mealLoggedToast: 'Meal logged.',
    templateLogFailedAlert: (name) => `Couldn't log "${name}" — the foods it used seem to have been removed from your library.`,
    templateLogPartialToast: (name, logged, total) => `Logged "${name}" (${logged}/${total} items — some were missing)`,
    templateLoggedToast: (name) => `Logged "${name}"`,

    // Manual entry / food form view
    newFoodHeading: 'New food',
    editingEyebrow: 'Editing',
    editFoodHeading: 'Edit food',
    fromScanEyebrow: 'Check the numbers',
    fromScanHeading: 'From scan',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Chicken breast, raw',
    brandLabel: 'Brand',
    brandPlaceholder: 'e.g. Jordans',
    weightExactOptgroup: 'Weight — exact',
    volumeApproxOptgroup: 'Volume — approximate for non-liquids',
    unitHintDefault: 'Values below are for this serving size.',
    macrosSectionLabel: 'Macros (grams per serving)',
    proteinLabel: 'Protein',
    carbsLabel: 'Carbs',
    fatLabel: 'Fat',
    fiberLabel: 'Fiber',
    sugarLabel: 'Sugar',
    saveToLibraryBtn: 'Save to library',
    deleteFromLibraryBtn: 'Delete from library',
    formErrorRequired: 'Name, a serving size greater than 0, and calories are required.',
    formErrorSaveFail: (msg) => `Couldn't save this food: ${msg}. Please try again.`,
    saveDidNotStick: 'Save did not stick — please try again.',
    savedChangesToToast: (name) => `Saved changes to ${name}`,
    addedToLibraryToast: (name) => `Added "${name}" to your library`,

    // Settings view
    preferencesEyebrow: 'Preferences',
    settingsHeading: 'Settings',
    viewHistoryBtn: 'View history',
    languageLabel: 'Language',
    dailyGoalsLabel: 'Daily goals',
    goalsOffByDefault: '(optional — off by default)',
    noneSetPlaceholder: 'none set',
    saveGoalsBtn: 'Save goals',
    clearGoalsBtn: 'Clear all goals',
    backupLabel: 'Backup',
    backupHint: 'Everything lives only in this browser on this device. Export a backup before switching browsers, switching devices, or clearing site data — and import it to restore.',
    exportBtn: 'Export backup (.json)',
    importBtn: 'Import backup',
    goalsSaved: 'Goals saved.',
    goalsCleared: 'Goals cleared.',
    backupDownloaded: 'Backup downloaded.',
    backupImported: 'Backup imported.',
    notAPlateBackup: "This file doesn't look like a Plate backup.",
    importConfirm: (foods, logs) => `Import ${foods} library items and ${logs} log entries? This merges with what's already here (matching IDs get overwritten).`,
    importFailed: (msg) => `Import failed: ${msg}`,

    // Sharing a single item
    shareFoodAria: 'Share this item',
    shareLabel: 'Sharing items',
    shareHint: 'Use the share icon on any item in your Library to send it to someone else — over WhatsApp, email, AirDrop, or however you like. They open Plate, tap Import above, and pick the file to add it to their own library.',
    itemShareDownloaded: 'Item saved as a file — attach it in WhatsApp, email, etc.',
    importItemConfirm: (name) => `Add "${name}" to your library?`,
    importItemConfirmDuplicate: (name) => `You already have an item called "${name}". Add this one anyway as a separate entry?`,
    itemImported: (name) => `"${name}" added to your library.`,

    // History view
    pastDaysEyebrow: 'Past days',
    historyHeading: 'History',
    tapDayHint: 'Tap a day to see what was logged.',
    todayLabel: 'Today',
    loggedThatDayEyebrow: 'Logged that day',
    dayEmptyState: 'Nothing was logged this day.',
    kcalLeftOfGoal: (remaining, goal) => `${remaining} kcal left of ${goal} goal`,
    kcalOverGoal: (over, goal) => `${over} kcal over ${goal} goal`,

    // Bottom nav
    navLibrary: 'Library',
    navScan: 'Scan',
    navMore: 'More',
  },

  nl: {
    langToggleToNl: 'Nederlands',
    langToggleToEn: 'English',

    todayEyebrow: 'Vandaag',
    settingsAria: 'Instellingen',
    caloriesReadoutLabel: 'calorieën',
    macroProtein: 'eiwit',
    macroCarbs: 'koolhydraten',
    macroFat: 'vet',
    scanLabelTile: 'Label scannen',
    libraryTile: 'Bibliotheek',
    buildMealTile: 'Maaltijd samenstellen',
    addManuallyTile: 'Handmatig toevoegen',
    estimateMealTile: 'Maaltijd schatten',
    estimateMealSub: 'geen weegschaal nodig — voer gewoon een ruwe schatting van de calorieën in',
    loggedTodayLabel: 'Vandaag gelogd',
    todayEmptyState: 'Nog niets gelogd. Gebruik een van de acties hierboven om je eerste item toe te voegen.',

    libraryEyebrow: 'Jouw voeding',
    libraryHeading: 'Bibliotheek',
    addItemAria: 'Item toevoegen',
    librarySearchPlaceholder: 'Opgeslagen voeding zoeken…',
    tabAll: 'Alles',
    tabFavorites: '★ Favorieten',
    tabRecent: 'Recent',
    tabMeals: 'Maaltijden',
    libraryHint: 'Tik op een voedingsmiddel om het naar vandaag te loggen. Gebruik de ster om te favorieten, het potlood om te bewerken.',
    libraryEmptyState: 'Je bibliotheek is leeg. Alles wat je scant of handmatig toevoegt, wordt hier opgeslagen voor snel hergebruik.',
    noMatchingFoods: 'Geen overeenkomende voeding in je bibliotheek.',
    perServing: (amount, unit) => `per ${amount}${unit}`,
    toggleFavoriteAria: 'Favoriet aan/uit',
    editFoodAria: 'Voedingsmiddel bewerken',
    noFavoritesEmpty: 'Nog geen favorieten. Tik op de ster bij een voedingsmiddel om het hier toe te voegen.',
    noRecentEmpty: 'Nog niets gelogd — voeding die je hebt gebruikt verschijnt hier.',
    noMealsEmpty: 'Nog geen snel-toevoegen-maaltijden. Stel er een samen in "Maaltijd samenstellen" en vink "opslaan als snel-toevoegen-maaltijd" aan.',
    mealsHint: 'Tik op een maaltijd om direct alle items naar vandaag te loggen. Gebruik het prullenbakicoon om te verwijderen.',
    noMatches: 'Geen resultaten.',
    deleteMealTemplateAria: 'Deze snel-toevoegen-maaltijd verwijderen',

    mealLabel: 'Maaltijd',
    optional: '(optioneel)',
    optionalShort: 'optioneel',
    noLabelOption: 'Geen label',
    breakfastOption: 'Ontbijt',
    lunchOption: 'Lunch',
    dinnerOption: 'Diner',
    snackOption: 'Tussendoortje',
    cancel: 'Annuleren',
    itemFallbackName: 'Item',
    mealFallbackLabel: 'Maaltijd',
    itemsSuffix: 'items',
    estimatedBadge: 'Geschat',
    deleteWholeMealAria: 'Deze hele maaltijd verwijderen',
    deleteThisItemAria: 'Dit item verwijderen',

    logSheetAria: 'Dit voedingsmiddel loggen',
    amountEatenLabel: 'Gegeten hoeveelheid',
    addToTodaysLog: 'Toevoegen aan logboek van vandaag',
    editThisFoodInstead: 'Dit voedingsmiddel bewerken',

    entrySheetAria: 'Item loggen',
    editEntryEyebrow: 'Item bewerken',
    editEstimatedEntryEyebrow: 'Geschat item bewerken',
    estimateMealEyebrow: 'Maaltijd schatten',
    whatWasItLabel: 'Wat was het?',
    restaurantPlaceholder: 'bijv. Restaurant steak, friet & een Sprite',
    roughCaloriesLabel: 'Ruwweg hoeveel calorieën?',
    proteinGLabel: 'Eiwit (g)',
    carbsGLabel: 'Koolhydraten (g)',
    fatGLabel: 'Vet (g)',
    saveChanges: 'Wijzigingen opslaan',
    deleteEntry: 'Item verwijderen',
    estimatedHint: 'Gelogd als "Geschat" — dit gebruikt het getal dat je zelf invoert, in plaats van te schalen vanaf een opgeslagen voedingsmiddel. Handig voor een maaltijd die je niet kon wegen, zoals iets besteld in een restaurant.',
    amountError: 'Voer een hoeveelheid groter dan 0 in.',
    nameRequiredError: 'Geef deze maaltijd een naam.',
    caloriesRequiredError: 'Voer een ruwe schatting van de calorieën groter dan 0 in.',
    addedToTodaysLogToast: 'Toegevoegd aan logboek van vandaag',
    savedChangesToast: 'Wijzigingen opgeslagen',
    deleteEntryConfirm: 'Dit item verwijderen?',
    deleteMealConfirm: (n) => `Deze hele maaltijd verwijderen (${n} item${n === 1 ? '' : 's'})? Dit kan niet ongedaan worden gemaakt.`,
    removeMealTemplateConfirm: 'Deze snel-toevoegen-maaltijd verwijderen? Dit heeft geen invloed op wat al gelogd is.',
    removeFoodConfirm: 'Dit voedingsmiddel uit je bibliotheek verwijderen? Dit heeft geen invloed op wat al gelogd is.',

    addItemEyebrow: 'Item toevoegen',
    scanLabelHeading: 'Label scannen',
    captureTileText: 'Maak een foto of kies een afbeelding van het voedingswaardelabel',
    captureHint: 'Vul het kader met alleen het voedingswaardepaneel en houd het plat en goed belicht voor de beste leesresultaten.',
    readLabelBtn: 'Label lezen',
    retakePhotoBtn: 'Kies een andere foto',
    resultsHeading: 'Dit is er van het label gelezen',
    reviewHint: 'Corrigeer hieronder alles wat fout is of ontbreekt — er wordt niets opgeslagen tot het volgende scherm.',
    servingSizeLabel: 'Portiegrootte',
    unitLabel: 'Eenheid',
    weightOptgroup: 'Gewicht',
    volumeOptgroup: 'Volume',
    caloriesLabel: 'Calorieën',
    fiberGLabel: 'Vezels (g)',
    sugarGLabel: 'Suiker (g)',
    sodiumMgLabel: 'Natrium (mg)',
    saltNote: 'Natrium is geschat op basis van een zout-waarde (zout g × 400) — controleer dit nog even.',
    continueToSave: 'Doorgaan om op te slaan',
    tryDifferentPhoto: 'Probeer een andere foto',
    preferTyping: 'Liever handmatig invoeren?',
    addManuallyInstead: 'Handmatig toevoegen',
    ocrLoadingEngine: 'OCR-engine laden…',
    ocrReadingInverted: 'Label lezen (licht-op-donker gedetecteerd)…',
    ocrReadingNormal: 'Label lezen (Engels + Nederlands)…',
    ocrReadingProgress: (pct) => `Label lezen… ${pct}%`,
    ocrLoadingLangData: 'Taalgegevens laden (eerste scan is trager)…',
    ocrReadFailed: (msg) => `Kon dat label niet lezen: ${msg}\n\nProbeer een duidelijkere foto, of voeg het voedingsmiddel handmatig toe.`,

    plateModeEyebrow: 'Bordmodus',
    buildMealHeading: 'Maaltijd samenstellen',
    buildMealHint: 'Zet het bord op de weegschaal. Voeg één voedingsmiddel per keer toe en typ in wat de weegschaal aangeeft — je hoeft niet te nulzetten tussen items, Plate berekent het gewicht van elk item op basis van het lopende totaal. Als een aflezing eruitziet alsof er is genuld (lager dan verwacht), krijg je een melding om te bevestigen of te corrigeren.',
    foodLabel: 'Voedingsmiddel',
    searchLibraryPlaceholder: 'Zoek in je bibliotheek…',
    scaleReadingLabel: 'Weegschaal aflezing (g)',
    scaleReadingPlaceholder: 'bijv. 142',
    scaleZeroedCheckbox: 'Weegschaal was op nul gezet vóór dit item',
    addToPlateBtn: 'Toevoegen aan bord',
    onThePlateLabel: 'Op het bord',
    plateEmptyState: 'Nog niets toegevoegd.',
    plateTotalLabel: 'Totaal van het bord',
    saveAsMealCheckbox: 'Ook opslaan als snel-toevoegen-maaltijd (bijv. "Ochtendkoffie")',
    mealNamePlaceholder: 'Naam voor deze maaltijd…',
    finishMealBtn: 'Maaltijd afronden — toevoegen aan logboek van vandaag',
    cancelMealBtn: 'Annuleren en bord verwijderen',
    plateItemErrorGeneric: 'Kies een geldig voedingsmiddel en een weegschaal-aflezing voordat je het aan het bord toevoegt.',
    plateItemErrorMealName: 'Geef de snel-toevoegen-maaltijd een naam, of vink "opslaan als snel-toevoegen-maaltijd" uit.',
    platePickFoodPrompt: 'Kies een voedingsmiddel uit de lijst hieronder (typ om te zoeken).',
    platePreviewEnterReading: (name) => `${name} — voer de weegschaal-aflezing in`,
    plateInvalidWeight: 'Die aflezing komt niet uit op een positief gewicht — controleer de schakelaar hierboven.',
    platePreviewLine: (name, weight, kcal, zeroed) => `${name} — ${weight}g · ${kcal} kcal${zeroed ? ' (weegschaal was op nul gezet)' : ''}`,
    zeroedChip: 'genuld',
    removeFromPlateAria: 'Van bord verwijderen',
    discardPlateConfirm: 'Alles op het bord verwijderen?',
    savedMealTemplateToast: (name) => `"${name}" opgeslagen als snel-toevoegen-maaltijd`,
    mealLoggedToast: 'Maaltijd gelogd.',
    templateLogFailedAlert: (name) => `Kon "${name}" niet loggen — de voeding die hierbij hoorde lijkt uit je bibliotheek verwijderd.`,
    templateLogPartialToast: (name, logged, total) => `"${name}" gelogd (${logged}/${total} items — sommige ontbraken)`,
    templateLoggedToast: (name) => `"${name}" gelogd`,

    newFoodHeading: 'Nieuw voedingsmiddel',
    editingEyebrow: 'Bewerken',
    editFoodHeading: 'Voedingsmiddel bewerken',
    fromScanEyebrow: 'Controleer de waarden',
    fromScanHeading: 'Van scan',
    nameLabel: 'Naam',
    namePlaceholder: 'bijv. Kipfilet, rauw',
    brandLabel: 'Merk',
    brandPlaceholder: 'bijv. Jordans',
    weightExactOptgroup: 'Gewicht — exact',
    volumeApproxOptgroup: 'Volume — geschat voor niet-vloeistoffen',
    unitHintDefault: 'Onderstaande waarden gelden voor deze portiegrootte.',
    macrosSectionLabel: "Macro's (gram per portie)",
    proteinLabel: 'Eiwit',
    carbsLabel: 'Koolhydraten',
    fatLabel: 'Vet',
    fiberLabel: 'Vezels',
    sugarLabel: 'Suiker',
    saveToLibraryBtn: 'Opslaan in bibliotheek',
    deleteFromLibraryBtn: 'Verwijderen uit bibliotheek',
    formErrorRequired: 'Naam, een portiegrootte groter dan 0, en calorieën zijn verplicht.',
    formErrorSaveFail: (msg) => `Kon dit voedingsmiddel niet opslaan: ${msg}. Probeer het opnieuw.`,
    saveDidNotStick: 'Opslaan is niet gelukt — probeer het opnieuw.',
    savedChangesToToast: (name) => `Wijzigingen opgeslagen voor ${name}`,
    addedToLibraryToast: (name) => `"${name}" toegevoegd aan je bibliotheek`,

    preferencesEyebrow: 'Voorkeuren',
    settingsHeading: 'Instellingen',
    viewHistoryBtn: 'Geschiedenis bekijken',
    languageLabel: 'Taal',
    dailyGoalsLabel: 'Dagelijkse doelen',
    goalsOffByDefault: '(optioneel — standaard uit)',
    noneSetPlaceholder: 'niet ingesteld',
    saveGoalsBtn: 'Doelen opslaan',
    clearGoalsBtn: 'Alle doelen wissen',
    backupLabel: 'Back-up',
    backupHint: 'Alles staat alleen in deze browser op dit apparaat. Exporteer een back-up voordat je van browser of apparaat wisselt, of sitegegevens wist — en importeer om te herstellen.',
    exportBtn: 'Back-up exporteren (.json)',
    importBtn: 'Back-up importeren',
    goalsSaved: 'Doelen opgeslagen.',
    goalsCleared: 'Doelen gewist.',
    backupDownloaded: 'Back-up gedownload.',
    backupImported: 'Back-up geïmporteerd.',
    notAPlateBackup: 'Dit bestand lijkt geen Plate-back-up te zijn.',
    importConfirm: (foods, logs) => `${foods} bibliotheekitems en ${logs} logboekitems importeren? Dit wordt samengevoegd met wat er al is (overeenkomende ID's worden overschreven).`,
    importFailed: (msg) => `Importeren mislukt: ${msg}`,

    // Eén item delen
    shareFoodAria: 'Dit item delen',
    shareLabel: 'Items delen',
    shareHint: 'Gebruik het deel-icoon bij een item in je Bibliotheek om het naar iemand anders te sturen — via WhatsApp, e-mail, AirDrop, of wat je maar wilt. Diegene opent Plate, tikt hierboven op Importeren en kiest het bestand om het aan hun eigen bibliotheek toe te voegen.',
    itemShareDownloaded: 'Item opgeslagen als bestand — voeg het toe in WhatsApp, e-mail, enz.',
    importItemConfirm: (name) => `"${name}" toevoegen aan je bibliotheek?`,
    importItemConfirmDuplicate: (name) => `Je hebt al een item met de naam "${name}". Dit item toch toevoegen als apart item?`,
    itemImported: (name) => `"${name}" is toegevoegd aan je bibliotheek.`,

    pastDaysEyebrow: 'Vorige dagen',
    historyHeading: 'Geschiedenis',
    tapDayHint: 'Tik op een dag om te zien wat er gelogd is.',
    todayLabel: 'Vandaag',
    loggedThatDayEyebrow: 'Gelogd die dag',
    dayEmptyState: 'Er is deze dag niets gelogd.',
    kcalLeftOfGoal: (remaining, goal) => `Nog ${remaining} kcal te gaan (doel ${goal})`,
    kcalOverGoal: (over, goal) => `${over} kcal boven doel van ${goal}`,

    navLibrary: 'Bibliotheek',
    navScan: 'Scannen',
    navMore: 'Meer',
  },
};

/** Looks up a string (or calls it, if it's a template function) in the current language, falling back to English. */
function t(key, ...args) {
  const entry = (STRINGS[currentLang] && STRINGS[currentLang][key]) ?? STRINGS.en[key] ?? key;
  return typeof entry === 'function' ? entry(...args) : entry;
}

/** For select <option> values that are stored in English regardless of UI language (breakfast/lunch/dinner/snack). */
function mealLabelText(value) {
  if (!value) return '';
  const key = `${value}Option`;
  return STRINGS[currentLang] && STRINGS[currentLang][key] ? t(key) : value;
}

/**
 * Starter (built-in whole-foods) items carry an optional name_nl alongside
 * their English name, so the built-in database can show up in Dutch too.
 * Anything the person scanned or typed themselves never has name_nl, so
 * this always falls through to their own name unchanged.
 */
function displayFoodName(item) {
  return currentLang === 'nl' && item && item.name_nl ? item.name_nl : item && item.name;
}

/** The BCP-47 locale to hand to toLocaleDateString() etc. for the current language. */
function currentLocale() {
  return currentLang === 'nl' ? 'nl-NL' : 'en-US';
}

/** Walks the DOM applying data-i18n / data-i18n-placeholder / data-i18n-aria attributes. */
function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => {
    el.label = t(el.dataset.i18nLabel);
  });

  const toggleBtn = document.getElementById('lang-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = currentLang === 'nl' ? t('langToggleToEn') : t('langToggleToNl');
}

/** Re-renders whichever dynamic (JS-templated) content is currently on screen, since applyTranslations() alone only covers static markup. */
function refreshDynamicViewText() {
  const activeView = document.querySelector('.view:not([hidden])');
  const name = activeView && activeView.dataset.view;
  if (name === 'today') renderToday();
  if (name === 'library') renderLibrary();
  if (name === 'history') renderHistory();
  if (name === 'build' && typeof renderPlateItems === 'function' && plateSession) renderPlateItems();
  if (!document.getElementById('day-detail-backdrop').hidden) {
    const dateStr = document.getElementById('day-detail-backdrop').dataset.date;
    if (dateStr) renderDayDetail(dateStr);
  }
}

async function setLanguage(lang) {
  currentLang = lang === 'nl' ? 'nl' : 'en';
  if (currentLang === 'nl') {
    localStorage.setItem(LANG_STORAGE_KEY, 'nl');
  } else {
    // English is the default — don't bother persisting it, just clear
    // whatever was there so the next load falls back to English naturally.
    localStorage.removeItem(LANG_STORAGE_KEY);
  }
  applyTranslations();
  refreshDynamicViewText();
}

function initLanguage() {
  currentLang = localStorage.getItem(LANG_STORAGE_KEY) === 'nl' ? 'nl' : 'en';
  applyTranslations();
}

function wireLanguageToggle() {
  document.getElementById('lang-toggle-btn').addEventListener('click', () => {
    setLanguage(currentLang === 'nl' ? 'en' : 'nl');
  });
}

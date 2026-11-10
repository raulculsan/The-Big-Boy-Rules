# Shoe shelf integration — local, activation pending

Main preview: `artwork/shop/shoe-shelves-v1/integrated-preview.png` (labels), `integrated-artwork.png` (art only). Runtime fallback: `icons/shop/club-store-v1/assembled-poster-v3.webp`.

The existing 1024×1280 room, all ten original layers, background, window, coat rail, counter and foreground plants are retained. Front-row cabinets are pants `[132,990,248,248]`, shoes `[388,990,248,248]`, shirts `[644,990,248,248]`, all at z7 behind the z8/z9 plants. Existing approved `clothing-cabinet-v2.webp` is reused. Five pair assets are exact copies of the four approved 384px transparent product derivatives and the Chicago product. No wearable artwork, renderer, built-in whitelist, SQL or inventory was changed.

Each shoe pair is an independent RGBA layer. The shoe plan uses two pairs per shelf, three shelves and six pairs per page. `contact-baselines.json` records contact at the last row with at least 2.5% pixel support at alpha ≥192; original transparent padding and soft contact shadows remain. Cloth stacks retain their previous algorithm. Read-only exhibition pages have previous/next controls when needed. Actual verified stock uses a dedicated product picker with all models accessible and roving radio keyboard selection (arrows/Home/End).

`Zapatillas` routes to the existing `footwear` fitting slot. Missing slot yields the read-only illustrated exhibition, without purchase/equip actions or invented ownership/prices. Single-category catalogues now retain a category control so the route can select them. Existing navigation/back focus/Escape and stale route-token guards remain. Original manifests without shoes remain valid. Four exact `chota-jordan-{royal,graphite,pine,mocha}-v1` atlas item IDs map to their own pair art only after real descriptor validation; Chicago retains its built-in descriptor/product. No production catalogue rows are fabricated. The checkout now names shoes as shoes and uses the existing clothing purchase/equip calls.

## Local browser fixture

Serve the repository, then open `artwork/shop/shoe-shelves-v1/preview.html` at 390×844. Optional fixtures: `?stock=one`, `?stock=empty`, `?stock=overflow`. This page references current production modules and styles. All RPC data, inventory and prices on that page are explicitly simulated; there are no credentials or real accounts. A fixture-only Worker transport adapter maps ONLY the four proposed `https://preview.invalid/.../shoes-v1/` atlas paths to the already prepared local atlas files. Production wardrobe descriptor validation and composition run unchanged. This adapter is never loaded by the app.

The generator derives all dependency DOM from the current static index body and strips its scripts, keeping new pack/profile controls compatible without loading app.js. Every module/style reference carries its source hash to avoid stale HTTP responses. Fixture bootstrap exposes `shoePreviewReady` and `shoePreviewErrors`. `node artwork/shop/shoe-shelves-v1/verify-preview.mjs` validates local script execution/initialization and seven hotspots in JSDOM (Worker is stubbed in this bootstrap check only; this does not validate rendered composition).

Regenerate preview after relevant production changes with `python3 artwork/shop/shoe-shelves-v1/build-preview.py`. Regenerate assembled art/contact receipt with `node artwork/shop/shoe-shelves-v1/build-art.mjs`. It uses Sharp through the existing authoring loader; no new illustration or source edits.

## Validation

- `node --test scripts/club-store.test.mjs`: 10 passed, covers seven routes/back focus, optional old manifest, poster fallback, read-only missing footwear, stale async navigation, contact geometry, 0/1/5/14 shoes and future paging, unchanged folded stack pagination and working read-only next/previous controls through all 14 future pairs.
- `node --test scripts/chota-shoe-picker.test.mjs`: 3 passed, uses production `ChotaWardrobe.describe`, four atlas product mappings + Chicago, invalid/inactive exclusion, one-slot routing, all 15 catalogue shoes and keyboard end/wrap selection. Composer application is stubbed in JSDOM only; browser fixture uses real compositor.
- `node --test scripts/chota-shop.test.mjs scripts/chota-shop-sections.test.mjs scripts/chota-wardrobe.test.mjs`: 18 passed.
- Production JS syntax checks passed.
- Parent completed the 390×844 browser review: see `UI_VERIFICATION.md` for the observed scene, fitting/checkout, return focus, empty catalogue and expanded catalogue checks. This handoff does not claim physical-device validation.

## Claude release work

The four designs remain inactive draft descriptors. Upload and activation of exact five-sheet atlas descriptors and server catalogue rows belong to Claude under the existing publication rule. Do not turn them into built-in keys. Until activation, the main scene is an illustrative exhibition and the fitting picker displays only the server's actual active/owned, valid footwear.

Claude must incorporate release query/cache revisions for `club-store.js`, `club-store.css`, `chota-shop.js`, `store-rooms.css`, `store-rooms.js` and cache the five `shoes-*-pair-v1.webp` assets, `manifest.json` and `assembled-poster-v3.webp` through its current release workflow. `club-store.js` already requests manifest `?v=20261110-shoe-shelves-v1`. This work does not modify index, SW, packs/cards, app.js, native trees or deployment files, and performs no upload/build/push/deploy.

Baselines are in `baselines/` for guarded comparison with concurrent Claude work. Apply narrow diffs to owned files; never restore whole baseline files over others' work. Owned runtime files: `club-store.js`, `club-store.css`, `chota-shop.js`, `store-rooms.css`, `store-rooms.js`; assets: club-store manifest, five shoe pair copies and poster-v3; tests: `scripts/club-store.test.mjs`, `scripts/chota-shoe-picker.test.mjs`; authoring: this directory. Existing shoe authoring and atlases remain untouched.

# Runtime and build map

The app is a Capacitor web app. Edit the root web sources; `www/` and
`ios/App/App/public/` are generated outputs. Never edit generated copies to fix UI.

## Entry points and ownership

`index.html` declares the DOM and ordered `defer` scripts. Configuration and
shared libraries precede feature modules; `app.js` starts the authenticated shell
and supplies feature callbacks. Features use explicit frozen global APIs because
this project currently ships without a bundler.

| Module | Responsibility |
| --- | --- |
| `app.js` | Session validation, profile/member state, chat messages and realtime, agenda/Chota, navigation, news wiring, administration |
| `club-model.js` | Pure shared club data calculations |
| `chat-motion.js`, `chat-keyboard.js`, `chat-themes.js` | Conversation transitions, keyboard geometry, theme rendering |
| `card-collection.js` | Published card catalog and full-size card viewer; never the authoritative inventory |
| `card-thumbnails.js` | Generated original → small-image lookup; loads before the card catalog |
| `album.js` | Inventory-backed album pages and bounded next-page image warmup |
| `daily-packs.js`, `banner-shop.js` | Pack balance/opening, reveal flow, duplicate inventory, shop and owned banners |
| `collection-motion.js` | Card/reveal/discard motion |
| `achievement-progress.js`, `achievement-admin.js` | Progress calculations and administrator operations |
| `spotify-player.js` | Spotify session/player UI |
| `service-worker.js` | Versioned offline web shell; installed updates apply on next navigation |
| `ios/App/App/*.swift` | Native lifecycle and keyboard/Spotify bridges |

Inside `app.js`, search by function name rather than moving state across files:
`hydrateAuthenticatedData` owns independent startup requests, `renderFeatured` /
`renderMembers` / `applyUserHeader` own identity surfaces, `reconcileMessageUI`
owns transcript updates, and `refreshProfileSurfaces` fans out profile changes.
`updateSurfaceMarkup` preserves nodes when a surface is unchanged; authorization,
visibility and session side effects still execute on every refresh. Do not return
early from a whole authenticated render solely because its HTML did not change.

Extract future features only when their state and lifetime can be contained in
one module with an explicit initialize/reset API. Chat/session/Chota currently
share state and callbacks; moving them mechanically adds regression risk.

## Card image pipeline

`npm run cards:thumbnails` generates 360 px wide JPEG fronts (quality 78), a
source fingerprint manifest and the runtime lookup. `npm run build` runs it
incrementally. macOS uses the built-in `sips`; Linux/Windows build machines need
ImageMagick (`magick` on PATH). Never resize the original artwork. Include the
generated thumbnails/map when distributing source snapshots.

Catalog tiles, album slots and duplicate rows use these small images. The large
viewer and pack reveal use original front/back PNGs. Unmapped future designs
fall back to their originals; a failed thumbnail URL gets one original retry.

## Packaging and validation

`npm run build` assembles root assets into `www`; `npx cap copy ios` copies them
into the native project and refreshes Xcode's web-resource manifests. Build/copy
hooks omit unused macOS/iCloud numbered conflict files with an existing original.
The Xcode resource script repeats that guard. Source artwork stays intact.

For runtime changes, check only affected JS syntax first, then build/copy. On a
phone, check cold startup, opening/closing Chota, opening a six-card pack, album
page turns, duplicates, and image chat. Report native interaction measurements
separately from desktop static/build checks.

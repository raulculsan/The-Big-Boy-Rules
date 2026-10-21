# Performance audit — 21 October 2026

Scope: shared JavaScript/runtime and delivered artwork for desktop web, mobile web/PWA, Android and iOS. Native container review is coordinated separately. These are static/pipeline measurements, not claims of measured on-device launch speed.

## Findings corrected

1. Native card-cache eviction read every retained image blob with `getAll()` on each download, even though only byte sizes/timestamps were needed. Added an IndexedDB v2 metadata store with a cursor migration. Writes are serialized, eviction reads small metadata records only, and the 32 MiB disk budget remains. This removes the full-cache blob result array from each eviction.
2. Native object-URL ownership retained disconnected image nodes inside live image sets, and revoked visible URLs when more than 12 remained. Sets are now pruned, unused URLs released, and a connected image keeps its resource until removed/replaced.
3. Profile hydration and chat realtime refresh built/reconciled hidden transcript and inbox DOM. Refreshes now update only visible chat surfaces; opening the inbox/conversation renders the current in-memory data. Hidden administration no longer rebuilds on presence sync. Home hydration removes four otherwise hidden render tasks (group transcript, administration, private contacts, private transcript).
4. Large runtime banners/mascot were delivered as PNG. Eighteen optimized WebP assets preserve pixel dimensions and exact alpha; mascot sprites are lossless. Original PNGs remain in source control. The build reuses checked-in generated outputs when unchanged and excludes authoring PNG copies from distributable packages.
5. Hidden static fallback images for two animated banners referenced full-size scenes. They now reference existing 720×240 complete posters, preserving the 3:1 composition.

## Quantified resource results

| Item | Before | After |
| --- | ---: | ---: |
| 18 active runtime artwork files | 20,243,010 bytes | 4,679,222 bytes |
| Reduction for those files | — | 15,563,788 bytes (76.88%) |
| Two fallback scene files referenced | 5,288,622 bytes | Existing posters already packaged |
| Fallback bitmap dimensions, each | 2172×724 | 720×240 |
| Native cache eviction result | Entire retained blob collection (budget 32 MiB) | Metadata only |
| Hidden chat/admin tasks in Home hydration | 4 | 0 |

The WebP dimensions are unchanged, so reduced transfer/package bytes do not imply equivalent decoded-memory reduction. The fallback dimension reduction does reduce its bitmap pixel count by 89.0% if decoded. Final package/APK size must be measured after the production build.

## Existing controls verified in code

- Service worker already excludes card/banner/mascot/trophy image assets from install. Executable core has 72 URLs, about 2.30 MB including the root/index alias. Therefore the long artwork list is not a 100 MB precache.
- Runtime public media cache has entry and byte budgets; native full-card art has a 32 MiB cache.
- Catalog images are created when the catalog is entered, and list images use thumbnails.
- Member banner animation is restricted to two visible tiles; offscreen tiles use posters.
- Spotify refresh and animation work check visibility, and the shared startup queue yields between independent surfaces.

## Validation and limits

Syntax checks completed for modified JavaScript and build scripts; git whitespace check clean. Generation checked dimensions and alpha equality for every optimized image. Runtime source references were checked for old converted PNG filenames, including the dynamic basketball pose template. No test suite was run and no on-device timing is claimed. IndexedDB upgrade/offline artwork, reduced-motion banners, first chat entry, and rapid reply gestures still need normal browser/device checks after integration. Existing reply gesture logic was not changed.

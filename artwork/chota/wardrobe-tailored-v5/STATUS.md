# Tailored wardrobe v5 — work in progress

The user rejected the v4 appearance using IMG_1645.jpg and IMG_1646.jpg.
Mask coverage/alpha tests passed but did not establish convincing garment fit.

Current validated direction:

- Preserve the original artist-authored pose topology and fabric shading. Recolour
  actual garment material in that pose; retain connected sleeves, waistband,
  crotch, cuffs, paws and complete shoes at their original positions.
- The full67 `source-topology/review-{base,directional,contextual,room,talk}.png`
  galleries and eight-material `material-variants.png` are visually reviewed
  and accepted for runtime integration. It preserves the established face and anatomy without independent
  raster pieces pulling away from the body.
- The flat SVG pilot is rejected. The three-pose raster `expert-pilot/` looked
  promising, but its expanded `full/` meshes failed unusual poses: detached boots,
  stretched cloth and arm/waist contacts. Do not activate those expanded meshes.
- Front/back/sit/sleep authored images remain reference artwork only. They are
  not runtime animation sheets and do not constitute the completed correction.

Clothed source-topology review is complete. Removable garment layers, coats,
bare-slot combinations and shared runtime/preview integration are in progress. Production has not yet been
switched to this replacement. Do not mistake the older v4 handoff/tests for
user acceptance of its visual result.

Claude remains responsible for publishing. No v5 publication, app build,
deployment or database migration has been performed by Codex.

## Continued by Claude (2026-11-09)

Codex stopped mid-task; Claude finished the remaining gates it could verify:

- `partition.mjs#fillBareHoles`: pale paw pixels that touched the original tee or
  jeans were labelled as cloth, so removing that slot left paw-shaped holes (dark
  rings on the bare body, a missing patch on the chest in pose base-5). Enclosed
  gaps in the all-bare actor are filled, plus a radius-12 closing restricted to the
  torso (topwear) slot. Warm paw/fur source pixels are kept; other gaps take the
  nearest light fur colour. `assets.mjs` regenerates all 80 runtime atlases.
- Runtime integration (shared compositor, preview workers, fitting/checkout,
  dilemma, games, cameos) checked in the production-module fixture at 390×844:
  room, dilemma with outfit changes, inventory, fitting room, football. No console
  errors. Focused tests pass (the v4 path assertion now checks v5 paths).

Known, not fixed here: the TNF coat atlases (unchanged v3 art) still show sleeves
hanging in raised-arm poses (base 2–4, 14, 15). That artwork predates v5 and looks
the same in production; fixing it needs redrawn coat sleeves per pose.

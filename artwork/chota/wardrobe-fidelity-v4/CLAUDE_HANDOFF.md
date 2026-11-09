# Clothing cuts and daily dilemma synchronization — release 601

Prepared locally by Codex. Claude owns publication. No push, build, deployment
or Supabase migration has been executed for this fix.

## Changes to ship

- `chota-decisions.js`: one atomic `(sheet, frame)` pose selects body and clothes.
  Starting speech or a gesture cancels competing timers; stale callbacks cannot
  switch the garment to a different sheet. This also fixes legacy accounts with
  `wardrobe_version: 0`, independently of the pending modular-body SQL migration.
- `chota-wardrobe.js`: six shirts and two trousers now use versioned `v4.webp`
  sheets; the original white tee and jeans use `v2.webp`. Item IDs, ownership,
  prices, rig versions, coat sheets and footwear sheets remain unchanged.
- `chota-appearance.js`: recognizes corrected original garment paths for the
  exact cached default outfit and provides the failing sheet URL on decode errors.
- Forty new v4 garment sheets and ten corrected original v2 sheets. Each outfit
  retains all67 poses. The old alpha masks contained internal holes, fragments
  and a rectangular head exclusion that also removed real shirt necklines.
  The fix follows the source cloth boundary and recovers those upper-chest
  pixels, including raised-arm frames14/15. Cloth sampling no longer imports
  cuff/seam colors as sharp cracks across the torso. Neutral bodies and the
  exact cached default outfit remain unchanged.

## Packaging

Use the canonical root source. Index/service worker have the cloth-repair601
script marker and cachev601. Choose a higher coordinated version if another
release has advanced it. `scripts/prepare-chota-modular.mjs` now lists the final
source + body/original assets +30 unchanged coat sheets +40 corrected garment
sheets; regenerate its119-file SHA-256 inventory after reconciliation:

    node scripts/prepare-chota-modular.mjs

See `artwork/chota/modular-body-v1/release-manifest.json`. The approved neutral
manifest and originals metadata now reference the corrected shirt/jeans v2.
Do not overwrite independently edited Docker/native code with entire old bundles.
Reconcile source, generate web/native assets through the normal pipeline, and
regenerate iOS asset lists. The two new compositor modules must remain in
`scripts/build-web.mjs` as prepared in the previous modular-body task.

Deploy all50 new artwork files before/with the referencing client code; do not
reuse the old v3/v1 filenames. Existing apps need updated client code to choose
these paths. The legacy cuts/timer fixes require no new SQL. Enabling the full
modular wardrobe still follows the separate reviewed migration/handoff.

## Reproduction and verification

The production-module fixture at
`artwork/chota/modular-body-v1/integration.html` has both Modular and Legacy
modes, all17 garments and selectors. Switch clothes, open the daily dilemma,
and interrupt its walk/speech/gestures with repeated scene taps. Body and wear
layers must always share their sheet/index/size. In legacy mode, check Supreme
black with brown Carhartt during the arms-raised jump: no old white chest band.

`key-poses-legacy.png`, `key-poses-modular.png` and the16 complete `review-*`
galleries cover536 fitted garment poses in both rendering modes. Authoring
scripts `build-runtime-v4.mjs` and `build-review-v4.mjs` plus
`repair-coverage.json` document/reproduce the result. These QA files are not
runtime assets; do not package the authoring directory into the apps.

Final local validation is recorded in `ui-verification.json`. Real physical
Android/iPhone smoke checks remain part of Claude's release validation.

# Chota modular — prepared, not published

The 67-pose neutral body is complete and locally approved in
`icons/mascot/chota-v2/neutral/manifest-v1.json`. The application enables it only
when the server returns `wardrobe_version: 1`. No migration, deployment, app
release or Git push has been performed by Codex.

## Result

- Five neutral atlases preserve the original source faces. The old white tee,
  blue jeans and Chicago shoes are three independent, free inventory garments,
  with 15 garment-only atlases. Five cached original-outfit atlases reproduce
  the original appearance exactly; they are never used as a neutral body.
- One worker composes all five sheets atomically per outfit change. Animation
  frames only select cells. Older asynchronous jobs cannot replace the latest
  outfit, and logout/account changes clear the previous appearance.
- Room, enlarged room actor, idle/sleep parts, daily dilemma, three games that
  draw the tiger, wardrobe/fitting/checkout and CSS cameos share that appearance.
- Sleep/idle cuts retain breathing and separate ears/tail/paw movement without
  painting the old outfit or duplicating those parts.
- Historical null slots resolve to the free originals; explicit removals stay
  removed. Existing purchased/equipped clothing is preserved by the migration.

## Validation

18 focused tests pass: neutral 67 poses/clean alpha/unchanged sources; speech
body stability; original garment pixels and exact cached defaults; wardrobe
frame registration; atomic updates/cancellation/account reset; remote clothing
validation; migration behavior and own-user RLS in an isolated PGlite database.

Browser QA used production modules with simulated inventory and requests, not
live accounts. Visually checked purchased/default/bare outfits, changing clothes
while the daily dilemma remained open, skate drawing, sleeping/idle rendering,
independent shoe removal in the wardrobe, and mobile dilemma layout (390×844).
Console warning/error log was empty. The login/default reset and remaining CSS
cameos were checked in source and automated tests; not every application page
was manually visited. Native iPhone/Android execution remains a release check.

## Authoring

`build-neutral.mjs` is the successful generator from ImageGen full sheets.
`build-originals.mjs` extracts the three source garments; `build-idle-mask.mjs`
produces the geometry-only idle mask. `neutral-all-poses.png` and
`mixed-outfits-review.png` are review contact sheets.

The earlier `build-body*.mjs`, `pilot-anatomy.png` and root-level
`neutral-base-{0,6,20,22}.png` are rejected research pilots, not runtime inputs.
Do not publish them. Follow `CLAUDE_HANDOFF.md` for the final file list/rollout.

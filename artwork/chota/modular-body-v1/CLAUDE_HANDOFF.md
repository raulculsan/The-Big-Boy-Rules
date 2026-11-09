# Publish the modular Chota wardrobe

Codex prepared this locally; Claude owns publishing. This replaces the clothing
baked into the Chota body with independent inventory slots and fixes outfits in
the daily dilemma and other appearances. Do not publish the old diagnostic art.

## Files and platform reconciliation

The canonical source is the repository root. `release-manifest.json` lists all
119 required source, runtime, existing clothing dependency and migration files
with SHA-256 checksums (about 8.5 MB). Regenerate with:

    node scripts/prepare-chota-modular.mjs

The 30 new runtime assets are five neutral sheets, 15 original garment sheets,
five exact cached original-outfit sheets, the approved contract, an idle mask
and three product thumbnails. The 70 v3 clothing sheets are existing dependencies.

Reconcile the 18 source files in the manifest with the current Docker branches.
In particular load `chota-appearance.js` before `chota-wardrobe.js`/`app.js`,
include `chota-compositor-worker.js`, and carry the JS/CSS changes for dilemma,
games, wardrobe/shop/fitting and CSS cameos. `scripts/build-web.mjs` now includes
both new modules. Source index/service worker use the `chota-modular-600` marker.
Choose a newer coordinated cache version if another release has advanced it.

No native/web platform trees were overwritten during this final task: they
contain independently edited or minified baselines. Generate www and native
assets from the reconciled source using the project's normal pipeline, regenerate
iOS asset xcfilelists, and retain platform auth/navigation changes. Do not copy
the entire root blindly into divergent Android/GitHub worktrees.

## Rollout

1. Publish complete runtime assets and web code together; package iOS/Android
   from the reconciled source. Keep this public neutral manifest approved only
   with the matching five complete neutral/default sheets. QA artwork/fixtures
   and authoring masters do not belong in the app bundle.
2. Verify the five sheet dimensions, Worker/OffscreenCanvas decoding and the
   versioned worker URL on a real iPhone and Android. These native checks have
   not been run by Codex. Older clients remain on their legacy rendering;
   this engine change requires a native app update once.
3. Apply `supabase/migrations/20261109180000_chota_modular_originals.sql` after
   reviewing it against the deployed schema. It is tested locally, NOT applied.
   It adds free original shirt/jeans/shoes, footwear support, own-user removal
   preferences and `wardrobe_version: 1` to server state. That server marker
   enables atomic modular rendering. Do not activate by fabricating ownership
   on the client or just setting the HTML data attribute.
4. Verify with a real account: purchased clothes survive; historic null uses the
   three originals; removing each original stays removed after reopening; the
   wallet is unchanged; switching accounts cannot show the previous outfit.

## Focused verification

    node --test scripts/chota-appearance.test.mjs scripts/chota-original-assets.test.mjs scripts/chota-neutral-assets.test.mjs scripts/chota-wardrobe.test.mjs scripts/chota-clothing-client.test.mjs scripts/chota-modular-originals-db.test.mjs

18 passed. Local browser QA: open
`/artwork/chota/modular-body-v1/integration.html` on a local HTTP server.
It uses actual production rendering modules with fake data and no credentials.
Outfit controls also work inside dialogs. The fixture is not a production page.

Checked visually: daily dilemma while outfits change/talk/gesture; default and
purchased clothes; bare neutral body; separate footwear removal; idle and sleep;
skate; 390×844 dilemma. Other cameo selectors were reconciled in source; native
runtime, full live checkout and all app pages still need release smoke checks.

## Artwork model

The body is now a short-legged furry tiger with no old clothes. Original face
pixels and source files remain intact. Existing 14 garments are not redesigned
again. Five sheets/67 poses must remain registered for future body/garment art.
The exact original-outfit cache is an optimization of three equipped items,
not a permanent shirt/jeans/shoes layer beneath other clothing.

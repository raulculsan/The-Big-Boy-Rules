# Four Jordan colourways — local authoring handoff

Prepared as four **colourways of the same original high-top silhouette**: Royal `[44,88,200]`, Graphite `[90,99,112]`, Pine `[32,109,82]`, Mocha `[128,92,63]`. Red material is remapped with its neutral highlights/shadows retained; source black laces, swoosh, outline and dark panels remain. White panels remain white/ivory, with a mild cream warmth for Mocha. No new textual prints.

## Files for integration

- `icons/mascot/chota-v2/wardrobe-shoes-v1/{royal,graphite,pine,mocha}-{base,directional,contextual,room,talk}-v1.webp`: 20 lossless exact-RGBA atlases, 256 px cells, 67 poses per colourway. Grid sizes: 6×4, 5×4, 4×4, 4×1, 3×1.
- Each `{colourway}-manifest-v1.json` beside the atlases gives local paths, proposed storage paths, sizes and SHA-256 hashes for all five sheets.
- `catalogue-draft.json`: inactive catalogue descriptor drafts, `slot: footwear`, `rig_version: chota-footwear-overlay-v1`, `garment.type: atlas`, five compatible `chota/wardrobe/...webp` paths. Contains no price, ownership, or grant data. Storage paths are proposals; assets have **not** been uploaded.
- `store/{royal,graphite,pine,mocha}-product-v1.png`: original transparent 1254×1254 ImageGen product art supplied by the parent, retained unchanged. Actual decoded dimensions are 1254 px (rather than the initially reported 1280 px). `store/prompts.json` records the reference and each prompt.
- `store/{colourway}-product-384-v1.webp`: optimized transparent 384×384 lossless product thumbnails: identical full-square canvas resize to 352×352 plus 16 px transparent padding on every side, with no crop or redrawing. `store-manifest.json` gives original and derivative paths, hashes, byte sizes, visible bounds and actual alpha counts.
- `catalogue-preview.png`: four-column product-above-dressed-Chota comparison, plain model labels and restrained dark background.

## Review material

- `four-colourways-preview.png`: actual original Chota, all four models together.
- `{colourway}-dressed-preview.png`: 256 px transparent full actor for each model.
- `{colourway}-all67.png`: all 67 full-actor poses, labelled by sheet/frame.
- `{colourway}-critical-poses.png`: standing, walking, jumping, seated sole-forward base 20, sleeping base 22, and every directional frame including back walk.

All actors are made by replacing only the unified source-topology footwear region of the original artist actor. No independent meshes, warps, fixed wear overlays or altered body art. Exact alpha support preserves both shoes, cuffs, seated soles and occlusion in the poses as drawn. The existing swoosh is source artwork with the same orientation rules as the original Jordan shoes. No newly added text/logo needs a `-flip` atlas; use the original footwear flip behavior.

## Checks and reproduction

Run from repository root:

```sh
node artwork/chota/wardrobe-shoes-v1/build.mjs
node artwork/chota/wardrobe-shoes-v1/verify.mjs
node artwork/chota/wardrobe-shoes-v1/build-store.mjs
```

The authoring-only Sharp loader is reused. Builder imports the **current** source-topology partition and asserts every canonical original Jordan RGBA frame exactly equals `partition(...).parts[3]` before recolouring. It never runs the production source generator. All 67 frames contain recoloured material. Exact alpha, outside-shoe changes, anatomy changes and protected warm-hand changes all pass with zero mismatches. Encoded lossless WebP is decoded and byte-compared to generated RGBA. Independent verification checks hashes, dimensions, every source alpha byte, preserved dark ink and per-pose shoe support, including both halves/cuffs. `verification.json` contains per-frame material counts. `source-hashes.json` proves all 28 artist/source/topology inputs identical before and after generation.

Full-actor contact sheets were visually reviewed for all four colourways; Royal critical poses were also reviewed enlarged. Source geometry is unchanged, including artist-drawn foot orientations and occluded shoes while sleeping. The combined preview was sent to the parent before final handoff. Runtime compositions with coats, wardrobe/shop, bare-slot removal and mobile behavior remain integration validation for Claude; they were not activated or represented as tested here.

Only the two newly assigned asset/authoring directories were created or changed. No runtime, database, build, sync, upload or publication was performed.

## Integration work still required for Claude

These are locally prepared assets and descriptor drafts, not active or immediately equip-ready shop items. Runtime's built-in footwear whitelist currently recognizes Chicago; these variants use the already-supported `type: atlas` five-path descriptor instead. Claude must connect the intended local/hosted atlas paths and catalogue records, and extend the product image lookup/rendering where necessary so each item displays its corresponding new thumbnail rather than a Chicago fallback. Product-image plumbing, catalogue/database validation and composed wardrobe/shop/mobile behavior still need integration checks. Do not switch these to invented built-in keys or silently claim runtime equip support from asset preparation alone. Any activation/publication remains outside this package.

`build-store.mjs` validates real source alpha, uses the same deterministic full-canvas resize settings for all four products, verifies derivative transparency (including all 16 px margins), and checks original PNG hashes after writing derivatives. The footwear atlases are not changed by this product pass. Parent approved the on-character colourway palette and geometry before the product comparison pass. Original product PNGs have faint low-alpha pixels reaching the sides; Pine's opaque right shoe edge also reaches the rightmost canvas column. This existing framing is retained by the full-canvas resize with uniform added margins, no crop or artistic cleanup.

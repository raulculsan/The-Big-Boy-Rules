# Neutral body authoring

The built-in ImageGen tool created transparent neutral anatomical sheets from
original pose references and the approved unclothed tiger masters. Existing
original sheets and the 14 v3 garment rigs were read-only inputs.

Exact initial anatomy/product prompts are in `masters/prompts.json` and
`masters/pose-prompts.json`. Full-sheet edits used the same requirement: retain
the cell order, original head/face/expression, pose, paws, tail and proportions;
remove the white shirt, jeans and Chicago shoes; reconstruct natural orange
striped fur, cream belly, short legs and bare paws; preserve transparent gaps
and pixel-art edges. The base sheet received an additional alpha cleanup.
These descriptions summarize those edit briefs; they are not claimed as exact
verbatim copies of prompts that are no longer available in tool state.

ImageGen sometimes returned a four-cell room strip on a 3:1 canvas. The runtime
builder registers each entire sprite uniformly against its original head/height;
it never squashes the sheet into the target aspect. Speech uses the neutral idle
body with the original three face/mouth cells. The original face is restored
from source pixels, cloth masks excluded. Alpha is quantized, tiny isolated noise
removed and lossless WebP is encoded with exact transparent RGB preservation.

`generated-sheets/` and `masters/` are authoring assets, not runtime downloads.
The approved runtime contract is separate from `neutral-build.json`; rebuilding
art does not automatically confer approval or activate any user's wardrobe.

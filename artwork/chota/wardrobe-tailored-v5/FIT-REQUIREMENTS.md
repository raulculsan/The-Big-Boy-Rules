# Worn clothing, one body rig

User evidence: IMG_1645.jpg and IMG_1646.jpg. The v4 outfit still reads as
disconnected pasted fabric: serrated hems, broken pant cuffs/crotch and
misaligned sneaker/leg outlines. A mask-coverage pass is not visual acceptance.

Preserve the established tiger identity, head, short proportions, poses and
pixel-art language. `dressed-reference.png` establishes garment fit and finish;
it is a static authoring reference, not an animation or production replacement.

The rig must provide:

- One anatomical coordinate system for torso, shoulders, elbows, wrists, hips,
  knees and ankles in every pose.
- A shirt with a neck opening below the jaw, complete sleeves and cuffs,
  continuous sewn hem overlapping the waistband, and coherent simple shading.
- Trousers with a joined hip/waist, two distinct articulated legs, deliberate
  crotch shape, continuous cuffs resting on sneaker uppers and no ragged cuts.
- Complete shoes, anchored to the same ankles, with soles on the correct plane.
- Correct occlusion: head and paws over garments, hem over waist, cuffs over
  shoes. No old clothes, detached underlying body outlines or missing fur.
- Independent inventory slots, existing IDs/prices/ownership, bare slots and
  historical visual defaults preserved. Legacy rendering must also be fixed;
  the graphics fix must not require executing a new database migration.

Do not restore a rectangular head region containing old upper-shirt pixels.
Use the actual jaw/face boundary. Clear covered anatomical parts before drawing
garments; no later knockout may erase an already drawn shoe or sleeve.

Review standing, walking and raised-arm pilots before any production switch.
Then check all67 poses, sleep/idle joints, speech, dilemma interruption and coat
compatibility. Automated alpha/coverage checks supplement visual review; they
cannot certify that an outfit looks naturally worn.

Claude remains responsible for publication. Diagnostic and generated references
are authoring files and do not belong in app bundles.

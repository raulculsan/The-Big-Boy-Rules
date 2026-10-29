# El Chota — diagonal room walk

Production asset: `icons/mascot/chota-v2/chota-directional-v1.webp` (5 × 4 cells, 256 × 256 each).

- 0–7: walk away toward upper-left, three-quarter back.
- 8–15: walk toward lower-right, three-quarter front.
- 16: back neutral; 17: reach; 18: press; 19: front neutral.

The neutral reference was generated with the built-in ImageGen tool from the approved standing Chota sprite. Walking frames are articulated from these neutral views by `build-directional.py`: hips stay above ankles, one foot has a flat support phase while the other swings, and arms counter-swing. The generated walk-sheet experiment was discarded because its posture remained crouched. `chota-directional-v1.ora` was opened and reviewed in Krita; it contains one editable layer per frame.

Runtime cadence: 125 ms per pose, 5 seconds per room crossing. Press at 5.95 s; return begins at 6.95 s; gradual lying down begins at 12.35 s and sleep is held after 18.15 s. The fingertip in cell 18 is at (30, 80), used to calculate the contact point with the room switch.

Preview: `render-preview.py` reproduces the sprites, path and timings in a 720 × 790 MP4. It is a rendered preview, not an iPhone capture.

Validation: JS syntax; simulated timers for walk, switch, sleep, wake, visibility cleanup and reduced motion; web build; MP4 decode. No native sync or deployment is performed by these authoring scripts.

# El Chota — atención a la habitación

Runtime sheet: `icons/mascot/chota-v2/chota-contextual-v1.webp`, 4 × 4 cells of 256 × 256 px.

Rows: thinking about the noticeboard; hand at the ear; standing stretch; straightening the shirt. Each row starts with the approved neutral pose, then an entry pose, the gesture and its hold. The runtime supplies small grounded body motion and returns through the entry pose. These are short actions between longer quiet pauses.

The four target poses were generated with the built-in ImageGen tool using the approved standing sprite, normalized to the same floor line and pixel scale, then assembled by `build-contextual.py`. `chota-contextual-v1.ora` contains one editable layer per cell and was opened in Krita for review. The figures were not manually drawn in Krita.

The attention director prioritizes actual room state: a change of daylight, a real event within two days, an owned Roomba close to the mascot, and a recent user tap. The Roomba gaze samples its position five times over a short attention span. Personal gestures are eligible only after 28 seconds without one, with individual cooldowns and no immediate repeat. No ambient walking or lying down is introduced.

Preview: `render-preview.py` renders a 36-second MP4 with the current poses and example stimuli. Waiting gaps are shortened for review. It is not an iPhone recording and contains an example notice, not private agenda data.

Verified: JavaScript syntax; simulated event/light/Roomba priorities, cooldown, user acknowledgement, visibility cleanup and reduced motion; existing walk/switch/sleep/wake flow; web build; MP4 decode.

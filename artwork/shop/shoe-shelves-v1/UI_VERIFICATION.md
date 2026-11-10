# Browser review · 10 November 2026

Local fixture tested in the in-app browser at 390×844. Production modules and
compositor, simulated RPC inventory/prices; no real account or purchase.

Observed after the fixture's DOM/hash correction:

- Main scene shows seven furniture controls. The shoe shelf sits between the
  other two cabinets; individual paired shoes touch the wooden shelves.
- Shoe hotspot measured 94.45×94.45 CSS px. Its label is 10 px, visible at this
  viewport. Foreground plants and the window are preserved.
- Tapping Zapatillas opens the footwear fitting category. Selecting Royal
  shows the owned-item action; Pine shows a simulated purchase action. The
  actual composed actor displays the corresponding footwear.
- Opening Pine confirmation correctly says ZAPATILLAS PARA EL CHOTA, uses the
  matching dressed preview and existing confirmation/cancellation flow.
- After cancellation finishes, Back returns to the shop and restores focus to
  the shoe furniture button.
- stock=empty presents the five-pair exhibition and activation copy, with no
  purchase or equip action.
- stock=overflow presents all 13 simulated products plus the bare option.
  Pressing End from Royal focuses/selects the last product, Modelo futuro 8.
- No new console errors were observed on qa=3. The two earlier fixture failures
  (missing dependency DOM and stale script globals) were corrected by deriving
  all static DOM and adding per-source hashes; they are not ignored app errors.
- The viewport override was reset, and the default preview was left available.

Physical iPhone/Android testing, server item activation, cache release and
publication remain Claude's release work. This is browser validation, not a
claim of native-device or production verification.

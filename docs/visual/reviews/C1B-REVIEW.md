# ODD TIDE — C1B independent cold re-review

- Reviewer: Claude Fable 5.1 (model id `claude-fable-5-1`), acting as independent reviewer; not the implementer.
- Date: 2026-09-26
- Method: cold re-review of the corrective capture set. Read before the frames: `reviews/C1-REVIEW.md` (regression list and scoring method only) and directive §7.5. Not opened: `docs/visual/changes/`, commit messages, `SCORECARD.md`, `AUDIT.md`, session reports, implementer notes, source. `meta.json` was used only for viewport sizes.
- Scale: 1 broken/placeholder · 2 tech demo · 3 competent indie · 4 premium studio web piece · 5 people share screenshots unprompted. Rows as in C1: L M D E A C X UI.
- Inspected (all under `docs/visual/captures/`): `c1-before`, `c1-after` and `c1b-after` for `arrival-day`, `arrival-high-water`, `arrival-night` at desktop and mobile (`_existing_<vp>.png` and `_existing_<vp>_webgl.png`, 36 frames); `c1-after` vs `c1b-after` desktop for `nap-observatory`, `weather-exterior`, `lantern-dusk` (12 frames); `horizon` desktop raw canvas for the hairline row scan only. 23 crops at 1.2–2× in the scratchpad; nothing written to the project except this file.
- Coordinates: desktop full-viewport frames are 1920×1080; raw canvases are 1905×860 and sit at full-frame y=92 (matched by row search, mean |Δ| 0 at the untouched right third). Mobile full frames are 1170×2532; mobile raw canvases are 600×640.
- Contrast method (same as C1): WCAG 2.x ratio between the text core (mean of the darkest or brightest 3% of pixels in the text box) and the local background (mean of the 50% of pixels on the other side of the median). Desktop boxes: body copy x95–400, y668–732; hint line x95–330, y846–862; chip label x1580–1690, y800–830. Mobile body box x60–1120, y930–1060.
- Canvas identity: mean absolute difference `c1-after` vs `c1b-after` raw canvases is 0.9–2.6 levels at every desktop bookmark except `arrival-night` (5.7, concentrated at the lamps); mobile 2.6/2.6/8.2. The day, dusk and inspection-camera canvases are the same render within ripple phase; the day and dusk corrections are DOM-only (text colour, button colour, text shadow, veil).

## 1. Flaws in the C1B frames, ranked (new or unresolved first)

1. **Night sparkle cluster is unchanged.** `c1b-after/arrival-night_existing_desktop_webgl.png`, water box x1150–1400, y520–760: 28 blobs with L>150 (C1: 31), 2 520 px (C1: 2 900), largest blob 730 px; at L>200, 45 blobs / 525 px (C1: 46 / 542). Wider box x900–1700, y520–860: 43 blobs / 3 097 px (C1: 50 / 3 284) with an identical bounding box (x916–1308, y520–723) and a centroid of (1209, 601) vs (1229, 590). The cluster still sits to the lower right of the lodge rock as a cloud of oval flecks, not as a streak under the light sources. Water directly beneath the observatory (x1180–1330, y440–520) is dimmer than before (mean L 62, max 156; C1: 80 / 194), so the brightest water is further from the lamps than it was. Mobile raw canvas (600×640), lower half: 39 blobs / 3 882 px (C1: 68 / 4 083); the same cluster, same place. BEFORE had 0 blobs.
2. **Night observatory still clips; the halo is halved, the cores are not.** Observatory box x1130–1350, y270–420 in the desktop raw canvas: pixels with all channels ≥240 fall 948 → 479; pixels at 255 in all channels 320 → 302; any channel at 255 1 413 → 894; L≥250 1 022 → 553 (bounding box x1135–1308, y311–353, a 173×42 band along the lit platform). The clipped pixels are the interior panel behind the bed and the right-hand lamp disc; the left post lamp core clips in both runs. What changed: the dome is now readable as a dark gloss shell with its rim (it was a milky blob in C1) and the platform edge reads. Lodge box x900–1150, y380–560: 149 / 121 / 311 in both runs, unchanged. Whole frame all ≥240: 1 227 → 764. Mobile whole frame: 722 → 462 (all ≥240), 326 → 318 (all at 255). BEFORE: 24 px.
3. **Annotation arrow is now the least legible element on the day views.** Full frame x1640–1790, y180–290: the "A place to get a little lost." label changed to cream and measures 3.19:1 against the day water (`c1b-after/arrival-day_existing_desktop.png`; below 4.5:1 for text this size; BEFORE dark text 2.94:1, C1 1.90:1), but the hand-drawn arrow under it stays dark green: 1.50:1 (C1 1.90:1, BEFORE 2.94:1). At night the arrow is 1.10:1 in both C1 and C1B (BEFORE 1.48:1). The asterisk glyph did change to cream.
4. **Unchanged flaws from C1 that the corrective set does not touch** (numbers re-measured on C1B): hard polygonal water shadow at `nap-observatory` x1450–1900, y600–860 mean RGB 44/78/81 against lit water 112/132/138 (C1 41/73/79 vs 112/134/140); dark rectangle under the bath canopy in `weather-exterior` raw x780–815, y745–825 38/71/69 against 65/92/90 beside it; horizon hairline `horizon` raw y=245 mean L 187.0 between 161.3 (y244) and 163.7 (y246), identical to C1; `lantern-dusk` lodge lamp max L 194 in x1230–1320, y430–500 (unlit; frame max 226); `nap-observatory` headline still lands on the red roof and the bird.
5. **The left veil is now a dark scrim; at dusk it is a cool-neutral wedge over a warm sea.** Clean sample (no text) full frame vs raw canvas, x100–380: `arrival-day` y628–658 Δ −7/−9/−9, fading to 0 by x≈900 (per-50-px |Δ| 5.0 at x0 → 9.0 at x300 → 0.2 at x850); C1 and BEFORE had Δ 0 at this row. `lantern-dusk` y590–615: Δ −24/−24/−25 over the left ≈600 px (C1: −3/+19/+21, a teal tint). Against far water of 204/194/165 the dusk wedge reads as grey-blue haze on the left third with a soft edge at x≈500–830; it slices the dock and the bath rock as the teal one did. Not scored down: the wedge's visibility is similar to C1's, its hue is different.
6. **Mobile day/high-water: the "fog band" is gone, the veil is opaque-dark down to the scene.** Centre column x500–670 mean RGB every 100 px: C1B 77/116/121 at y300–1100, 88/119/125 at y1300, 95/119/124 at y1400, 89/113/115 at y1500 (continuous); C1 went 145/173/169 → 114/138/140 → 92/117/120 over y1300–1500 (the band C1 flaw 14 described). Improvement, recorded here because it changes the mobile composition.

## 2. Measurements

### 2.1 Text contrast, desktop full frames (body copy / hint line)

| Bookmark | BEFORE body | C1 body | C1B body | BEFORE hint | C1 hint | C1B hint |
|---|---|---|---|---|---|---|
| arrival-day | 3.09:1 (dark 42/83/70 on 111/164/156) | 1.43:1 (37/76/64 on 58/98/104) | **7.03:1** (cream 243/237/212 on 48/84/88) | 2.66:1 | 1.29:1 | **6.54:1** (234/230/206 on 48/85/87) |
| arrival-high-water | 3.10:1 | 1.40:1 | **7.04:1** (on 46/84/88) | 2.71:1 | 1.30:1 | **6.45:1** |
| arrival-night | 3.59:1 (cream on 71/134/135) | 15.25:1 | 15.55:1 (on 8/19/28) | 3.35:1 | 14.17:1 | 14.51:1 |
| nap-observatory | 5.13:1 (dark on 163/193/179) | 4.76:1 | 11.98:1 (cream on 31/43/41) | 1.69:1 | 1.86:1 | 10.28:1 |
| weather-exterior | 5.22:1 | 4.91:1 | 8.83:1 (on 34/66/72) | 1.70:1 | 1.90:1 | 9.68:1 |
| lantern-dusk | 3.13:1 (cream on 92/138/143) | 3.29:1 | 7.48:1 (on 64/74/75) | 3.33:1 | 3.58:1 | 9.27:1 |
| horizon (unscored) | 3.11:1 | 2.31:1 | 4.48:1 (cream on 79/113/124) | 2.59:1 | 1.79:1 | 4.65:1 |

Note: at nap-observatory, weather-exterior and lantern-dusk the "hint" box holds the "Back to the island" link row rather than the arrival hint; ratios are reported for the same box for comparability.

Other UI elements, desktop: "Resume the ripples" chip label 3.43:1 (BEFORE) → 4.26:1 (C1) → 4.33:1 (C1B) at arrival-day; 3.20 → 7.93 → 8.20:1 at arrival-night. Primary button label: cream on dark green (BEFORE/C1 day) → dark green 32/76/64 on cream 240/232/205 (C1B, all times), 7.9:1. Annotation label/arrow: see §1.3.

### 2.2 Text contrast, mobile full frames (body copy, x60–1120, y930–1060)

| Bookmark | BEFORE | C1 | C1B |
|---|---|---|---|
| arrival-day | 6.25:1 (dark 35/74/60 on 181/212/200) | 6.25:1 | 5.77:1 (cream 251/243/217 on 65/101/106) |
| arrival-high-water | 6.25:1 | 6.25:1 | 5.77:1 |
| arrival-night | 3.01:1 (cream on 119/145/153) | 3.01:1 | 12.42:1 (on 27/48/58) |

Mobile button label: 8.71:1 (C1 day, cream on green) → 7.92:1 (C1B day, green on cream); night 7.92 → 10.97:1. No hint line exists below the mobile button (row scan y1150–1400 finds only the button).

### 2.3 Night clipping and glints (raw canvases)

| Measure | BEFORE | C1 | C1B |
|---|---|---|---|
| Desktop observatory box x1130–1350, y270–420: all channels ≥240 | 24 | 948 | 479 |
| … all channels = 255 | 17 | 320 | 302 |
| … any channel = 255 | 25 | 1 413 | 894 |
| Desktop lodge box x900–1150, y380–560: ≥240 / =255 / any 255 | 0 / 0 / 0 | 149 / 121 / 318 | 149 / 121 / 311 |
| Desktop whole frame ≥240 / =255 | 24 / 17 | 1 227 / 519 | 764 / 471 |
| Desktop water x1150–1400, y520–760: blobs L>150 / px / largest | 0 / 0 / 0 | 31 / 2 900 / 1 149 | 28 / 2 520 / 730 |
| … blobs L>200 / px | 0 / 0 | 46 / 542 | 45 / 525 |
| Desktop water x900–1700, y520–860: blobs / px / centroid | 0 | 50 / 3 284 / (1229, 590) | 43 / 3 097 / (1209, 601) |
| Mobile whole frame ≥240 / =255 | 15 / 11 | 722 / 326 | 462 / 318 |
| Mobile lower half y330–640: blobs L>150 / px | 7 / 446 | 68 / 4 083 | 39 / 3 882 |

Glint description, C1B desktop: two groups. A dense group of ≈25 oval flecks 3–12 px long, L 180–255, inside x1150–1310, y520–650, arranged in two loose diagonal rows to the lower right of the lodge rock, with the observatory lamps 150–250 px up and to the right of them; a sparser group of ≈8 flecks at x916–1000, y560–720 left of the rock; three faint flecks near x1230–1300, y690–723. None lies in the vertical band beneath either lamp; the flecks have the same size and orientation as C1's and the same footprint (bounding box identical to the pixel). Mobile: the same cluster below-right of the lodge at raw x≈450–530, y≈380–460 plus a lone pair at x≈330–350, y≈545.

### 2.4 Water, veil and other checks

- Day water means, raw canvas (far x1500–1900, y20–120 / near x1500–1900, y700–840): arrival-day BEFORE 170/186/181 and 112/165/157; C1 115/142/151 and 50/92/96; C1B 115/141/150 and 49/88/90. High-water C1 109/137/146 and 50/93/97; C1B 108/136/145 and 48/90/92. Canvas unchanged.
- Full frame vs raw canvas at the untouched right third (x1600–1880, canvas y300–500): Δ 0/0/0 at every bookmark and run; there is no full-width scrim. Left-third clean-sample deltas are in §1.5.
- nap-observatory shadowed water: §1.4. weather-exterior canopy slab, full frame y770–830, mean RGB per 60-px band x460–820: C1 144/162/153 → 147/153/144 → 150/145/134 → 155/137/125 → 155/128/114 → 143/116/103 (pale grey at the left end, red at the right); C1B 80/76/75 → 96/79/76 → 111/83/77 → 125/87/79 → 132/89/78 → 125/88/77 (dark red to red). The two-tone slab of C1 flaw 9 now reads as one red slab with a darker left end.
- weather-exterior top horizon strip, raw y0–12 x1000–1900: 147/165/166 (C1 148/165/167); y30–60 139/160/164. Unchanged.
- lantern-dusk far water raw x0–600, y0–150: 204/194/165 (C1 204/195/166). Unchanged.

## 3. Per-bookmark verdicts for the regressed rows, C1B vs BEFORE

- **arrival-day, UI — fixed.** Desktop body copy 7.03:1 and hint 6.54:1 against BEFORE 3.09:1 / 2.66:1 and C1 1.43:1 / 1.29:1; chip 4.33:1; button label 7.9:1. Mobile 5.77:1 (BEFORE 6.25:1, cream instead of dark). No new UI regression; the annotation arrow at 1.50:1 is the one element weaker than BEFORE (2.94:1) and is decorative.
- **arrival-high-water, UI — fixed.** 7.04:1 / 6.45:1 against BEFORE 3.10:1 / 2.71:1 and C1 1.40:1 / 1.30:1. Mobile 5.77:1. Same arrow note.
- **arrival-night, X — not fixed.** Observatory clipping 948 → 479 px (≥240) but 302 px still at 255 in all channels and the interior panel and lamp discs are still white; sparkle cluster 28 blobs / 2 520 px in the same footprint as C1's 31 / 2 900 (BEFORE 0). Mobile the same (462 clipped px, 3 882 glint px). Partial improvement in the dome read; the row stays below BEFORE.
- **New regressions in the other rows: none found.** Canvases are identical within ripple phase at the day, high-water, dusk and inspection cameras (Δ ≤2.6 levels), so L, M, D, E, A are unchanged; C is unchanged (the nap-observatory headline still sits on the red roof); X at weather-exterior and nap-observatory is unchanged (same shadow and canopy-rectangle values). Weather-exterior's C1 flaw 9 (pale veil wedge turning the canopy two-tone) is resolved without a score change because X there was already 3.

## 4. Updated scores (desktop, rows re-examined; unchanged rows carried from C1 after the identity check)

| Bookmark | L | M | D | E | A | C | X | UI | Avg | C1 avg | BEFORE avg |
|---|---|---|---|---|---|---|---|---|---|---|---|
| arrival-day | 3 | 2 | 2 | 3 | 3 | 3 | 3 | **3** (C1 2) | 2.75 | 2.63 | 2.38 |
| arrival-high-water | 3 | 2 | 2 | 3 | 3 | 3 | 3 | **3** (C1 2) | 2.75 | 2.63 | 2.38 |
| arrival-night | 3 | 2 | 2 | 2 | 3 | 3 | **2** (BEFORE 3) | 3 | 2.50 | 2.50 | 2.38 |
| nap-observatory | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 3 | 2.38 | 2.38 | 2.25 |
| weather-exterior | 3 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 2.63 | 2.63 | 2.38 |
| lantern-dusk | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 2.75 | 2.75 | 2.38 |

- UI at arrival-day and arrival-high-water returns to 3, not 4: legibility is restored (≥6.4:1 on every copy element measured) but the arrow is at 1.50:1, the veil still slices scene objects at the inspection cameras, and no colour-vision-deficiency captures exist.
- X at arrival-night stays 2: the sparkle cloud is the same artefact at the same place; 302 pixels are still fully white.
- Mobile (full-viewport frames, raw canvas consulted): arrival-day 3/2/2/3/3/3/3/3 = 2.75 (C1 2.75; fog band gone, composition otherwise the same); arrival-high-water 3/2/2/3/3/3/3/3 = 2.75 (not scored in C1); arrival-night 3/2/2/2/3/3/2/3 = 2.50 (C1 2.50, X 2 for the same reasons as desktop).
- Hero average (arrival-day, weather-exterior, weather-interior carried at 2.63, nap-observatory, lantern-dusk): **2.63** (C1 2.60, BEFORE 2.35). Static average over all 10 with coast-grazing 2.29, bath-arm-length 2.29, horizon 2.57 and weather-interior 2.63 carried: **2.55** (C1 2.53). Against the proposed release bar: M and D remain below 3 at every bookmark; X is 2 at arrival-night; the hero average is 1.37 short of 4.
- Rows lower than BEFORE after C1B: arrival-night X (3 → 2), desktop and mobile. No others.

## 5. Observations (not instructions)

- The two UI regressions were closed by changing the copy, hint, eyebrow, annotation label and button to the night palette (cream text with a dark text shadow, dark label on a cream button) at all times of day, plus a −7/−9/−9 scrim over the left ≈850 px of the day hero. The day canvas itself is untouched, so the day read (water 115/141/150 far, 49/88/90 near) is now the same in every arrival frame while the type is the same colour it is at night.
- The night change reduced the bloom radius around the observatory and dimmed the water directly under it; it did not move or remove the detached glint cluster, and the emissive cores still sit at 255.
- The horizon hairline (y=245, +25 levels) and the C1 shadow/canopy/lamp observations are numerically identical between C1 and C1B.

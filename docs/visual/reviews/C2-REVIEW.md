# ODD TIDE — C2 independent cold review

- Reviewer: Claude Fable 5.1 (model id `claude-fable-5-1`), acting as independent reviewer; not the implementer.
- Date: 2026-09-27
- Method: cold review, frames first. Read before the frames: directive §7.5 and my own `reviews/C1-REVIEW.md` / `reviews/C1B-REVIEW.md` (method and the BEFORE score rows only). Not opened before scoring: `docs/visual/changes/`, commit messages, `SCORECARD.md`, `AUDIT.md`, session reports, implementer notes, source. `ART_DIRECTION.md` was read only after §3–§4 were written (§6).
- Frames: BEFORE = `docs/visual/captures/c1b-after/`, AFTER = `docs/visual/captures/c2-after/`. Inspected: every AFTER desktop raw canvas (`_desktop_webgl.png`) and full frame (`_desktop.png`) for all ten bookmarks; AFTER mobile full frame and raw canvas for `arrival-day`, `arrival-high-water`, `weather-exterior`, `arrival-night`; the matching BEFORE frames for all of the above (56 frames). 46 crops at 1–3× and 3 contrast-enhanced crops in the scratchpad; nothing written to the project except this file.
- Coordinates: desktop full frames 1920×1080; raw canvases 1905×860 and sit at full-frame y=92 (row search, mean |Δ| 0.00 at the right third). Mobile full frames 1170×2532; mobile raw canvases 600×640. "raw" = raw-canvas coordinates unless stated.
- Canvas change: mean absolute difference BEFORE→AFTER per desktop raw canvas: arrival-day 10.7, arrival-high-water 8.6, weather-exterior 19.8, weather-interior 18.8, nap-observatory 21.7, lantern-dusk 23.4, arrival-night 8.2, coast-grazing 45.1, bath-arm-length 40.4, horizon 9.4 levels. Every canvas is a different render (C1B→C1 was ≤2.6). The DOM layer is unchanged: full frame minus canvas gives Δ 0/0/0 at the right third and the same veil footprint (fraction of canvas with |Δ|>3: 0.42 day, 0.52 weather, 0.52 dusk, 0.15 night; BEFORE 0.42 / 0.52 / 0.53 / 0.16).
- Contrast method as in C1/C1B (WCAG ratio, text core = darkest or brightest 3 % of the box, background = the half of pixels on the other side of the median).

## 1. Flaws in the AFTER frames, ranked

1. **A straight-edged seabed/shallows quad is drawn through the hero water, with a dark sliver along one edge.** `c2-after/arrival-day_existing_desktop_webgl.png`: the lighter shallows patch south-west of the island ends on straight lines. Column x=1000: +11.0 L step at y≈674 and −10.9 at y≈768; column x=900: +12.6 at y≈670, −9.6 at y≈726 (BEFORE, same column, largest step 4.4). Along the line (746,672)→(977,729) a 3–4 px dark streak: min L 91–94 against 106–108 fifteen rows either side (Δ −13 to −16) from x=750 to 825, fading by x=850. Contrast-enhanced ×3 the patch is a rectangle with straight left, lower-left and right edges (right edge ≈ x 1310). The same quad is in `arrival-high-water_existing_desktop_webgl.png` at half amplitude (steps 4–6 L; sliver Δ −5 to −14), in `arrival-night_existing_desktop_webgl.png` (steps 3.5–4 L on a base of ≈25; sliver −3 to −4.6) and in `arrival-day_existing_mobile_webgl.png` as a diagonal from ≈(0,495) to (300,615). Visible at a glance in the day full frame (`arrival-day_existing_desktop.png`, the boundary crosses x≈760–1290, y≈760–950).
2. **lantern-dusk: a translucent pale disc lies over the cove with a visible arc edge, and the wet line is stippled.** `c2-after/lantern-dusk_existing_desktop_webgl.png`: across rows 480 / 560 / 640 the luminance drops −18.7 / −13.8 / −12.8 L within 4 px at x≈700–735; the arc runs from about (656,440) to (680,700), slices the raft (x≈700–860, y≈500–560) and reaches the near rock. Isolated bright specks (pixel brighter than its 5×5 ring by >35): near rock x940–1260, y660–860: 82 specks / 97 px (BEFORE 1 / 1); stepping stones x640–960, y340–480: 53 / 105 (BEFORE 8 / 16) — a dotted white line along every waterline at 1:1. The steep face at x≈1160–1250, y≈680–790 shows the strata texture pulled into vertical streaks, and the flat shelf under the raft (x≈690–860, y≈420–450) shows it as diagonal stripes. Full frame `lantern-dusk_existing_desktop.png`: the disc is the grey-white patch x≈650–1000, y≈520–760.
3. **weather-exterior: the subject is behind the trees.** `c2-after/weather-exterior_existing_desktop.png`: three canopies (x≈1040–1560, y≈470–800) cover the cabin's front wall and door; the readable parts are the roof and a strip of glass at x≈1400–1500. BEFORE (`c1b-after/weather-exterior_existing_desktop.png`) showed the whole front. `weather-interior_existing_desktop.png`: the same canopies cover the door side; the lifted-roof cutaway (bed, pillows, lamp at x≈1230–1460, y≈560–720) is clear.
4. **Night: lamp cores still clip, the glint chain is smaller and now under the lamp, the rock is black.** `c2-after/arrival-night_existing_desktop_webgl.png`: whole frame 338 px at 255 in all channels (BEFORE 471), ≥240 in all channels 390 (764). Observatory box x1150–1420, y240–440: 206 px at 255; the old box x1130–1350, y270–420: 136 (BEFORE 302). Water x1150–1400, y520–760, L>150: 12 blobs / 741 px / largest 371 (BEFORE 30 / 2 520 / 730), bounding box x1282–1367, y537–698, centroid (1318, 607), directly below the right post lamp (x≈1350) as a vertical chain of ovals plus two detached flecks lower down. Wider box x900–1700, y520–860: 15 blobs / 746 px (BEFORE 48 / 3 097). Mobile lower half: 19 blobs / 1 305 px (BEFORE 47 / 3 882); mobile whole frame ≥240 / =255: 217 / 187 (462 / 318). Rock luminance: islet x600–900, y430–560 mean L 21.6; lodge shelf x700–1000, y620–720 mean L 24.5 (BEFORE lodge rock 52.3); no lamp spill on the rock beside the lit windows. Isolated bright pixels along the rock outlines (L>70 with 5×5 ring <35): 158 (BEFORE 60) — a dotted rim on the silhouettes.
5. **coast-grazing: foam fringe, smear band and hard boundaries.** `c2-after/coast-grazing_existing_desktop_webgl.png`: specks in the channel x700–1400, y480–860: 208 / 572 px (BEFORE 20 / 73) — the foam mask has a stippled edge; the foam itself is opaque white blotches. The lower strata band y≈250–330 carries a grey-green wet band with vertical streaks at x≈750–850. The sand ramp meets the cliff on a straight diagonal at x≈1330–1370, y≈310–390. A thin dark line runs along the right rock's waterline at x≈1030–1400, y≈720–740. The foreground boulder (x0–700, y400–860) is soft at 1:1: no micro-detail, only the low-frequency normal map. No tiling found: the largest autocorrelation peak beyond a 25-px radius is 0.13 (strata) / 0.06 (boulder).
6. **bath-arm-length: the legacy bowl's rim seam is now the biggest line in the frame.** `c2-after/bath-arm-length_existing_desktop_webgl.png`: a dark teal line ≈5 px thick along the underside of the rim, x≈500–1400, y≈490–535, with a stippled lower fringe; the bowl water is a flat mirror. The cliff's left end x≈600–700, y≈100–300 shows black stretched strata at the silhouette. The rock underfoot has no tiling (largest peak beyond 25 px: 0.07) and holds detail at arm's length; the bowl base darkens the rock (L 66 at 2–10 px below the base → 92 at 70–100 px), so there is contact shading.
7. **Horizon hairline persists at half amplitude.** `c2-after/horizon_existing_desktop_webgl.png`: row y=273 is +10.8 L brighter than the mean of its neighbours over x1000–1900 (BEFORE y=245, +22.2). No hairline at bath-arm-length, lantern-dusk or weather-exterior (largest local row bump ≤6.5).
8. **Jagged moss patches and a repeated ledge profile.** `c2-after/arrival-day_existing_desktop_webgl.png` x1150–1450, y380–560 at 3×: green patches on the observatory rock's lower shelf have stair-stepped edges; the tier stack repeats the same rounded ledge profile five times.
9. **High water: the bath bowl reads as floating.** `c2-after/arrival-high-water_existing_desktop_webgl.png` x560–820, y330–470: islet rock pixels fall 12 183 → 539 (island box x540–1440, y300–760: 86 696 → 31 153), the bowl's base is hidden at exactly its own base line and the submerged islet silhouette is polygonal. The dock is a dark rectangle under the water at x≈820–900, y≈580–610.
10. **Unchanged from C1B:** the lantern-dusk lodge lamp is unlit at 18:30 (max L 193 in x1200–1400, y440–560; frame max 209; C1B 194); the nap-observatory headline still lands on the red roof and the bird (full frame x95–690, y420–520), and the bath bowl is cut by the "Tuck the roof back in" button at x0–90, y600–660; the left veil still slices scene objects (dusk raft and bowl; day islet).
11. **Copy contrast moved with the brighter water.** `arrival-day_existing_desktop.png`: body 7.03 → 6.00, hint 6.54 → 5.39, "Resume the ripples" chip 4.36 → 3.76; `arrival-high-water`: 7.04 → 6.36, 6.45 → 5.67, chip 4.28 → 3.85. Cabin bookmarks (tagline x95–400, y556–580; back link): weather-exterior 8.75 / 8.89, weather-interior 8.82 / 9.20, nap-observatory 11.38 / 15.13, lantern-dusk 7.58 / 8.05 (BEFORE 7.4–11.8). Night body / hint 15.26 / 14.20. Mobile body copy 5.88 at day and high water, 4.14 at weather-exterior, 12.49 at night — identical to BEFORE (the copy sits on the veil).

Resolved from C1/C1B (numbers): the hard polygonal water shadow at nap-observatory is gone — x1450–1900, y600–860 is still darker than the upper water (mean 58.7/79.1/72.1 vs 105.5/131.4/132.6) but at ×3 contrast enhancement the boundary is a soft gradient with no straight edge; the dark rectangle under the weather-exterior canopy is gone with the canopy; the day water is 107/135/138 far and 61/102/97 near (BEFORE 115/141/150 and 49/88/90).

## 2. Per bookmark, BEFORE → AFTER

- **arrival-day — better overall, one regression.** The island is now a layered sandstone mass with a wet line, shallows tint and sub-surface rock (rock pixels in the island box 86 696 at low water), where BEFORE was three beige cakes on flat water. Remaining: (1) the straight shallows quad and its dark sliver (§1.1); (2) the moss patches with stair-stepped edges and the five-times-repeated ledge profile on the observatory rock; (3) the bath bowl sits on the islet top with no visible base shadow at this distance, and the chip contrast is 3.76.
- **arrival-high-water — better.** The tide now reads: the islet and the low shelves go under (islet rock 12 183 → 539 px), the stepping stones and dock are seen through the water, the "Bath causeway underwater" pill matches the frame. Remaining: (1) the same quad seam at half amplitude (steps 4–6 L, sliver −5 to −14); (2) the bowl reads as floating and the submerged islet silhouette is polygonal; (3) the lodge's shelf is a few pixels above the surface with no wet band on its sides.
- **weather-exterior — mixed: materials up, readability down.** The plateau, bevelled rim and strata face replace the beige cake, and the trees cast hard contact shadows on the dirt (raw x750–1400, y560–860). Remaining: (1) the canopies hide the cabin front (§1.3); (2) the plateau dirt is a blurred low-frequency texture at this camera distance; (3) the far water still carries the horizontal ripple streaks near the top of the frame (raw y0–60).
- **weather-interior — better.** Same rock and plateau gains; the cutaway interior is readable. Remaining: (1) door side hidden by canopies; (2) blurred plateau dirt; (3) the lifted roof panel still floats with a dark translucent underside (raw x≈900–1170, y≈270–560).
- **nap-observatory — better.** The polygonal water shadow is gone, the observatory sits on a lit plateau with a lighthouse, and the deck has a shadow on the rock. Remaining: (1) the headline still covers the red roof and the bird; (2) the bath bowl is cut by the button; (3) the lighthouse casts no visible shadow on the rock and the plateau top is a flat texture.
- **lantern-dusk — better rock and cove, one regression.** Warm sandstone, foam patches, stepping stones, raft and buoy replace the cake and the floating canopy. Remaining: (1) the arc-edged translucent disc over the cove (§1.2); (2) the stippled white waterline along every rock (82 specks in the near-rock box); (3) the vertical smear on the steep face at x≈1160–1250 and the unlit lodge lamp (max L 193).
- **arrival-night — better.** The glint cloud is 70 % smaller and now sits under the right lamp; clipping is down 471 → 338 px. Remaining: (1) 338 px still at 255 (lamp discs and the interior panel); (2) the rock is black (mean L 22–25) with no lamp spill; (3) the dotted rim along the silhouettes (158 isolated bright pixels) and the faint quad seam in the water.
- **coast-grazing — much better.** Strata, a sand ramp, a stair with a cast shadow and a tidal channel replace the beige bands; no tiling detected. Remaining: (1) the stippled foam fringe (208 specks) and opaque foam blotches; (2) the grey-green smear band with vertical streaks at x≈750–850, y≈280–330 and the straight sand/cliff boundary; (3) the foreground boulder is soft at 1:1 and the copy sits on the rock face.
- **bath-arm-length — much better rock, worse object.** The marbled sandstone underfoot is the best material in the set and the bowl has contact shading. Remaining: (1) the rim seam with its stippled fringe (§1.6); (2) the flat mirror water in the bowl and the featureless bowl body over half the frame; (3) black stretched strata at the cliff's left silhouette.
- **horizon — better.** The island reads as tiered sandstone with the islet and a wet rim, the sky has a soft cloud and a haze band. Remaining: (1) the hairline at y=273 (+10.8 L); (2) the horizontal ripple streaking of the water in the far band (raw y≈280–330); (3) the trees are still blobs at silhouette scale.

## 3. Scores — AFTER

### 3.1 Desktop (rows L M D E A C X UI; static average over the scored rows)

| Bookmark | L | M | D | E | A | C | X | UI | Avg | BEFORE avg |
|---|---|---|---|---|---|---|---|---|---|---|
| arrival-day | 3 | 3 | 3 | 3 | 3 | 3 | **2** | 3 | 2.88 | 2.75 |
| arrival-high-water | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.75 |
| weather-exterior | 3 | 3 | 2 | 3 | 3 | **2** | 3 | 3 | 2.75 | 2.63 |
| weather-interior | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 2.88 | 2.63 |
| nap-observatory | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 2.88 | 2.38 |
| lantern-dusk | 3 | 3 | 3 | 3 | 3 | 3 | **2** | 3 | 2.88 | 2.75 |
| arrival-night | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 2.75 | 2.50 |
| coast-grazing | 3 | 3 | 3 | 3 | 3 | 2 | 3 | — | 2.86 | 2.29 |
| bath-arm-length | 3 | 3 | 3 | 3 | 3 | 3 | **2** | — | 2.86 | 2.29 |
| horizon | 3 | 3 | 3 | 3 | 3 | 3 | 3 | — | 3.00 | 2.57 |

Bold = lower than BEFORE. Motion and Performance: Unscored (still frames only).

- Hero average (arrival-day, weather-exterior, weather-interior, nap-observatory, lantern-dusk): **2.85** (BEFORE 2.63). Static average over all ten: **2.87** (BEFORE 2.55).
- Against the proposed release bar (no row below 3, hero average ≥ 4): X is 2 at arrival-day, lantern-dusk and bath-arm-length; C is 2 at weather-exterior, nap-observatory and coast-grazing; D is 2 at weather-exterior, weather-interior and arrival-night; M is 2 at arrival-night. Hero average is 1.15 short of 4.
- Why no row reaches 4: M and D on the rock are close (no tiling, strata hold at arm's length) but the buildings, trees, bowl and water are still flat-shaded or plastic; L has one coherent key but the night rock receives nothing; E has wet lines and tree shadows but the shallows quad, the arc disc and the floating bowl break contact; X has geometry outlines drawn in the water.

### 3.2 Mobile (full-viewport frames, raw canvas consulted)

| Bookmark (mobile) | L | M | D | E | A | C | X | UI | Avg | BEFORE avg |
|---|---|---|---|---|---|---|---|---|---|---|
| arrival-day | 3 | 3 | 3 | 3 | 3 | 3 | **2** | 3 | 2.88 | 2.75 |
| arrival-high-water | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.75 |
| weather-exterior | 3 | 3 | 2 | 3 | 3 | **2** | 3 | 3 | 2.75 | 2.63 |
| arrival-night | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 2.75 | 2.50 |

- weather-exterior mobile BEFORE was not scored in C1B; the 2.63 is scored now from `c1b-after/weather-exterior_existing_mobile.png` (3/2/2/2/3/3/3/3).
- Mobile arrival-day X 2: the quad seam crosses the mobile canvas (§1.1). Mobile weather-exterior C 2: the canopies cover the cabin front at x≈130–420, y≈1560–1800 of the full frame. Mobile night X 3: 187 px at 255 and 19 glint blobs, down from 318 and 47.

## 4. Rows lower than BEFORE

- Desktop: arrival-day X 3 → 2 (shallows quad seam and dark sliver); lantern-dusk X 3 → 2 (arc-edged disc, stippled waterline, smeared steep face); weather-exterior C 3 → 2 (canopies hide the cabin front); bath-arm-length X 3 → 2 (bowl rim seam at arm's length; legacy object).
- Mobile: arrival-day X 3 → 2 (same seam); weather-exterior C 3 → 2 (same occlusion).
- No other row is lower; every other changed row is higher.

## 5. Measurement summary

| Measure | BEFORE (c1b) | AFTER (c2) |
|---|---|---|
| Day shallows edge, largest 10-row step at x=1000 (raw) | 4.4 | 11.0 / −10.9 |
| Day sliver, min L vs context (x 750–825) | — | 91–94 vs 106–108 |
| Dusk arc edge, step at rows 480/560/640 | — | −18.7 / −13.8 / −12.8 |
| Dusk near-rock specks (x940–1260, y660–860) | 1 | 82 |
| Coast-grazing channel specks (x700–1400, y480–860) | 20 | 208 |
| Night whole frame all=255 / all≥240 | 471 / 764 | 338 / 390 |
| Night water x1150–1400, y520–760 blobs L>150 / px / largest | 30 / 2 520 / 730 | 12 / 741 / 371 |
| Night mobile lower half blobs / px | 47 / 3 882 | 19 / 1 305 |
| Night lodge-shelf rock mean L | 52.3 (x900–1150, y500–620) | 24.5 (x700–1000, y620–720) |
| Horizon hairline row / bump | y=245 / +22.2 | y=273 / +10.8 |
| Nap water x1450–1900, y600–860 mean RGB | 43.7/78.3/81.1 (hard polygon) | 58.7/79.1/72.1 (soft gradient) |
| Islet rock px, low → high water | — | 12 183 → 539 |
| Rock tiling, largest autocorr peak beyond 25 px | — | 0.07 (bath rock), 0.13 (strata), 0.06 (boulder), 0.10 (plateau) |
| Dusk lodge lamp max L | 194 | 193 |
| arrival-day body / hint / chip contrast | 7.03 / 6.54 / 4.36 | 6.00 / 5.39 / 3.76 |
| Veil footprint, fraction of canvas with |Δ|>3 (day / dusk) | 0.42 / 0.53 | 0.42 / 0.52 |

## 6. Against ART_DIRECTION.md targets (read only after §3–§4 were written)

- Lighting table, display sRGB, AFTER raw canvases: 09:00 sunlit shelf top L 102 (target 150–190), shaded faces 60–90 (70–110), open sea 93 near / 129 far (90–130), shallows over sand 105 (140–180), coral roof 69 (150–175). 21:00 rock 22 (20–40), near sea 20 (10–25), far sea 38 (10–25), lamp cores 255 (pools 150–230). 18:30 faces away from the sun 94–97 (45–80); the lodge lamp at max L 193 matches the row's "lanterns just readable, no pools yet", so the C1B "unlit" note is not a target miss.
- Materials: the sandstone now has bedding, a wet line and an algae band (coast-grazing lower band) with no tiling detected, but stretching remains on steep faces (dusk x≈1160–1250; bath cliff left end) which the triplanar target excludes; turf shows no blade clumps near the camera, decks show no grain or board-to-board variation, the coral roof is still long ribs rather than overlapping units, and the trees are smooth blobs rather than broken-silhouette scrub.
- Composition: the arrival island spans x 526–1370 (27–71 % of the desktop width) with the islet and bowl in the left third clear of the headline; the horizon is out of frame (target: near the top edge so the sea dominates). Mobile: the island is centred at ≈55 % of the viewport height and the time instrument begins at ≈97 % (target: island in the upper half, instrument visible in the first viewport).
- Tide: shelves exposed at 09:00 and covered at 15:00 with the causeway stones under water (islet rock 12 183 → 539 px) now match the covered/revealed reference pair; the pale-cyan shallows over sand of reference 10 are not reached (105 vs 140–180), and the boundary of that shallows patch is the seam recorded in §1.1.

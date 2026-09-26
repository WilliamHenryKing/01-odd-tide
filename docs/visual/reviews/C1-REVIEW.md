# ODD TIDE — C1 independent cold review

- Reviewer: Claude Fable 5.1 (model id `claude-fable-5-1`), acting as independent reviewer; not the implementer.
- Date: 2026-09-26
- Method: cold review, frames first. Frames were inspected before any project document. Not opened: `docs/visual/changes/`, `docs/visual/SCORECARD.md`, `docs/visual/AUDIT.md`, session reports, commit messages, git history. Directive §0 and §7.5 were read after the frames; `docs/visual/ART_DIRECTION.md` was read only after the scores in §4 were fixed.
- Scale: 1 broken/placeholder · 2 tech demo · 3 competent indie · 4 premium studio web piece · 5 people share screenshots unprompted. Rows: L light plausibility · M materials · D detail density · E environment integration · A atmosphere and depth · C composition and readability · X artefacts · UI integration. Motion and Performance: Unscored (stills).
- Inspected (all paths under `docs/visual/captures/`):
  - AFTER desktop, all 10 bookmarks: `c1-after/<bookmark>_existing_desktop_webgl.png` and `c1-after/<bookmark>_existing_desktop.png` (20 frames).
  - BEFORE desktop, all 10 bookmarks, both variants (20 frames) for comparison.
  - AFTER mobile: `arrival-day`, `lantern-dusk`, `arrival-night`, `weather-interior` (`_existing_mobile.png` and `_existing_mobile_webgl.png`, 8 frames) plus the 4 matching BEFORE `_existing_mobile.png`.
  - 30 pixel crops at 2–4× (scratchpad only, nothing written to the project) and numeric checks: WCAG contrast of copy against its actual background, mean water RGB, horizon row scan, clipped-pixel count, bright-blob count.
- Coordinates below are pixels in the 1905×860 desktop canvas frames or the 1905×1080 full-viewport frames unless stated.

## 1. Ranked visible flaws in the AFTER frames

1. **Day-view body copy and hint text are no longer legible over the darker water.** Measured (text core vs local background): `c1-after/arrival-day_existing_desktop.png` body copy 1.41:1 (BEFORE 3.31:1), hint "Or tap a cabin…" 1.29:1 (BEFORE 2.92:1); `c1-after/arrival-high-water_existing_desktop.png` 1.41:1 / 1.30:1 (BEFORE 3.33 / 2.94); `c1-after/horizon_existing_desktop.png` 2.28:1 / 1.76:1 (BEFORE 3.47 / 2.82). The dusk and night views switch to cream text and are fine (arrival-night body copy 15.9:1). The "Resume the ripples" chip label dropped from 4.38:1 to 3.76:1.
2. **Night bloom blow-out and a sparkle cluster with no reflection geometry.** `c1-after/arrival-night_existing_desktop_webgl.png`: 948 clipped pixels (all channels ≥240) inside the 220×150 px observatory region (x1130–1350, y270–420); the dome and platform are lost. 35 separate bright blobs (L>150) in the 250×240 px water region x1150–1400, y520–760, scattered as a cloud to the lower right of the lamps rather than as a reflection streak under them. Same in `c1-after/arrival-night_existing_mobile.png`.
3. **Horizon hairline and near-horizon striping.** `c1-after/horizon_existing_desktop_webgl.png`: a 1-px full-width line at y=245 (RGB 190/188/178 against 163/163/155 above and 161/167/159 below). Regular horizontal banding of the ripple pattern from y≈250 to y≈450. Sky (164/164/155) and sea (161/167/159) are nearly the same tone at the horizon, so the horizon reads only through the hairline. In `c1-after/horizon_existing_desktop.png` the line runs through the headline between "Somewhere" and "between".
4. **Hard, faceted, near-black shadows on the water surface.** `c1-after/nap-observatory_existing_desktop_webgl.png` x1450–1900, y600–860: shadowed water mean RGB 29/58/71 against 75/111/121 in lit water two hundred pixels away, with a polygonal edge; roughly 12% of the frame. Smaller instance right of the observatory stack in `c1-after/arrival-day_existing_desktop_webgl.png` (x1150–1500, y400–600). Dark rectangles under the bath canopy: `c1-after/weather-exterior_existing_desktop_webgl.png` x780–815, y745–825 (37/68/69 vs 51/94/97 beside it) and `c1-after/arrival-high-water_existing_desktop_webgl.png` x≈665–700, y≈355–375 and x≈785–810, y≈355–365. Water that reflects sky does not go this dark under a shadow.
5. **Placeholder geometry at every camera (unchanged from BEFORE).** Sphere-cluster trees on stick trunks; box cabins; torus tub; slab canopy on two cylinders; bird made of two flat triangles and an ellipsoid (`c1-after/weather-exterior_existing_desktop_webgl.png` x1130–1300, y60–130); interior = white box bed, two box pillows, sphere lamp (`c1-after/weather-interior_existing_desktop_webgl.png` x1150–1400, y450–650; `c1-after/lantern-dusk_existing_desktop_webgl.png` x1100–1440, y420–620); gold bent-tube telescope and cylinder-plus-sphere figure in the observatory (`c1-after/nap-observatory_existing_desktop_webgl.png` x1100–1500, y360–620). These are the §0 patterns (spheres for foliage and rocks, boxes for buildings).
6. **Materials read as one uniform noise or as plastic.** Rock strata are parallel bands of one speckle texture with no thickness variation (`c1-after/coast-grazing_existing_desktop_webgl.png` x450–900, y240–520); boulders are speckled spheres (x840–1300, y420–700); the tub is a smooth white torus over an opaque flat teal disc with a dark crevice ring between them (`c1-after/bath-arm-length_existing_desktop_webgl.png` x720–1180, y400–660); the canopy top face reads grey-mauve while its edges read red (x530–1100, y50–260); the dome is a single-highlight gloss shell. The water ripple pattern repeats visibly at distance (`c1-after/lantern-dusk_existing_desktop_webgl.png` y0–200; `c1-after/arrival-day_existing_desktop_webgl.png` y0–200).
7. **Floating or detached pieces.** Wooden step slabs hover above the rock lip with a shadow gap under them (`c1-after/coast-grazing_existing_desktop_webgl.png` x760–900, y270–350; `c1-after/bath-arm-length_existing_desktop_webgl.png` x1220–1270, y195–215). The dark green chimney block reads as floating over the treetops from the Weather House camera (`c1-after/weather-exterior_existing_desktop_webgl.png` x1250–1300, y190–260). The lifted roof carries the T-shaped vane into mid-air (`c1-after/weather-interior_existing_desktop_webgl.png` x900–1150, y200–600; by design, but it reads as a detached panel in a still). Trees intersect the observatory deck. The dock is a plank raft on two posts with no visible bearers.
8. **The Weather House reads half-roofed from its exterior camera.** `c1-after/weather-exterior_existing_desktop_webgl.png`: only the left slope exists; the interior is visible through the missing right slope in the "exterior" bookmark (unchanged from BEFORE).
9. **Text veil now shows as a pale wedge and slices scene objects.** Because the water is darker, the left-hand veil contrasts strongly with the canvas: `c1-after/weather-exterior_existing_desktop.png` canopy slab fades from red to pale grey across x≈460–820, y≈760–840; `c1-after/nap-observatory_existing_desktop.png` the headline "Observatory" sits on the red roof and the bird (x≈380–700, y≈420–520); `c1-after/lantern-dusk_existing_mobile.png` the veil crosses the red cabin roof at y≈990–1080 (original px).
10. **Submerged geometry ghosts.** Rock below the waterline renders as a milky translucent copy with stair-step silhouettes: `c1-after/lantern-dusk_existing_desktop_webgl.png` x600–1100, y540–860; `c1-after/arrival-high-water_existing_desktop_webgl.png` x640–900, y330–530. Reads as shallow water at a glance and as a transparency artefact up close.
11. **Sun-glitter band with a visible boundary.** `c1-after/weather-exterior_existing_desktop_webgl.png` and `c1-after/weather-interior_existing_desktop_webgl.png` x0–900, y300–650: a diagonal band of smeared lighter streaks with a soft but visible edge against the rest of the ripple field.
12. **Dusk and night lamp logic.** At 18:30 (`c1-after/lantern-dusk_existing_desktop_webgl.png`) the lodge lamp is an unlit white sphere and no lantern glows. At 21:00 the "A place to get a little lost" arrow is dark green on navy and disappears (`c1-after/arrival-night_existing_desktop.png` x1700–1760, y215–270).
13. **Faint sky seam.** `c1-after/coast-grazing_existing_desktop_webgl.png`: full-width straight tone step at y≈31 (warm 168/166/155 to cool 165/169/160, Δ 3–5 levels per channel) above the horizon, plus horizontal ripple striping y≈50–80.
14. **Mobile framing.** `c1-after/arrival-day_existing_mobile.png`: the veil fades into dense dark caustic water over ≈250 px (y≈1150–1450 original px) and reads as a fog band. `c1-after/lantern-dusk_existing_mobile.png`: lodge cropped at the left edge, dome cropped at the right. `c1-after/weather-interior_existing_mobile.png`: the lifted roof is cut by the left edge.

## 2. Per bookmark: BEFORE vs AFTER

Reference pairs: `c1-before/<bookmark>_*` vs `c1-after/<bookmark>_*`.

**arrival-day — canvas improved, UI regressed.** Reason: a single key light with cast shadows on the stacks and a rippled, sun-lit sea replace a flat pastel plane with painted squiggles (far-water mean RGB 168/186/181 → 113/140/149; near 110/164/156 → 52/93/96), so L, E and A each move 2→3; but the body copy fell from 3.31:1 to 1.41:1. Remaining: (1) body copy and hint contrast; (2) hard faceted island shadow on the water; (3) placeholder trees, boulders and bird.

**arrival-high-water — canvas improved, UI regressed.** Reason: the submerged bath rock and dock now read as high water instead of dissolving into fog. Remaining: (1) text contrast (1.41:1 / 1.30:1); (2) dark rectangles under the canopy on the water; (3) ghosted stair-step rock below the waterline.

**weather-exterior — improved.** Reason: cliff faces and cabin sides now have directional shading and a thin hazy horizon strip exists at the top; BEFORE was uniformly lit mint. Remaining: (1) half-roof cutaway plus the floating chimney read; (2) hard rectangular canopy shadow and the glitter-band edge; (3) veil wedge over the left third turning the canopy two-tone.

**weather-interior — improved.** Reason: same lighting and water gains; the lifted roof now casts a readable shadow across the bed. Remaining: (1) interior is four boxes and a sphere with no material or prop detail; (2) roof panel and vane floating; (3) veil wedge and glitter-band boundary.

**nap-observatory — same (2.25 → 2.38).** Reason: the water and key light improve, but this camera now exposes a near-black polygonal shadow over ≈12% of the water (29/58/71 vs 75/111/121) and the headline still lands on the red roof. Remaining: (1) hard near-black shadow on the water; (2) headline over the red roof and bird; (3) observatory props (tube, cylinder-and-sphere figure, blocks) and the dome's hard cut edge.

**lantern-dusk — improved.** Reason: 18:30 now reads as dusk (warm sky reflected on the far water, warm key on the rock and roofs; far-water mean 118/158/155 → 205/195/165); BEFORE was indistinguishable from the day frame. Remaining: (1) no lantern lit and box furniture behind flat glass; (2) ghosted rock below the waterline; (3) visible ripple repetition on the far water, dome cropped at the corner.

**arrival-night — canvas improved, artefacts regressed.** Reason: 21:00 now reads as night with lit windows and lamps (near-water 76/136/137 → 10/20/29); BEFORE was a tinted day frame. But the observatory is clipped (948 px) and a 35-blob sparkle cloud floats beside the island. Remaining: (1) observatory blow-out; (2) sparkle cluster; (3) annotation arrow invisible, foliage and rock reduced to grey blobs.

**coast-grazing — improved.** Reason: a sky gradient, a key light and a rippled sea replace a flat mint void. Remaining: (1) rock strata and boulder materials fall apart at arm's length; (2) floating step slabs and an unsupported dock; (3) faint sky seam and near-horizon striping.

**bath-arm-length — improved.** Reason: directional light gives the rock and posts shadows, and the posts now reflect in the water. Remaining: (1) torus tub with an opaque flat water disc and a dark crevice ring; (2) canopy slab reading two colours; (3) grass and rock are one speckle noise with no micro-detail.

**horizon — improved.** Reason: sky gradient with a soft cloud smear and haze near the horizon replace a flat mint sky and a grey band; BEFORE horizon band edge was ≈21 levels in G. Remaining: (1) 1-px horizon hairline; (2) horizontal striping near the horizon; (3) sky and sea tones nearly identical at the horizon, island small with a faint reflection.

## 3. Scores — AFTER, desktop

Each score was argued down first. M and D stay at 1–2 everywhere because every frame shows the §0 placeholder patterns for those concerns. UI is not scored ("—") for the three inspection cameras; their averages are over 7 rows.

| Bookmark | L | M | D | E | A | C | X | UI | Avg |
|---|---|---|---|---|---|---|---|---|---|
| arrival-day | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 2.63 |
| arrival-high-water | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 2.63 |
| weather-exterior | 3 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 2.63 |
| weather-interior | 3 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 2.63 |
| nap-observatory | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 3 | 2.38 |
| lantern-dusk | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 2.75 |
| arrival-night | 3 | 2 | 2 | 2 | 3 | 3 | 2 | 3 | 2.50 |
| coast-grazing | 3 | 2 | 2 | 2 | 2 | 2 | 3 | — | 2.29 |
| bath-arm-length | 3 | 2 | 1 | 2 | 2 | 3 | 3 | — | 2.29 |
| horizon | 3 | 2 | 2 | 3 | 3 | 3 | 2 | — | 2.57 |

- Static average, all 10 bookmarks: **2.53**.
- Hero average (arrival-day, weather-exterior, weather-interior, nap-observatory, lantern-dusk): **2.60** (BEFORE, same frames, my cold scoring: 2.35). Hero per-row averages: L 2.8 · M 2.0 · D 2.0 · E 2.4 · A 3.0 · C 2.8 · X 3.0 · UI 2.8.
- Against the proposed release bar (no row below 3, hero average ≥ 4): M and D are below 3 at every bookmark; UI is 2 at both day arrival views; the hero average is 1.4 points short.
- Motion: Unscored. Performance: Unscored.

BEFORE desktop, scored cold by the same method for the regression check (row order L/M/D/E/A/C/X/UI):

| Bookmark | L | M | D | E | A | C | X | UI | Avg |
|---|---|---|---|---|---|---|---|---|---|
| arrival-day | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.38 |
| arrival-high-water | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.38 |
| weather-exterior | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.38 |
| weather-interior | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.38 |
| nap-observatory | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 2.25 |
| lantern-dusk | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.38 |
| arrival-night | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 2.38 |
| coast-grazing | 2 | 2 | 2 | 2 | 2 | 2 | 3 | — | 2.14 |
| bath-arm-length | 2 | 2 | 1 | 2 | 2 | 3 | 3 | — | 2.14 |
| horizon | 2 | 2 | 2 | 2 | 2 | 3 | 2 | — | 2.14 |

BEFORE reasons in one line each: flat pastel light with no cast shadows and no time-of-day change (L 2, E 2); a flat mint plane with painted squiggles for the sea and a uniform fog wash (A 2, M 2); the horizon frame's grey band between sky and sea (X 2); the same placeholder geometry as AFTER (D); copy readable on the pale water (UI 3).

### Mobile — AFTER (full-viewport frames, raw canvas consulted)

| Frame | L | M | D | E | A | C | X | UI | Avg | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| arrival-day mobile | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 2.75 | Copy sits on a solid veil, so legibility holds; the veil-to-water band (y≈1150–1450) reads as fog. |
| lantern-dusk mobile | 3 | 2 | 2 | 3 | 3 | 2 | 3 | 3 | 2.63 | Veil slices the red cabin roof; lodge and dome cropped at both edges. |
| arrival-night mobile | 3 | 2 | 2 | 2 | 3 | 3 | 2 | 3 | 2.50 | Same clipping and sparkle cloud as desktop. |
| weather-interior mobile | 3 | 2 | 2 | 2 | 3 | 2 | 3 | 3 | 2.50 | Lifted roof cut by the left edge; interior small and box-built. |

Mobile BEFORE (same four): L, E and A were 2 in all four; dusk and night were not distinguishable from day. All four improve on the canvas; arrival-night mobile takes the same X drop as desktop.

## 4. Rows where AFTER is worse than BEFORE

1. **arrival-day, UI: 3 → 2.** Body copy 3.31:1 → 1.41:1; hint 2.92:1 → 1.29:1 (`c1-after/arrival-day_existing_desktop.png`).
2. **arrival-high-water, UI: 3 → 2.** Body copy 3.33:1 → 1.41:1; hint 2.94:1 → 1.30:1 (`c1-after/arrival-high-water_existing_desktop.png`).
3. **arrival-night, X: 3 → 2.** Observatory clipped (948 px) and a 35-blob sparkle cloud on the water (`c1-after/arrival-night_existing_desktop_webgl.png`, also mobile).
4. Unscored but recorded: **horizon full frame** body copy 3.47:1 → 2.28:1 and hint 2.82:1 → 1.76:1 (`c1-after/horizon_existing_desktop.png`); the horizon hairline now crosses the headline. UI is not scored at inspection cameras, so this is not counted as a row regression.

No other row is lower in AFTER than in BEFORE. L, E and A improve by one point at most bookmarks; M, D and C are unchanged.

## 5. Notes for the implementer (observations, not instructions)

- The single largest visible gain is time-of-day: dusk and night now exist. The single largest visible loss is the dark-green copy on the day views, which the darker sea no longer supports.
- Every frame still shows the §0 placeholder patterns (spheres for foliage and rocks, boxes for buildings and furniture, one speckle noise for all rock). No lighting change will move M or D above 2 while that remains.
- The new shadows are correct in direction and wrong in strength on the water: 29/58/71 shadowed vs 75/111/121 lit at nap-observatory.

## 6. Against ART_DIRECTION.md targets (read only after §3 was fixed)

- Direction of travel is right on the lighting states: the frames now have one sun with matching shadows, a peach dusk sea (far water 197) and a night sea at 23 with moonlit rock at 40, both inside the 10–25 / 20–40 targets; night lamp pools at 221 sit inside 150–230 but the 948 clipped pixels are not "small glare", and no moon disc, stars or glitter path exist yet.
- The 09:00 luminance relationships are not met: sunlit sandstone tops 119 (target 150–190), shaded cliff 59 (70–110), lit coral roof 71 (150–175), interiors through glazing 137 (30–60), and no pale-cyan shallows (140–180) appear; submerged rock renders lighter and milky where the direction asks for darker wet stone with algae below the high-water line.
- 18:30 misses its two defining relationships: the lodge wall facing away from the sun reads warm 142/117/74 (119) instead of sky-lit bluish 45–80, and the lantern is an unlit diffuse sphere (177) where the direction asks for the interior lamp to be the brightest point of the cabin hero shot.
- Materials and construction targets are untouched: roofs are still long ribs rather than overlapping units, glass shows no sky reflection, timber has no grain, the bath is a torus rather than a staved tub with rim and stove, and foliage is sphere clusters rather than broken leaf-cluster silhouettes; the "salt-bright, sheltered, curious" read therefore still depends on the copy, not the frame.
- Composition: the arrival island spans ≈43% of the width, centred, with no horizon in frame (target: right two-thirds, horizon near the top edge); the bath does sit clear of the headline as specified.

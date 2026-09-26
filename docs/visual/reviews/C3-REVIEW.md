# ODD TIDE — C3 independent cold review (cabins and bath)

- Reviewer: Claude Fable 5.1 (model id `claude-fable-5-1`), acting as independent reviewer; not the implementer.
- Date: 2026-09-27
- Method: cold review, frames first. AFTER frames were inspected before any BEFORE frame or document; scores in §4 were fixed before `docs/visual/ART_DIRECTION.md` was opened (§6). Read for method only: `reviews/C1-REVIEW.md`, `reviews/C1B-REVIEW.md`, directive §7.5. `reviews/C2-REVIEW.md` does not exist, so the `c2-after` set is scored cold here as the BEFORE baseline. Not opened: `docs/visual/changes/`, commit messages, implementer notes, `SCORECARD.md`, `AUDIT.md`, session reports, source.
- Scale: 1 broken/placeholder · 2 tech demo · 3 competent indie · 4 premium studio web piece · 5 people share screenshots unprompted. Rows: L light plausibility · M materials · D detail density · E environment integration · A atmosphere and depth · C composition and readability · X artefacts · UI integration. Motion and Performance: Unscored (stills).
- Inspected (all under `docs/visual/captures/`): AFTER `c3-after/<bookmark>_existing_desktop_webgl.png` and `_existing_desktop.png` for all 10 bookmarks (20 frames); AFTER `_existing_mobile.png` for arrival-day, weather-exterior, weather-interior, lantern-dusk (4 frames, raw mobile canvases via crops and metrics); BEFORE `c2-after` desktop raw canvases for weather-exterior, weather-interior, lantern-dusk, coast-grazing, bath-arm-length, horizon in full, arrival-day, arrival-high-water, arrival-night, nap-observatory via 2× crops and full-frame numeric comparison, BEFORE full frame for nap-observatory, BEFORE mobile full frames for the same 4 bookmarks. 40 crops at 2–4× in the scratchpad; nothing written to the project except this file.
- Coordinates: desktop raw canvas 1905×860; desktop full frame 1920×1080 with the canvas at y=92; mobile full frame 1170×2532; mobile raw canvas 600×640. Coordinates below are raw-canvas pixels unless the file name ends `_desktop.png` or `_mobile.png`.
- Canvas identity check, BEFORE→AFTER mean |Δ| per desktop raw canvas: arrival-day 1.35, arrival-high-water 1.23, weather-exterior 4.45, weather-interior 4.64, nap-observatory 6.40, lantern-dusk 9.79, arrival-night 1.98, coast-grazing 1.71, bath-arm-length 26.89, horizon 0.79. Far water (x1500–1900, y20–120) is identical at arrival-day, arrival-night, nap-observatory and horizon (Δ ≤ 0.05): lighting, water and rock are the same render; the change is confined to the three cabins, the bath and the dock lamp. Full-frame minus raw canvas at the untouched right third (x1600–1880) is 0/0/0 in both runs; the left-third veil is unchanged (arrival-day +19/+11/+9, lantern-dusk −41/−39/−32 at y600–630). DOM text contrast is identical to two decimals between runs at every arrival and cabin bookmark (§4).

## 1. Ranked flaws in the AFTER frames

1. **Spectral fleck ladder inside the Weather House glazing.** `c3-after/weather-exterior_existing_desktop_webgl.png` x1430–1530, y470–620: 155 separate blobs with channel spread > 45 (BEFORE 21 blobs, which were the blue cabinet), arranged as a diagonal ladder of 2–5 px rainbow flecks behind the mullions; visible at 1× in `c3-after/weather-exterior_existing_desktop.png` at x≈1470–1510, y≈600–660. The same flecks appear at the right edge of the glazing in `c3-after/weather-interior_existing_desktop_webgl.png` x≈1400–1435, y≈557–597. No glass in the scene otherwise shows a reflection, so the flecks read as an artefact rather than as a reflection of something.
2. **The Nap Observatory's open-roof state no longer shows an interior.** `c3-after/nap-observatory_existing_desktop_webgl.png` x1120–1720, y320–720: a closed shingle dome with a gold arc rib and a dark slit at x1370–1480, y330–530; the drum has one door. BEFORE (`c2-after/nap-observatory_existing_desktop_webgl.png`, same box) showed the bed, striped rug, telescope and lamp through the cut-away glass dome. The full frame carries "Tuck the roof back in" and "Serious equipment. Very soft pillows." with nothing in the canvas to point at.
3. **The Weather House lifted roof is a free-floating tiled slab.** `c3-after/weather-interior_existing_desktop_webgl.png` x1080–1370, y320–470: the slab (top 155/122/106, edge/underside 89/86/63) hovers ≈30 px above the timber frame with open water visible between them; the vane rides on the slab; no hinge, prop or arm. BEFORE's panel was rotated open about the ridge and stayed attached. Same read in `c3-after/weather-interior_existing_mobile.png`.
4. **Night speculars break the new shingles and slates into pinpoints; the old glint cluster remains.** `c3-after/arrival-night_existing_desktop_webgl.png` dome box x1180–1330, y255–345: 47 blobs at L>170 (BEFORE 7, one halo); lodge roof x990–1140, y415–470: 60 blobs at L>120, max 188 (BEFORE 11, max 250). Detached glints x1150–1400, y520–760: 12 blobs / 742 px (BEFORE 12 / 744) in the same footprint, still with no light source above them; wide box x900–1700, y520–860: 28 blobs / 941 px (BEFORE 16 / 750), the additions sitting under a new dock lamp at x880–950, y500–560 (max L 254, 39 px > 200; BEFORE max 119). Observatory box x1130–1350, y270–420: 65 px ≥240 and 57 px at 255 in all channels (BEFORE 157 / 136) — the lamp-post core; whole frame ≥240: 206 (BEFORE 390).
5. **Bath: a leaf-shaped shadow with no caster, and a flat water disc.** `c3-after/bath-arm-length_existing_desktop_webgl.png` x1190–1260, y400–560: 6 618 px at L<45 (box mean L 45.5) forming three leaf lobes on the step box and the tub wall; nothing in the frame casts it. Tub water x800–1180, y270–300 mean 128/109/90, a pale flat plate with no reflection of the rock 1 m behind it. Pale vertical slivers between staves at x≈930–970, y≈300–350 read as gaps in the tub wall (none exceed L 190; subtle).
6. **The A-frame roof reads as two different roofs depending on the camera.** Mean RGB of the lit slope: 182/144/119 at `c3-after/lantern-dusk_existing_desktop_webgl.png` x1020–1200, y100–240 (salmon); 141/118/103 at `c3-after/weather-exterior_existing_desktop_webgl.png` x1260–1400, y280–420 (pink-tan); 101/90/86 at `c3-after/nap-observatory_existing_desktop_webgl.png` x380–600, y380–540 and 100/96/89 at `c3-after/arrival-day_existing_desktop_webgl.png` x900–1000, y280–350 (grey-mauve vertical stripes, tar-paper read). At 2× the tiles are a flat running-bond print with no course overlap relief.
7. **Lantern Lodge construction oddities.** `c3-after/lantern-dusk_existing_desktop_webgl.png`: two black I-shaped tabs on the roof at x≈1107, y≈375 and x≈1520, y≈475 (a third on the A-frame at x≈1190, y≈158) with no readable function; roof courses run parallel to the eave with a thin timber rail mid-slope; the far-left deck post lands on a concrete block set into the sloping cliff face at x≈1015–1040, y≈655–685; window glass is perfectly clear with no sky reflection at 18:30; no lamp exists on the lodge (lodge box x1000–1700, y250–800 max L 191; frame max 231 is the bath lamp post at x530–560, y240–330, which is lit).
8. **Legacy items unchanged and still in every relevant frame:** two-tone sphere trees covering the lower-left of the Weather House (`c3-after/weather-exterior_existing_desktop_webgl.png` x1050–1400, y380–700) and most of its interior at weather-interior; hard polygonal water shadow at nap-observatory (x1450–1900, y600–860 mean 58/79/72 against lit 114/136/135; BEFORE 59/79/72); three milky blobs under the dock and ghosted rock below the waterline (`c3-after/lantern-dusk_existing_desktop_webgl.png` x700–900, y580–640: 285 px at L>150 in water of mean L 107.8); marble-veined rock texture at bath-arm-length; near-horizon ripple striping (`c3-after/horizon_existing_desktop_webgl.png` y≈280–450); the two-triangle bird; ripple tiling in the top band of the arrival views. The horizon hairline is absent in both runs (y244–246 mean L 160.9 / 160.9 / 160.8).
9. **Mobile framing.** `c3-after/lantern-dusk_existing_mobile.png`: the lodge deck and left half of the roof, and the A-frame behind it, are cut by the left edge. `c3-after/weather-exterior_existing_mobile.png`: text box x60–1120, y930–1060 measures 4.35:1 (BEFORE 4.38:1), under 4.5:1; the button label at y≈980 is 7.99:1.

## 2. Per-bookmark verdicts, BEFORE (`c2-after`) → AFTER (`c3-after`)

**arrival-day — improved (2.75 → 3.00).** Reason: the four built objects now read as buildings — tiled A-frame with vane, board-clad lodge on a railed deck, shingled dome with deck and rope rail, stave tub with stove and flue — where BEFORE had a red corrugated wedge with a floating chimney block, a teal glass-fronted box, a glossy glass mushroom and a white torus; water, rock and light are identical (far-water Δ 0.04). Remaining: (1) sphere trees overlapping the A-frame at x≈820–1000, y≈300–360; (2) visible ripple tiling across the top 200 px; (3) annotation arrow at 2.02:1 (`_existing_desktop.png` x1700–1760, y215–270; unchanged).

**arrival-high-water — improved (2.75 → 3.00).** Reason: same models; the dock reads as a raft on posts afloat, the lodge undercroft reads over the water. Remaining: (1) milky halo and stair-stepped ghost rock below the waterline around the bath rock and dock (x600–900, y330–530); (2) trees; (3) arrow 1.97:1.

**weather-exterior — improved (2.63 → 3.00).** Reason: a complete A-frame with both slopes, ridge fixings, glazed gable with timber mullions, a deck on two concrete blocks and a three-step stair replace a half-roof cutaway exposing a box interior, with the floating chimney gone (the sky above the roof at x1250–1300, y190–260 is now empty). Remaining: (1) spectral flecks in the glazing (§1.1); (2) tree blobs covering the lower-left third of the cabin; (3) flat printed tile pattern and a lit-slope colour that does not match the other cameras (§1.6).

**weather-interior — improved (2.63 → 3.00).** Reason: under the lifted roof the room now holds a bed with mattress and two pillows, a chest, a wall lamp and a boarded floor inside a timber frame, and the slab casts a shadow across them; BEFORE was a white box bed, a sphere and a cabinet under a hinged red panel. Remaining: (1) the slab floats with no hinge (§1.3); (2) trees hide roughly two-thirds of the interior; (3) spectral flecks at the glazing edge.

**nap-observatory — improved (2.50 → 3.00).** Reason: the dome is a ceramic shingle shell with per-scale highlights and gold ribs on a white drum with a framed door, on a boarded deck with posts, rope rail and footings; the headline now sits on a dark roof (tagline 10.65:1, link 15.12:1). Remaining: (1) no interior visible in the "roof open" state (§1.2); (2) hard polygonal water shadow, unchanged (§1.8); (3) A-frame roof reads as grey striped tar-paper from this camera (§1.6).

**lantern-dusk — improved (2.75 → 3.00).** Reason: the lodge is a clad cabin with slate courses, bargeboards, framed windows, an ajar door, a dining interior with table, benches, plates and cups, and a railed deck on posts to the rock; the bath lamp post is lit (max L 231; BEFORE 186); BEFORE was a cream box with a teal sheet roof, a glass front, a box bed and an unlit white sphere. Remaining: (1) no lantern on the Lantern Lodge at 18:30 and unreflective glass (§1.7); (2) black roof tabs and eave-parallel courses; (3) ghost blobs under the dock and ghosted submerged rock, plus the deck post on a block in the cliff face.

**arrival-night — improved (2.63 → 3.00).** Reason: the A-frame gable, lodge windows and bath deck are lit from inside and by practicals that light their surroundings, and the observatory no longer blows out (≥240 px 157 → 65). Remaining: (1) pinpoint speckle on the dome and lodge roof (§1.4); (2) the detached glint cluster, unchanged; (3) the lamp-post core at 255 (57 px) and the new dock-lamp glints.

**coast-grazing — same (2.29 → 2.29).** Reason: the frame is rock, sand and water, all unchanged (Δ 1.71, concentrated at x1650–1905, y0–180 where the lodge undercroft now shows a green board wall on thin stilts). Remaining: (1) rock strata as one speckle texture with no thickness variation; (2) flat sky with no aerial perspective; (3) the frame cuts the stair and lodge at the top edge.

**bath-arm-length — improved (2.29 → 3.00).** Reason: a stave tub with two steel hoops and visible grain, a black stove with door plate, flue and hose, a six-log pile with end grain, a two-tier step, deck planks on joists over blocks with a soft contact shadow, and a hanging lantern replace a white torus on a flat teal disc (Δ 26.89, the largest of the set). Remaining: (1) flat pale water disc with no reflection; (2) caster-less leaf shadow; (3) marble-veined rock and stave slivers (§1.5).

**horizon — same (2.71 → 2.71).** Reason: the island is ≈500×200 px; the tiled roofs and shingled dome read at that size, but the frame is 90 % sea and sky and unchanged (Δ 0.79). Remaining: (1) regular ripple striping y≈280–450; (2) sky and sea tones close at the horizon; (3) faint island reflection.

## 3. Measurements used above

- Desktop full-frame text contrast, AFTER = BEFORE to two decimals: arrival-day body 6.01:1 (cream 243/237/212 on 58/95/93), hint 5.39:1, chip 3.75:1, arrow 2.02:1; arrival-high-water 6.36 / 5.67 / 3.85 / 1.97; arrival-night 15.28 / 14.24 / 8.05 / 2.60; horizon 4.78 / 4.36 / 3.43 / 2.52. Cabin bookmarks (tagline x95–340, y558–580; "Back to the island" link): weather-exterior 8.98 / 8.88; weather-interior 9.06 / 9.20; nap-observatory 10.65 / 15.12; lantern-dusk 7.93 / 8.04. Chips where the canvas behind changed: weather-exterior 6.90 → 8.63, weather-interior 5.26 → 4.87, nap-observatory 8.81 → 8.81.
- Mobile text: arrival-day body 5.82:1 both runs; weather-exterior 4.38 → 4.35; weather-interior button 7.35 both; lantern-dusk body 8.81 → 8.76. Mobile raw canvas Δ: arrival-day 3.15, weather-exterior 7.92, weather-interior 9.09, lantern-dusk 19.9.
- Dusk lodge roof x1150–1550, y300–440: 125/126/120, max L 160 (BEFORE 127/129/107, max 209). Day lodge roof at arrival-day x1000–1130, y430–490: 98/110/114, max L 144 (BEFORE 88/107/105, max 185).
- Dome at nap-observatory x1190–1450, y340–520: max L 255, px ≥240 22 (BEFORE 7), mean 122.8 (BEFORE 119.8).
- Weather-exterior former canopy rectangle x780–815, y745–825: 124/102/77 against 123/103/78 beside it in both runs (the C1 dark rectangle is absent in both).

## 4. Scores

AFTER desktop (`c3-after`). Each score was argued down first. UI is not scored ("—") at the three inspection cameras; their averages are over 7 rows.

| Bookmark | L | M | D | E | A | C | X | UI | Avg | BEFORE avg |
|---|---|---|---|---|---|---|---|---|---|---|
| arrival-day | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.75 |
| arrival-high-water | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.75 |
| weather-exterior | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.63 |
| weather-interior | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.63 |
| nap-observatory | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.50 |
| lantern-dusk | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.75 |
| arrival-night | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 | 2.63 |
| coast-grazing | 3 | 2 | 2 | 2 | 2 | 2 | 3 | — | 2.29 | 2.29 |
| bath-arm-length | 3 | 3 | 3 | 3 | 3 | 3 | 3 | — | 3.00 | 2.29 |
| horizon | 3 | 2 | 2 | 3 | 3 | 3 | 3 | — | 2.71 | 2.71 |

- Static average, all 10 bookmarks: **2.90** (BEFORE 2.59).
- Hero average (arrival-day, weather-exterior, weather-interior, nap-observatory, lantern-dusk): **3.00** (BEFORE 2.65).
- Why nothing reaches 4: every frame that contains vegetation shows two-tone sphere trees; the water surface tiles and its shadows are hard polygons; the tub water is a flat disc; glass reflects nothing; the tile courses are a print without overlap; night speculars break into pinpoints. Why the cabin rows leave 2: the three cabins and the bath are now constructed objects with footings, frames, fixings, furniture and material variation that hold at 2× at the cameras they were built for.
- Against the proposed release bar (no row below 3, hero ≥ 4): M, D, E, A and C are 2 at coast-grazing and M, D are 2 at horizon; the hero average is 1.00 short.

BEFORE desktop (`c2-after`), scored cold by the same method (row order L/M/D/E/A/C/X/UI): arrival-day 3/2/2/3/3/3/3/3; arrival-high-water 3/2/2/3/3/3/3/3; weather-exterior 3/2/2/2/3/3/3/3; weather-interior 3/2/2/2/3/3/3/3; nap-observatory 3/2/2/2/3/2/3/3; lantern-dusk 3/2/2/3/3/3/3/3; arrival-night 3/2/2/2/3/3/3/3; coast-grazing 3/2/2/2/2/2/3/—; bath-arm-length 3/2/1/2/2/3/3/—; horizon 3/2/2/3/3/3/3/—. Two BEFORE rows differ from C1B's scoring of the earlier set and are stated so they are not read as C3 changes: nap-observatory L is 3 (the water shadow measured 59/79/72 in `c2-after`, no longer near-black) and arrival-night X is 3 (`c2-after` already had 12 glint blobs / 744 px and 157 clipped px against C1B's 28 / 2 520 and 479).

Mobile (full-viewport frames, raw canvas consulted), AFTER → row order L/M/D/E/A/C/X/UI:

| Bookmark | AFTER rows | AFTER avg | BEFORE avg |
|---|---|---|---|
| arrival-day | 3/3/3/3/3/3/3/3 | 3.00 | 2.75 |
| weather-exterior | 3/3/3/3/3/3/3/3 | 3.00 | 2.63 |
| weather-interior | 3/3/3/3/3/3/3/3 | 3.00 | 2.63 |
| lantern-dusk | 3/3/3/3/3/3/3/3 | 3.00 | 2.75 |

Mobile notes: weather-exterior text box 4.35:1 stays at UI 3 with the number recorded; lantern-dusk C stays 3 with the left-edge crop recorded (§1.9).

## 5. Regressions (rows lower than BEFORE)

None found, desktop or mobile. Items that moved sideways or are new without changing a row: spectral flecks in the Weather House glazing (X 3 → 3; the C1 canopy rectangle is gone, the flecks are new); night speckle on the dome and lodge roof (X 3 → 3; clipping fell 157 → 65 px); the Nap Observatory interior no longer visible in its open state (C 2 → 3 on headline legibility, with the lost interior recorded in §1.2); the Weather House lifted roof now unhinged (E 2 → 3 on the house body's footings and cast shadow, with the floating slab recorded in §1.3); mobile weather-exterior text 4.38 → 4.35:1 (UI 3 → 3).

## 6. Against `docs/visual/ART_DIRECTION.md` (read after §4 was fixed; observations only)

- "Cabin hero shots: interior lamp as the brightest point at dusk": at lantern-dusk the lodge box peaks at L 191 while the frame's brightest point (231) is the bath lamp post; no lamp exists on the lodge, and "lanterns just readable" at 18:30 is met only at the bath.
- "Glass: thin, clear, reflective windows showing the sky": lodge and A-frame panes show no sky at dusk or day; the Weather House glazing shows a 155-fleck spectral ladder instead (§1.1).
- "Glazed terracotta … tile-to-tile variation ±8 %, overlapping tile courses" and "coral roof lit 150–175": the lit slope measures 141/118/103 at weather-exterior and 101/90/86 at nap-observatory, with no overlap relief at 2× (§1.6); the dome's "blue-green ceramic … unit variation" is present by day (per-scale highlights) and becomes 47 pinpoints at night.
- "Construction: footings, sills, battens … hinges and fixings where the camera can see them": footings and fixings are present on all three cabins and the bath deck; the lifted Weather House roof shows no hinge, and the lodge's far-left post lands on a block in the cliff face (§1.3, §1.7).
- "Vegetation … broken silhouettes" and the bath references' "wall thickness, rim, internal bench": trees remain smooth spheres (legacy, out of scope) and the tub shows no rim thickness or bench above a flat water disc (§1.5).

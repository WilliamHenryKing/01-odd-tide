# ODD TIDE — independent cold baseline review

Launch provenance recorded by the orchestrator: `gpt-6-sol`, reasoning effort `max`, independent `cold_visual_review` task, no inherited implementer assessment.

26 September 2026. Reviewer: `cold_visual_review`, separate from the implementer. Scope: the existing baseline still images. The collection Visual Quality Directive and `DESIGN.md` supplied the standard and subject intent. No implementer audit, scorecard, session report or prior summary was read for this assessment.

## Visible flaws, ranked

1. **The natural forms and bath still read as a construction study.** The repeated, smooth clover-like foliage, straight trunks, rounded coastal platforms and evenly stepped strata dominate the world. At arm's length, the cliff and rocks mostly gain speckled colour; their edges, fractures, weathering and wet transitions do not gain corresponding detail. The Borrowed Bath is a white ring around an opaque, flat teal disc, beneath a plain beam on two posts. Its basin depth and material construction are not legible. This is most evident in `coast-grazing_200pct.png`, `bath-arm-length_200pct.png` and `weather-interior_200pct.png`.
2. **The material distinctions promised by the design are weak.** Timber is recognisable mainly through repeated strips and faint grain. Grass reads as an olive surface with noise. Rock reads as alternating beige bands. The roofs read as long ribbed panels more readily than glazed ceramic tile courses. Beds, pillows, lamp globes and glass have little surface or construction detail in the closer cabin views. The observatory dome has conspicuous soft highlights, but little surrounding construction detail to give its surface a convincing scale. These observations concern the rendered appearance; this review did not inspect map assignments or shader code.
3. **Several attachments and contact relationships look unresolved.** Dark rectangular roof appendages appear suspended clear of the roof silhouettes in the Weather House exterior and Lantern Lodge views. Soft, low-contrast contact shading does not consistently separate tree trunks, decks, rocks and land. The islands' pale waterline fringes read more like soft masks than a varied shoreline. The daylight world is readable but largely receives the same muted light treatment. The night frame introduces useful warm pools, while the surrounding sea remains a broad bright teal field.
4. **The environment loses continuity at some bookmarks.** Both horizon frames have an abrupt straight boundary between a flat mint upper field and the grey-to-teal lower field. It reads as a graphics seam rather than an integrated distant sky and sea. Close views have large fades across nearby objects: the desktop observatory's foreground cabin is washed out under the title, and mobile coast/bath imagery dissolves under the copy and at the bottom edge. These fades protect text, but flatten the scene instead of creating spatial depth.
5. **The most important interaction has weak first-viewport prominence on small screens.** The 390 × 844 arrival frames show the heading, call to action and island; the time control is below the captured viewport. At 800 × 360, the saved frame contains the header and only part of the headline, with no island or time instrument visible. This does not establish a scrolling failure, but it weakens the arrival experience around the action the design says visitors should remember.
6. **The diagnostic close cameras and page typography compete.** In desktop coast-grazing, the headline crosses the bath beam, rim and cliff; body copy falls over the bath/ground. In the desktop observatory view, the long title crosses the foreground roof and trees. The horizon view leaves the island small relative to the large flat fields. The coast/bath/horizon bookmarks may be inspection-only cameras; this review does not establish that users can reach those exact states. Their capture/UI integration still falls below the directive's per-bookmark standard.

The strongest existing elements are the serif typography, restrained cream/marine palette, clear primary buttons, and the three distinguishable cabin silhouettes. The low/high water pair visibly changes exposed cliff height and the bath connection. The night frame gives the observatory a readable warm accent. These are useful foundations for the reset, but do not lift the current 3D surfaces to the proposed release bar.

## Bookmark observations

Each row names the three most consequential remaining visible flaws. Desktop and mobile evidence is linked in the inventory below.

| Bookmark | Three visible flaws |
|---|---|
| Arrival day | Repeated blob foliage and banded platforms; flat water/shore integration; mobile time instrument below the captured viewport. |
| Arrival high water | Bath platform reads as a floating disc; water gives little wet-edge or depth information; mobile hides the explanatory time/status control below the captured viewport. |
| Weather exterior | Detached-looking dark roof appendage; close foliage and interior objects remain simple smooth forms; ribbed roof and muted surfaces do not establish the declared ceramic/timber/stone material separation. |
| Weather interior | Bedding and room surfaces lack close detail; the opened roof's broad flat underside and simple hinge area become dominant; foreground foliage remains an obvious repeated form family. |
| Nap observatory | Dome construction and interior equipment are sparse; trees obscure parts of the small room/platform; desktop title and foreground geometry overlap through a conspicuous fade. |
| Lantern dusk | Dark roof appendage appears suspended; interior is uniformly pale and walls nearly flat dark green; the named lantern/dusk payoff is visually weak compared with the large blue roof and simple room blocks. |
| Arrival night | Sea brightness and limited atmosphere weaken the night setting; most land/foliage falls into similar dark values; small-screen roof edges and small details appear coarse beside sharp DOM type. |
| Coast grazing | Cliff bands and low-poly rounded rocks dominate the close-up; speckled colour substitutes for convincing surface structure; desktop headline/body copy crosses the subject, while mobile fades out nearby geometry. |
| Bath arm length | Basin is a ring and flat colour disc with no readable depth; ground/rock detail remains coarse speckle; the blank beam and posts do not provide enough authored detail for this principal destination. |
| Horizon | Abrupt full-width upper/lower environment boundary; weak layered distance; island is small and visually isolated, particularly under the large mobile text field. |

## Scores using the directive's 1–5 scale

Calibration: **1** broken or placeholder; **2** tech demo; **3** competent indie; **4** premium studio web piece; **5** people share screenshots unprompted. The skill's separate 0–3 game scale was not substituted for this scale.

Columns: **L** light plausibility; **M** materials; **D** detail density; **E** environment integration; **A** atmosphere and depth; **C** composition and readability; **X** artefacts; **UI** UI integration. The average includes these eight still-observable rows only. Artefacts scores address visible static defects and coarse edges; they do not certify freedom from temporal aliasing, shimmer, popping or swimming shadows. UI scores concern visible integration, not a completed accessibility or interaction audit.

### Desktop

| Bookmark | L | M | D | E | A | C | X | UI | Motion | Performance | Static average |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|
| Arrival day | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Unscored | Unscored | 2.38 |
| Arrival high water | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Unscored | Unscored | 2.38 |
| Weather exterior | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | Unscored | Unscored | 2.25 |
| Weather interior | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Unscored | Unscored | 2.38 |
| Nap observatory | 2 | 2 | 2 | 2 | 1 | 2 | 3 | 2 | Unscored | Unscored | 2.00 |
| Lantern dusk | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | Unscored | Unscored | 2.25 |
| Arrival night | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Unscored | Unscored | 2.38 |
| Coast grazing | 2 | 1 | 1 | 2 | 1 | 1 | 2 | 1 | Unscored | Unscored | 1.38 |
| Bath arm length | 2 | 1 | 1 | 2 | 1 | 2 | 2 | 2 | Unscored | Unscored | 1.63 |
| Horizon | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 3 | Unscored | Unscored | 1.75 |

### Mobile portrait

| Bookmark | L | M | D | E | A | C | X | UI | Motion | Performance | Static average |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|
| Arrival day | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 2 | Unscored | Unscored | 2.25 |
| Arrival high water | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 2 | Unscored | Unscored | 2.25 |
| Weather exterior | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | Unscored | Unscored | 2.25 |
| Weather interior | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Unscored | Unscored | 2.38 |
| Nap observatory | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Unscored | Unscored | 2.38 |
| Lantern dusk | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | Unscored | Unscored | 2.25 |
| Arrival night | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | Unscored | Unscored | 2.13 |
| Coast grazing | 2 | 1 | 1 | 2 | 1 | 2 | 2 | 2 | Unscored | Unscored | 1.63 |
| Bath arm length | 2 | 1 | 1 | 2 | 1 | 2 | 2 | 2 | Unscored | Unscored | 1.63 |
| Horizon | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | Unscored | Unscored | 1.50 |

The arrival-day, Weather House exterior/interior, observatory and Lantern Lodge dusk views form the hero sample for this review. Their static averages are **2.25/5 desktop** and **2.30/5 mobile**. Every inspected bookmark has multiple rows below 3. The current still evidence fails the directive's proposed bar of no row below 3 and hero averages of at least 4. This report provides no visual acceptance.

## Recommended order of visual work

1. Establish a reference-backed land, foliage and bath asset study, viewed at arrival distance and arm's length. The bath must read as an inviting, constructed coastal destination, and the terrain must retain interest beyond evenly spaced rings. Preserve the intentional miniature scale while improving form and material authorship.
2. Resolve the roof attachments and architectural construction, then prove one complete cabin in look-dev: ceramic/timber/glass/cloth distinctions, grounded supports, intentional furniture and contact shading. Treat the roof and interior reveal as hero surfaces.
3. Establish coherent day, dusk and night light/environment states and credible shoreline integration. Evaluate the land and water together. Remove the visible horizon discontinuity and separate spatial atmosphere from the page's readability masks.
4. Recompose the hero cameras and mobile first viewport around the island and time action. Give each camera a deliberate safe text region; keep inspection views useful without page text obscuring the inspected material.
5. Capture the same bookmarks after each bounded pass. Review unpaused camera/roof/tide transitions separately, and obtain performance evidence on the designated hardware before scoring those rows.

## Precisely inspected evidence

All paths below are relative to this report. Each of the twenty main frames was inspected individually; the contact sheets were used for initial orientation. No `_canvas` or `_webgl` alternate files were used to infer details not visible in the listed images.

| Bookmark | Desktop full frame | Mobile full frame |
|---|---|---|
| Arrival day | [arrival-day_existing_desktop.png](captures/baseline/arrival-day_existing_desktop.png) | [arrival-day_existing_mobile.png](captures/baseline/arrival-day_existing_mobile.png) |
| Arrival high water | [arrival-high-water_existing_desktop.png](captures/baseline/arrival-high-water_existing_desktop.png) | [arrival-high-water_existing_mobile.png](captures/baseline/arrival-high-water_existing_mobile.png) |
| Weather exterior | [weather-exterior_existing_desktop.png](captures/baseline/weather-exterior_existing_desktop.png) | [weather-exterior_existing_mobile.png](captures/baseline/weather-exterior_existing_mobile.png) |
| Weather interior | [weather-interior_existing_desktop.png](captures/baseline/weather-interior_existing_desktop.png) | [weather-interior_existing_mobile.png](captures/baseline/weather-interior_existing_mobile.png) |
| Nap observatory | [nap-observatory_existing_desktop.png](captures/baseline/nap-observatory_existing_desktop.png) | [nap-observatory_existing_mobile.png](captures/baseline/nap-observatory_existing_mobile.png) |
| Lantern dusk | [lantern-dusk_existing_desktop.png](captures/baseline/lantern-dusk_existing_desktop.png) | [lantern-dusk_existing_mobile.png](captures/baseline/lantern-dusk_existing_mobile.png) |
| Arrival night | [arrival-night_existing_desktop.png](captures/baseline/arrival-night_existing_desktop.png) | [arrival-night_existing_mobile.png](captures/baseline/arrival-night_existing_mobile.png) |
| Coast grazing | [coast-grazing_existing_desktop.png](captures/baseline/coast-grazing_existing_desktop.png) | [coast-grazing_existing_mobile.png](captures/baseline/coast-grazing_existing_mobile.png) |
| Bath arm length | [bath-arm-length_existing_desktop.png](captures/baseline/bath-arm-length_existing_desktop.png) | [bath-arm-length_existing_mobile.png](captures/baseline/bath-arm-length_existing_mobile.png) |
| Horizon | [horizon_existing_desktop.png](captures/baseline/horizon_existing_desktop.png) | [horizon_existing_mobile.png](captures/baseline/horizon_existing_mobile.png) |

Existing enlarged crops: [weather-interior_200pct.png](captures/baseline/weather-interior_200pct.png), [coast-grazing_200pct.png](captures/baseline/coast-grazing_200pct.png), [bath-arm-length_200pct.png](captures/baseline/bath-arm-length_200pct.png). Enlargement was used to inspect form/material detail, not as independent proof of native-resolution aliasing.

Overview sheets: [contact-desktop.jpg](captures/baseline/contact-desktop.jpg), [contact-mobile.jpg](captures/baseline/contact-mobile.jpg).

Supplemental saved images: [responsive-800x360.png](captures/baseline/responsive-800x360.png), [responsive-1100x1400.png](captures/baseline/responsive-1100x1400.png), [vision-deuteranopia-390.png](captures/baseline/vision-deuteranopia-390.png). The 1100 × 1400 frame preserves the type/world/control stack well. The deuteranopia image retains text labels for the causeway state and readable main actions; this single sample does not certify the complete colour-vision/accessibility matrix.

## Limits and work performed

This was a cold review of 28 existing baseline image files, plus the skill's three calibration images. It involved no live browser interaction, no new capture, no source inspection or change, no render/benchmark/test job, no uninterrupted viewing or listening, and no technical diagnosis of the renderer. Still images cannot establish motion timing, camera continuity, shadow stability, temporal artefacts, input behaviour or real-device performance. Screenshot names provide the state labels used here; capture metadata, GPU provenance, quality tiers and source revision were not independently verified in this task.

The only project file written by this reviewer is this report. No existing scorecard or implementer document was altered.

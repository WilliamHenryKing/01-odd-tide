# ODD TIDE — art direction (directive §3.4)

26 September 2026, root director (Claude Opus 5.5) after inspecting the reference shortlist as images. **This sets the target; it is not evidence that the scene meets it.** Reference photographs are copyrighted and stay link-only; nothing here ships. Poly Haven previews are CC0 but are used here only as lighting references.

## Three words

**Salt-bright · sheltered · curious.** A real, sun-warmed coast made small enough to hold, with rooms you want to climb into and a sea that keeps rearranging the paths.

## What stays true, what is stylised

| Kept physically true | Deliberately stylised |
|---|---|
| Metric scale (1 unit = 1 m): cabins 4–7 m, doors 2 m, boards 140 mm, tiles ~400 × 250 mm | Archipelago compressed and composed like a travel poster: three islets within ~70 m, arranged for the arrival camera |
| One sun/moon from the solar model; sky, IBL, haze and sun colour from one atmosphere (`src/world/render/atmosphere.ts`) | Palette pushed by material choice, never by tinted lights: coral-glazed Weather House roof, blue-green ceramic observatory dome, deep green lodge |
| Water level is the domain tide (`waterHeight`), so wet rock, exposed shelves and the causeway follow the same numbers as the planner | Tide range exaggerated for readability (~2.6 m between 09:00 and 15:00) |
| Practical lamps in candela, emissive surfaces in cd/m², one exposure (EV100 → pre-exposure) | Night exposure held about two stops under a "correct" moonlit exposure, with a scotopic grade, so night reads as night |
| Construction: footings, sills, battens, overlapping tile courses, hinges and fixings where the camera can see them | Fixings and repeated construction are instanced procedural geometry; small detail simplified where it cannot resolve |
| Intertidal zonation: dark wet sandstone and green-brown algae below the high-water line, pale dry stone above | Vegetation kept to a few recognisable coastal families with broken silhouettes, not botanical survey accuracy |

## Selected references (links only)

| # | Reference | What it establishes |
|---|---|---|
| 1 | [NPS Cabrillo — layered sandstone "geological cake"](https://home.nps.gov/cabr/blogs/life-on-the-rocks-part-1-baking-a-geological-cake.htm) (Cake_3 photo) | Warm tan/ochre sandstone with thin bedding planes, rounded eroded boulders, flat shelves; wet rock markedly darker |
| 2 | [NPS Cabrillo — tidepools virtual visit](https://home.nps.gov/cabr/learn/nature/a-virtual-visit-to-the-tidepools.htm) (images 10_22, 11_12, 13_10, 15_7) | Sandy coastal paths, timber post-and-rope railings, dense grey-green scrub, crisp midday shadows, deep-blue zenith |
| 3 | Same page, low/high tide north pair | The same shoreline covered and revealed: shelves, pools, wet and dry bands |
| 4 | [NPS Cabrillo — broom baccharis](https://home.nps.gov/cabr/blogs/the-bloomin-broom.htm) (Broom1_1) | Scrub silhouette: dense, rounded but broken outline of many small leaf clusters over a woody base |
| 5 | [Kew — plants on the UK coast](https://www.kew.org/read-and-watch/plants-beach-uk-coast) | Distinct structures: fine grass blades, sea thrift cushions, woody gorse, a pine canopy |
| 6 | [HOLON — Flokehyttene](https://holon.no/prosjekter/flokehyttene/) (MG_9784, MG_9749) | Timber cabins perched on bare rounded rock with a tidepool; deep glazing framing the horizon from a warm timber room |
| 7 | [Kolman Boye — Writers House Vega](https://kolmanboye.se/project/vega-norway/) | A small timber house meeting irregular rock; boards, openings and path at dwelling scale |
| 8 | [by Stinessen — Manshausen 2.0](https://bystinessen.com/architecture/manshausen2/) | Supports and shoreline clearance for a cabin cantilevered over rock and water (Lantern Lodge underside) |
| 9 | [by Stinessen — Manshausen interiors](https://bystinessen.com/interior-design/manshausen/) | Small-cabin room depth, bed withdrawn from full-height glazing, few built-in pieces |
| 10 | [Ludowici — Private Residence, Maui](https://ludowici.com/gallery-study/private-residence-maui/) (Classic-16 images 1 and 3) | Blue-green glazed ceramic roof: unit-to-unit glaze variation, specular glints, eave and ridge transitions; also the aerial of turquoise shallows over pale sand beside dark rock |
| 11 | [Ludowici — residential roofing guide PDF, pp. 32–38](https://ludowici.com/wp-content/uploads/LRT-611-Residential-Brochure-0718.pdf#page=34) | Separate overlapping units (pan/cover), tile length, eave and ridge detail rather than long ribs |
| 12 | [Hikki — Bohemen outdoor bath](https://hikkisweden.com/products/bohemen) (main, side view, top, evening) | Bath construction: wall thickness, rim, internal bench, stove with flue, lantern and fire glow at dusk on a timber deck |
| 13 | [Skargards press gallery](https://www.skargards.com/ie/about-skargards/press-and-media/) | Round cedar hot tub on a rocky shore: staves, steel bands, steps, stove chimney |
| 14 | [Poly Haven — Sundowner Overlook](https://polyhaven.com/a/sundowner_overlook) | Clear coastal afternoon: warm sun against a cool sky, the sea's relation to the sky |
| 15 | [Poly Haven — Golden Bay](https://polyhaven.com/a/golden_bay) | Dusk: small warm practicals and their reflections in calm water under a cool blue sky |
| 16 | [Poly Haven — Cloudy Cliffside Road](https://polyhaven.com/a/cloudy_cliffside_road) | Soft coastal haze: horizon lighter than the sea, distant land dissolving into aerial perspective |

Previews of 1–4, 6, 10, 12 and 14–16 were inspected as images (18 frames in one sheet). 5, 7–9 and 11 are retained from the independent shortlist on the strength of their recorded captions; their galleries did not return usable images to the downloader.

## Lighting states and targets

Directions are world-space from the solar model: the camera looks from +X+Z toward the island. "Display" values are 8-bit sRGB after the AgX output transform, measured in captures.

| State | Key | Sky and background | Luminance relationships (display sRGB) |
|---|---|---|---|
| **09:00 arrival (low water)** | Sun 37.6° elevation from camera-left/front (az ≈ 72°), ~102 klx, warm-neutral | Clear, ~28% fair-weather cumulus; zenith mid-blue, horizon near-white haze; sea reflects it | Sunlit dry sandstone tops 150–190; shaded cliff faces 70–110; wet shelves 55–85; open sea 90–130 teal-blue; shallows over sand 140–180 pale cyan; coral roof lit 150–175; interiors through glazing 30–60 |
| **15:00 high water** | Sun 44.6° from camera-right/back, ~98 klx, neutral | As above, slightly bluer; more sparkle toward the sun | Shelves submerged; causeway stones under ~1.2 m of water; sea 85–125; roof and cliff ratios as arrival |
| **18:30 dusk** | Sun 2.0° from camera-right/back, ~14 klx, deep gold (transmittance ≈ 0.29/0.07/0.005) | Peach horizon under blue zenith; sun glitter path on water | Rim-lit edges 170–220; faces away from sun 45–80 (sky-lit, bluish); lanterns just readable (emissive, no pools yet); windows warming |
| **19:15 blue hour** | No direct sun; sky ~10 lx at −6° | Pink/orange glow over the set sun, blue-violet elsewhere | Lamp pools 120–200 near sources; lit windows the brightest surfaces; terrain 25–45 |
| **21:00 night** | Moon 45° elevation, phase ≈ 0.67, ~0.085 lx | Stars and a faint band, dark blue sky; moon disc at true size | Moonlit rock 20–40 after scotopic grade; lamp pools 150–230 with small glare; windows 200+; sea 10–25 with a moon glitter path |

Rules: no light added to rescue an object; no emissive boosts; practicals switch on in an authored stagger from 18:00 but their brightness comes only from exposure. Night colour comes from the grade, not blue lights.

## Materials (targets for look-dev)

- **Sandstone**: tan-ochre albedo ~0.30–0.40, roughness 0.8–0.95, thin horizontal bedding from a height-banded tint, triplanar-mapped to avoid stretching on cliffs; below high water darker (albedo × 0.55) with green-brown algae in crevices; wet film gloss (roughness 0.35) only within ~0.3 m of the current water line.
- **Sand**: albedo ~0.45 dry, ~0.28 wet, fine ripples; darkens where the tide has just retreated.
- **Turf/coastal grass**: low-saturation olive (albedo ~0.12–0.18), actual grass-blade clumps near the camera.
- **Weathered timber**: silver-grey boards, albedo 0.30–0.40, visible grain and board-to-board variation (±10% value, small hue shift).
- **Painted timber**: lodge green (albedo ~0.06–0.08) and Weather House cream; paint wear on edges.
- **Glazed terracotta**: coral albedo ~0.35–0.45 under a clear glaze (clearcoat 1, coat roughness 0.08–0.2); tile-to-tile value/hue variation ±8%.
- **Blue-green ceramic**: observatory dome scales, albedo ~0.15–0.25, glazed; unit variation per R10.
- **Brass**: metallic 1, roughness 0.25–0.45, darkened in recesses.
- **Glass**: thin, clear, reflective windows showing the sky; slight green edge tint.
- **Linen/wool**: roughness 0.9+, sheen, visible weave only at arm's length.

## Composition

- **Arrival**: the archipelago fills the right two-thirds of the desktop frame as one reading silhouette; the causeway and bath sit in the left third near the headline's lower edge but never under text; horizon near the top edge so the sea dominates. Portrait uses its own camera: island centred in the upper half, time instrument visible in the first viewport.
- **Cabin hero shots**: three-quarter views at eye height ~6–9 m, roof lift readable, interior lamp as the brightest point at dusk.
- **Payoff**: the chosen cabin at dusk, lamps on, water rising around the shelves, postcard framing.

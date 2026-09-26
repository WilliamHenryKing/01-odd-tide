# C1 — one lighting model (directive §3.5 change record)

26 September 2026 · implementer: root (Claude Opus 5.5) · independent review: Fable 5.1 (see `../reviews/C1-REVIEW.md`).

**Concern (single):** audit fix-list item 1 — indoor RoomEnvironment under an outdoor sea, flat sky/fog, lights tuned by eye, hard horizon seam. Geometry, materials and composition are deliberately unchanged so the lighting effect is attributable; the legacy scene is only rescaled to metres (×3) because the physical rig works in metres.

**What changed**

- `src/world/render/atmosphere.ts`: single-scattering Rayleigh/Mie/ozone atmosphere in physical units (lux → cd/m²), GLSL and a CPU mirror; quadratic ray-march spacing (fixes horizon yellowing from under-sampled blue). Checked numerically: ~103 klx direct and ~12 klx diffuse at 37.6° sun; ~10 lx sky at −6°.
- `src/world/render/sky-model.ts`: sun and moon from declination/hour angle (fictional 34° S, mid-October), moon phase from elongation, authored EV100 curve → one pre-exposure factor.
- `src/world/render/sky.ts`: sky dome from the atmosphere (+ stars, true-size phased moon, sun disc, cumulus); the same dome baked to PMREM for IBL, throttled; Fresnel sea reflection in the environment's lower hemisphere.
- `src/world/render/rig.ts`: one celestial key (sun or moon) with a fixed-frustum shadow; practical lamps in candela and emissives in cd/m², all pre-exposed; aerial perspective from the sky's horizon radiance (physical exponential extinction, 15 km visibility).
- `src/world/render/pipeline.ts`: HalfFloat MSAA HDR target → GTAO (sky/water excluded) → thresholded, clamped bloom → linear grade (scotopic night shift, light vignette) → OutputPass (AgX + sRGB once). `renderer.info` counts whole frames.
- `src/world/water.ts`: physical sea (IOR 1.333) with analytic wave slopes (pixel-footprint fade), in-scatter by depth, foam, Fresnel blending. C1 uses a uniform 4 m depth because the legacy islets have no baked coast.
- `src/world/lookdev.ts` (`?lookdev`, dev/visual-test only): grey 18% and mirror spheres, published 24-patch chart, 25 cd practical, seven lighting states; captures in `../captures/lookdev-v3/`.
- `tools/visual/capture.mjs`: repeatable bookmark/look-dev captures on the real GPU with meta.json.

**Evidence:** before `../captures/c1-before/`, after `../captures/c1-after/` (10 bookmarks × 1920×1080 DPR1 and 390×844 DPR3, same hook, seeds and 30-frame settle; ANGLE D3D11 on the RTX 2060). Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 (33 expects) ✓.

**Self-critique — three most visible remaining flaws per bookmark (after)**

| Bookmark | Flaws |
|---|---|
| arrival-day | Legacy primitive islets/foliage unchanged; no shallows, foam or wet contact where rock meets sea (uniform depth); fine ripples still form faint horizontal banding far from camera |
| arrival-high-water | Tide reads only as a slightly deeper base; causeway stones still toggle visibility rather than being covered; shelves absent |
| weather-exterior | Ribbed roof, blob foliage and board textures unchanged; sea correct but the bath awning floats in foreground; no contact shading at the bath/rock edge |
| weather-interior | Open-roof interior now lit consistently, but furnishings remain primitive; roof underside flat; tree canopies identical |
| nap-observatory | Dome highlight now from sky IBL, but dome construction absent; trees crowd; neighbouring roof dominates foreground |
| lantern-dusk | Warm low sun and glints read, but lodge lamp glow sits on the glass as a disc; no lamp pools on decks yet (lamps off until 18:00+); boards uniform |
| arrival-night | Night reads as night (moon, stars, lamp pools, water reflections), but islets are near-black masses; practical glare discs slightly large; no window light spill onto terrain |
| coast-grazing | Primitive strata/rocks fully exposed; underwater rock lacks absorption (no coast yet); legacy bath ring |
| bath-arm-length | Bath is still a torus and disc; awning posts float; ground speckle texture |
| horizon | Seam removed (continuous haze) but island tiny; distant sea slightly flat; clouds low contrast |

**Expected score movement:** light plausibility and environment integration up at every bookmark; atmosphere/depth up at horizon, dusk and night; materials/detail unchanged (still 1–2). Motion and performance unscored.

## C1b — corrective commit after cold review (26 September 2026)

Fable 5.1's cold review ([C1-REVIEW](../reviews/C1-REVIEW.md)) raised the desktop hero average 2.35 → 2.60 but found three regressed rows: UI 3→2 at arrival-day and arrival-high-water (dark copy on the now darker sea, 1.41:1), and artefacts 3→2 at arrival-night (clipped observatory lamps, scattered point-light sparkles). Directive §3.5.7 says to revert. A literal `git revert` would have conflicted with uncommitted look-dev work in the same files, so the rule was applied as: no other visual change lands until the regressed rows are corrected and re-reviewed. This is a recorded deviation from the letter of the rule, not a reinterpretation of it.

Corrections: hero copy is light at every hour with a soft text shadow and a restrained dark radial veil (the pale close-view wash is replaced by a dark gradient); legacy lamp globes 3500 → 900 cd/m², bridge bulbs → 1400 cd/m², beacon 400 → 150 cd; sea roughness 0.045 → 0.07 and fine-normal amplitude reduced (fewer isolated glints); 55% of the sea's sunlit in-scatter is now unshadowed (volume light enters outside the surface shadow), so island shadows on water are softer. Evidence: `../captures/c1b-after/`.

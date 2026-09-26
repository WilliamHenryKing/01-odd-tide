# ODD TIDE — Phase 0 visual audit

26 September 2026. **Baseline, not approval.** No aesthetic changes have been made in this reset. The source is the earlier rejected implementation plus development-only capture instrumentation. Subsequent D01 review rejects the baseline; D02's local hardware policy is measured and adopted. Historical frame findings below are preserved. William has now paused before look-dev and visual rebuilding; see the root HANDOFF.md.

## Evidence and method

[All frames and full renderer inventories](captures/baseline/meta.json). Ten code bookmarks × existing tier × 1920×1080 DPR1 / 390×844 DPR3. Actual drawing-buffer DPR is capped at 1.6 by the existing application. `*_webgl.png` is the raw canvas; `*_canvas.png` is a screenshot of its screen rectangle and includes overlapping HTML. `*.png` without those suffixes is the complete viewport. The two contact sheets are navigation aids, not substitutes for full frames. Fixed authored seeds, simulation time zero, paused animation and 30 settled frames. Hook rejects unknown bookmarks, tiers and seeds. Source hashes and prior commit are in meta.json.

GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 (0x00001F15) Direct3D11 vs_5_0 ps_5_0, D3D11). WebGL2 r186, no software-renderer flag. These are real GPU-rendered frames; no frame-rate claim follows. Browser viewport emulation is not a physical phone test.

## Renderer, colour and lighting

React + direct Three.js, WebGLRenderer. Colour management enabled; output sRGB (verified runtime and installed renderer default); AgX once in renderer, exposure 1.12. The custom water shader includes tone-mapping and colour-space chunks once. No evidence of double tone mapping. Renderer MSAA is enabled; no post passes, AO, bloom, SMAA or spatial reflection pass. PCF shadow map 2048²; fitted fixed bounds x ±11, y ±10, near 1 / far 50, bias -0.00015, normalBias 0.025. It is not texel-snapped.

| Light | Existing setup |
|---|---|
| Directional sun | Day 4.1, dusk 18:30 2.125, night 0.15 intensity; day position (-7,12,9), interpolated to (-10,3,9). Warm colour shifts toward salmon. Only shadow-casting light. No real-sky luminance calibration. |
| Hemisphere | Sky #d7edea / ground #324b40; intensity 1.6 → 0.25. |
| Three cabin PointLights | Each 0 → 3 cd, distance 3.5, decay 2; no shadows. These are intended practicals, not evidence of calibrated fixture output. |
| Beacon PointLight | 12 cd only after three discoveries, distance 8, decay 2; no shadows. |
| Environment | PMREM generated from Three RoomEnvironment, blur 0.06; environment intensity 0.42 → 0.12. The visible scene is an outdoor sea and flat sky/fog. This is a documented mismatch. |
| Bridge bulbs / fixture emission | Emissive intensities rise with dusk; bridge bulbs have no corresponding local light. Emission does not illuminate the decks. |

Linear Fog distance 30–90 follows background colour. The wide sea shader uses an independent distance mix. Low inspection angles reveal a hard horizon transition rather than physically connected sky/sea aerial perspective.

## Mesh families, origins and maps

All scene geometry is authored procedural geometry assembled from primitives. No scanned or externally modelled hero/natural asset is present. The table is the complete live mesh inventory grouped by family; triangles here count geometry once per mesh, whereas renderer totals include multiple render passes.

| Family | Meshes | Geometry triangles | Source geometry |
|---|---:|---:|---|
| terrain strata and rock fragments | 108 | 11,664 | ExtrudeGeometry, IcosahedronGeometry |
| cabin:weather-house | 68 | 19,144 | CylinderGeometry, RoundedBoxGeometry, SphereGeometry |
| cabin:nap-observatory | 42 | 13,792 | CylinderGeometry, RoundedBoxGeometry, SphereGeometry, TorusGeometry |
| cabin:lantern-lodge | 67 | 18,608 | CylinderGeometry, RoundedBoxGeometry, SphereGeometry |
| borrowed bath | 15 | 5,304 | CylinderGeometry, RoundedBoxGeometry, SphereGeometry, TorusGeometry |
| site fixtures and decoration | 102 | 18,002 | BufferGeometry, CylinderGeometry, IcosahedronGeometry, RoundedBoxGeometry, SphereGeometry |
| foliage | 340 | 18,560 | CylinderGeometry, IcosahedronGeometry |
| discovery markers | 6 | 1,560 | OctahedronGeometry, TorusGeometry |
| shader water | 1 | 2 | PlaneGeometry |

Materials: timber, stone and ceramic use 256² seeded CanvasTextures. Timber and stone reuse their sRGB albedo texture as a bump/data map. No normal, roughness, metalness or AO texture maps appear. All roughness variation is a constant per material. Terrain and foliage rely heavily on flat colour/silhouette. Water is a procedural ShaderMaterial with painted colour/crest variation rather than environment-consistent reflection. Glass/ceramic/brass use physical/standard materials, but the close-up result lacks the material references and microstructure required by the directive. Complete per-material maps/values are in each info record.

## Measured resource counts

| Bookmark | Desktop calls / triangles | Portrait calls / triangles |
|---|---:|---:|
| arrival-day | 1,464 / 202,200 | 1,464 / 202,200 |
| arrival-high-water | 1,444 / 200,600 | 1,444 / 200,600 |
| weather-exterior | 1,332 / 177,472 | 1,301 / 170,224 |
| weather-interior | 1,375 / 185,908 | 1,341 / 178,912 |
| nap-observatory | 1,416 / 195,080 | 1,060 / 140,990 |
| lantern-dusk | 1,391 / 196,432 | 1,314 / 183,120 |
| arrival-night | 1,464 / 202,200 | 1,464 / 202,200 |
| coast-grazing | 1,456 / 200,766 | 1,391 / 187,678 |
| bath-arm-length | 1,076 / 160,190 | 938 / 136,806 |
| horizon | 1,464 / 202,200 | 1,464 / 202,200 |

All bookmarks report 743 geometries and 7 renderer textures. Repeated vegetation comprises 340 individual meshes; site fixtures add 102. No performance diagnosis is claimed from counts alone, but this is a clear batching investigation target.

Public asset files total 1,075,164 bytes (about 1.03 MiB); generated textures/render targets are additional GPU allocations. D02 now supplies the local residency/timing policy; compressed delivery bytes remain a separate project allocation, not a value inferred from VRAM. These counts are not GPU memory bytes. No glTF assets exist, so glTF validation is not applicable to this baseline.

## Failure patterns established by frames

1. **Primitive-dominant natural forms:** [coast detail](captures/baseline/coast-grazing_existing_desktop_webgl.png), [200% crop](captures/baseline/coast-grazing_200pct.png). The cliff is visibly repeated shelves; rocks are low-subdivision polyhedra. Foliage is repeated flattened blobs. This is not cured by a colour grade.
2. **Uniform or inadequate materials:** [open cabin](captures/baseline/weather-interior_existing_desktop_webgl.png). Timber, textiles and paper-like white furniture lack appropriate roughness/normal structure and joinery. Speckle texture is not a credible rock surface.
3. **Environment mismatch / weak grounding:** RoomEnvironment reflects an indoor setup, while the view shows an outdoor sea. [Bath at arm length](captures/baseline/bath-arm-length_existing_desktop_webgl.png) exposes sparse fixture construction, no convincing rim-to-water contact and weak attachment cues.
4. **Depth and exposure:** [horizon](captures/baseline/horizon_existing_desktop_webgl.png) shows a hard tonal boundary and an undersized distant island. [night](captures/baseline/arrival-night_existing_desktop.png) is mostly a darker version of the same flat sea; no calibrated night setup exists.
5. **Review failure:** earlier real screenshots were inspected, so this was not literally an absence of frames. The failure was accepting insufficient material/form quality and treating functional completion as adequate visual completion. William has rejected that judgement.

## Ranked fix list / gate

1. Establish subject references and coherent daylight/dusk/night look-dev; remove the indoor/outdoor environment mismatch and separate colour/data maps.
2. Replace the coastline and vegetation with licence-clean sourced material/geometry candidates; preserve the tide/access rule and authored geography. Candidate sourcing waits on the asset profile.
3. Rebuild one Weather House close view to referenced construction: joints, fixings, roof thickness, glazing edges, seating/textile detail. Keep procedural work only where justified in ASSET_PLAN.
4. Make water, shore contact and practical lighting respond to the same environment.
5. Batch repeated meshes after composition/asset choices; verify mobile framing and collect target-device performance.
6. Repeat identical bookmarks, independent review, score deltas and commit only through the new gate.

**Orchestrator update after the hardware session: Phase 0 factual audit and independent cold review are complete; the baseline is rejected.** William resolved D01 and authorised D02, now measured in the [local-machine policy](../../../../docs/visual/LOCAL_MACHINE_BUDGET.md). On William's resumption after the handover pause, proceed with exact-pipeline look-dev and inspected reference selection, then one visual concern through the directive's change loop. The [independent review](INDEPENDENT-REVIEW-2026-09-26.md) supplements the preserved self-scorecard. D03 remains specific to unchanged existing OFL fonts; it does not block unrelated material work. No assumed budget, unapproved dependency or new asset licence may silently become an implementation constraint.

## Supplemental responsive capture

Arrival UI captured at CSS breakpoint widths 360, 1100 and 1600 in portrait/landscape pairs, plus protanopia/deuteranopia/tritanopia at desktop and phone widths. [Metadata](captures/baseline/responsive-meta.json). All six layout cases have no horizontal document overflow. This is arrival-UI coverage, not every bookmark at every supplemental width. The main matrix covers every bookmark at desktop and portrait DPR3. Colour-vision states are emulations, not accessibility sign-off.

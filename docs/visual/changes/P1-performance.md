# P1 — frame cost back inside the local budget, pixels unchanged (change record)

27 September 2026 · implementer: root (Claude Opus 5.5). A performance change with no intended visual change, so its acceptance test is numerical: the frames must match C4's and the real-scene path must meet `docs/visual/LOCAL_MACHINE_BUDGET.md` (collection root).

**Why:** after C4 the real-scene path measured GPU p95 21.7 ms at full HD on the RTX 2060 (budget ≤ 13.33 ms), RAF p95 23.8 ms (budget ≤ 16.92 ms), with 976 draw calls and 8.26 M triangles a frame against a scene inventory of 0.79 M.

**Diagnosis.** GPU timer queries around every composer pass and every shadow-map render (dev-only instrumentation, not committed), 45 frames per view at 1905 × 860:

| C4, ms per frame | arrival-day | lantern-dusk | arrival-high-water | horizon |
|---|---|---|---|---|
| scene pass (excluding shadows) | 8.21 | 13.68 | 12.26 | 8.03 |
| shadow maps in the scene pass | 1.32 | 1.13 | 1.32 | 1.30 |
| GTAO | 2.06 | 2.25 | 2.10 | 1.71 |
| shadow maps again inside GTAO | 1.00 | 0.89 | 1.00 | 0.98 |
| bloom + grade + output | 0.98 | 1.09 | 1.00 | 0.96 |
| total | 13.57 | 19.04 | 17.67 | 12.98 |

Hiding one thing at a time inside the scene pass: the sky dome cost 3.7 ms at the horizon view and 6.5 ms at lantern-dusk, where the sky fills about a fifth of the frame; the terrain and far seabed 2.7 and 3.8 ms; the sea 0.5 ms; practical lights up to 1.6 ms; MSAA 1.2–2.0 ms.

**What changed**

1. `render/sky.ts`: the sky dome draws last among opaque objects (`renderOrder` −1000 → 1000). Drawn first, its ray-marched atmosphere (16 view × 6 light steps) ran for every pixel before the island and seabed covered it; now early depth rejection limits it to visible sky. The blended sea and glass still draw after it.
2. `terrain-material.ts` + `island.ts`: the 3 km far seabed ring uses a flat-sand variant of the terrain material (`TERRAIN_FLAT_SAND`): 3 texture fetches instead of 21, and the same result, because the full shader already resolves that ring to sand. The baked terrain, including its own seabed and the C2b seam, keeps the full shader.
3. `render/pipeline.ts`: GTAO's pre-pass is a full `renderer.render()`, and three.js redraws every shadow map on each render call. The pass now runs with shadow auto-update suspended, so the 4096² sun map and the six-face interior cube draw once a frame.
4. `island.ts`: the interior cube shadow (six faces) redraws only while the selected stay's lamp is lit and its stay, opening or lamp position changed. It renders once at start-up: an unallocated shadow map left shadow samplers bound to the wrong texture type, and every draw that sampled it failed (`GL_INVALID_OPERATION`, caught by the pixel check below before commit).
5. `render/rig.ts`: forced frames (captures, the benchmark path) rebaked the environment every frame. The environment depends only on the hour, so a forced frame now rebakes only when the hour differs; the throttle still applies to interactive frames.

**Pixel check** (`../captures/p1-check/`, desktop, against `../captures/c4-after/`): mean absolute error ≤ 0.074% at every bookmark; at most 51 of 1,638,300 pixels differ by more than 3% (weather-exterior), consistent with frame-to-frame noise in AO and bloom. No console errors or warnings.

**Real-scene path** (`tools/perf/scene.json`: two 60-second passes through all eleven bookmarks, 10 s warm-up, full HD, headed Chrome on the RTX 2060; `../perf/`):

| | C4 (`c4-scene-baseline`) | P1 (`p1-scene`) | budget |
|---|---|---|---|
| GPU p95, ms | 20.86 / 21.66 | 11.58 / 11.74 | ≤ 13.33 |
| worst segment GPU p95, ms | 21.4 (lantern-dusk) | 12.1 (lantern-dusk) | ≤ 13.33 |
| CPU submit p95, ms | 8.5 / 8.5 | 4.0 / 4.1 | ≤ 13.33 |
| RAF p95 / p99, ms | 23.5 / 24.0 | 16.0 / 16.1 | ≤ 16.92 / ≤ 25 |
| gaps > 50 ms | 0 | 0 | 0 |
| draw calls / triangles per frame (max) | 976 / 8.26 M | 414 / 2.19 M | — |
| GPU temperature at end, °C | 70 / 74 | 75 / 77 | stop at 85 |

Per segment, GPU p50/p95 in ms (C4 → P1 first pass): arrival-day 15.6/16.0 → 9.4/9.7; arrival-high-water 18.3/19.0 → 9.5/10.6; weather-exterior 15.9/16.2 → 10.0/10.3; weather-interior 15.7/16.4 → 9.7/10.8; nap-observatory 16.0/16.7 → 10.7/11.8; lantern-dusk 21.0/21.4 → 11.6/11.9; arrival-night 17.5/18.8 → 9.7/11.5; coast-grazing 16.7/17.1 → 9.6/10.0; bath-arm-length 15.5/18.0 → 8.5/11.1; planting-close 17.6/18.1 → 10.7/11.1; horizon 15.2/17.5 → 8.8/9.5.

`p1-rebake-rule` is the intermediate run with only change 5, kept as measured (GPU p95 19.65 / 19.90 ms).

**Limits of this evidence:** two 60-second passes on one desktop GPU, not the 12-minute sustained soak; headroom at the worst segment is 1.2 ms. A fresh sustained run belongs at ODD TIDE's completion, after C5 and any later visual changes. Phone GPUs remain unmeasured.

**Remaining cost, for later changes:** GTAO at full resolution (~2.1–2.9 ms), MSAA 4× on a half-float target (1.2–2.0 ms), and the forward-lit practicals (up to 1.6 ms at dusk).

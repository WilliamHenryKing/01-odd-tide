# C7 — an ocean instead of a patterned plane (change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: pending (queued after C5/C6).

**Concern:** every review since C2 recorded the sea's regular ripple striping toward the horizon and ripple tiling in the arrival views' top band, the hard polygonal shadow on the water beside the observatory's cliff, and a hairline at the horizon. The sea fills most of every public frame. Under D08 (fidelity first) it gets a proper ocean rather than a tuned pattern.

**What changed**

- `render/ocean-normals.ts` (new): at start-up, a Tessendorf-style synthesis — a Phillips wind-wave spectrum (6.5 m/s breeze) on a 256² periodic grid, inverse-FFT'd to a height field and differentiated — produces a tileable slope map with thousands of wave components. RG hold the normalised slope, BA the squared slope, so mipmaps also average slope variance (LEAN mapping). The generator reports the map's RMS slope so the shader can set each layer's physical RMS slope; the spectrum itself has no absolute amplitude. (A first draft scaled layers by the 99th-percentile slope instead: RMS slopes of ~1.4, a dark, mottled sea; caught in look-dev.)
- `water.ts`: the sea is a 256 × 191 radial grid centred on the island (0.4 m rings near the centre, growing geometrically to 19 km, inside the sky dome), carrying six Gerstner swell components (3.5–21 m, 1.8–10 cm) that shrink in the shallows and fade out beyond 80–220 m, where the rings are wider than the swell. Per pixel: the swell's analytic slope plus two scrolled, rotated FFT layers (17 m and 6.5 m tiles, RMS slope 0.05 and 0.045, calmer in the shallows); detail finer than a pixel fades by footprint and hands its slope variance to the GGX roughness (α² + 2σ²), so the far sea keeps a sun glint instead of aliasing into stripes; thin swell crests pass a little green-teal light when backlit; the shadowed share of the water's own in-scatter drops from 45% to 30%. The last rings rise by up to 60 m (at most 0.2° of view), so the sea meets the horizon without a sliver of the dome's lower hemisphere between them.
- `terrain-material.ts`: under water, light scattered in the water column fills shadows on the seabed, more with depth (up to 70%, with a 2 m scale), so a cliff's shadow seen through several metres of water is soft and shallow rather than a hard polygon.

**Evidence:** before `../captures/c6-after/`, after `../captures/c7-after/`. Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓, no console errors or warnings.

**Cost** (`../perf/c7-scene/`, advisory under D08): GPU p95 12.91 / 13.13 ms; worst segment nap-observatory 13.3 ms; RAF p95 16.0 ms, no gap over 50 ms; 444 draw calls, 2.34 M triangles a frame. The C6 camera changes (closer stay shots) were not measured separately and are included in the change from C5's 12.0 ms.

**Self-critique — three most visible remaining flaws**

| Bookmark | Flaws |
|---|---|
| arrival-day | Faint long crests still line up in the far top band; the far sea is darker than the sky at the horizon (plausible, but flatter than a bright calm-day sea) |
| lantern-dusk | Glitter path is textured but lacks the sun's elongated streak toward the camera |
| nap-observatory | The water beside the cliff reads correctly soft, but the swell pattern from above repeats at the 17 m layer's scale if looked for |
| horizon | Swell shows as parallel bands between 200 m and 1 km before fading |
| all | The ripple layers scroll rather than evolve; motion will show it where stills cannot |

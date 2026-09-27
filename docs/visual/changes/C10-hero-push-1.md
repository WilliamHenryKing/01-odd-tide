# C10 — hero push, part 1: contrast, density, lamps, finish, foliage edges (change record)

27 September 2026 · implementer: root (Claude Opus 5.5). Commits: `Hero push part 1`, `Weather House: inner raking trims`, `Foliage: alpha-bled colour maps`. Verification: batch cycle-02 (run unattended after studio run-01, D10). Independent review deferred to the ODD TIDE completion milestone.

**Items from `../reviews/C5-C6-REVIEW.md` and `../reviews/C4B-REVIEW.md`**

| Review item | Change | Evidence |
|---|---|---|
| Annotation 2.0–2.5:1, pills 3.3–4.1:1 | Annotation on a frosted teal chip; pills near-opaque cream with ink text | `../captures/cycle-02-captures/arrival-day_existing_desktop.png` |
| Mobile rendered at 600×640 and upscaled 3× | Render resolution by pixel budget (~3.7 MP) up to the device's density (D08) | `../captures/cycle-02-captures/*_mobile.png` |
| Lamps not the brightest point at dusk (sky 252 L, lantern 239 L) | Lantern glass 24–26k cd/m² (flame-like surface luminance) | `../captures/cycle-02-captures/lantern-dusk_existing_desktop_webgl.png` |
| Struts with no brackets | Brass brackets on the wall plate and under the lid | `../captures/cycle-02-captures/weather-interior_existing_desktop_webgl.png` |
| Stepped lining ends visible through the open hatch | Inner raking trims along both pitches of the back gable | same |
| 1-px dark alpha fringe on blade and leaf cards | Alpha-bled colour maps (`tools/assets/bleed-foliage.mjs`), recorded in the manifest | `../captures/cycle-02-captures/planting-close_existing_desktop_webgl.png` |

**Checks:** `tsc` ✓, Biome ✓, capture set with no console errors, plates re-rendered, production build and prerender ✓ (`../batch/cycle-02/summary.json`).

**Still open (next parts):** portrait arrival framing (the island sits below the copy on phones; the art direction wants it in the upper half with the time instrument in the first viewport); the second tree species from studio run-02's milkwood family; sky and water polish from the C5-C6 review (§7 items 1–2, partly addressed by C7); journeys verification and packaging.

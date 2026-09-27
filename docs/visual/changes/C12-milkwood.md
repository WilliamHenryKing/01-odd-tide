# C12 — coastal milkwoods, the island's second tree species (change record)

27 September 2026 · implementer: root (Claude Opus 5.5). Independent review deferred to the ODD TIDE completion milestone.

**Why.** The island had one tree form (four wind-combed "pines" with branch-end leaf clusters). The asset plan and the studio slate call for a second species; studio runs 01–02 explored the coastal milkwood (`tools/studio/recipes.ts`, `milkwood-tree`), whose run-01 form read as a lollipop and whose run-02 form set the proportions used here.

**Change** (`src/world/vegetation.ts`)

- Three milkwoods placed on level turf with room for a crown, clear of buildings, paths and the pines. Margins relax in steps (1 → 0.5) until three fit, strictest first; their own seeded random stream, so the pines, scrub and turf keep their exact forms. An empty set can no longer break the world build (an early version crashed `mergeGeometries` and the loader correctly showed its failure state).
- Form: a short, flared trunk (0.30 → 0.20 m) that splits at 1.0–1.4 m into four to six limbs; a dome 4–6 m across in three tiers of dense lobes — a skirt low around the limbs, a shoulder ring and a crown — 130 leaf cards a lobe, darker at the skirt.
- Leaves: the scrub's leaf cards in their own material (`milkwood-cards`), darker (0.24, 0.36, 0.17) and at roughness 0.74; at 0.55 the whole crown turned silver with sky reflections.
- Cost: one draw call, about 11,000 triangles for the three crowns plus limbs merged into the existing trunk mesh.

**Evidence** (`../captures/c12-milkwood/`)

| Step | Frames | Read |
|---|---|---|
| First form | `milkwood-{a,b}_1-first.png` | Good trunk and limbs; the crown a sparse, flat umbrella — olive or acacia, not milkwood |
| Tiered dome | `milkwood-{a,b}_2-tiers.png` | Dense, rounded, low; silvery sheen at roughness 0.55 |
| Final | `milkwood-{a,b}_3-final.png` | Dark, closed domes on short forked trunks; distinct from the pines' open, lighter crowns |
| Context | `arrival-day_existing_{desktop,mobile}.png`, `island-top-noon.png` | Two milkwoods read beside the Weather House and above the stairs; C11 phone layout unchanged |
| No regressions | `coast-grazing_existing_{desktop,mobile}.png` against `../captures/cycle-03-captures/` | Unchanged (no trees in frame) |

**Checks:** `tsc` ✓, Biome ✓, no console errors in the captures.

**Open:** milkwood B stands about 3.8 m from a pine at the western cliff (placed at the relaxed margins); the plates and posters with trees in view need re-rendering (next verification cycle).

# C2 — coast, tide and access paths (directive §3.5 change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: Fable 5.1 (`../reviews/C2-REVIEW.md`).

**Concern:** audit fix-list item 2 and the cold review's first priority: the coastline read as nine evenly stacked extrusion bands with polyhedral rocks and speckle texture, and water had no depth or contact. Buildings, the bath and trees are deliberately the legacy models (re-sited in metres) so this change is attributable to the coast. Architecture (C3) and vegetation (C4) follow.

**What changed**

- `tools/assets/build-terrain.ts` → `public/models/island-terrain.glb` (1.12 MB, 85k vertices / 170k triangles, meshopt + quantized) and `island-height.bin/json` (256² top-surface heights). A signed-distance island meshed with surface nets at 0.25 m: sandstone bedding with alternating hard/soft beds and overhanging ledges, a wave-cut notch in the intertidal band, weathered plateau rims, stepped tidal shelves with rock pools, a carved sand cove facing the camera, a shallow causeway channel kept clear of shelves, shallows falling to a −6.5 m seabed. Per-vertex SDF ambient occlusion and sand/turf weights. Procedural by necessity (fictional island with authored tide levels); recorded in ASSET_PLAN.
- `src/world/terrain-material.ts`: physical material with triplanar CC0 sandstone (`cliff_side`, `rock_face_03`, re-graded toward the art direction's tan), top-projected `damp_sand` and `grass_ground`, baked AO on indirect light only, intertidal darkening and algae below high water, a wet film just above the live water line, and Beer–Lambert absorption plus sun caustics under water. Dev-only debug views.
- `src/world/water.ts`: the sea now reads real depth from the heightmap (clear shallows, shoreline foam, deep in-scatter).
- Tide: one number drives sea level, terrain wetness and the floating pontoon; the causeway's five stepping stones sit 0.2 m above the domain's safe threshold (`CAUSEWAY_STONE_TOP`), so the planner's rule is visible in the water.
- Paths (`src/world/build/props.ts`, `layout.ts`): boardwalk to the lodge, railed bridge to the observatory, stairs down to the cove and to the causeway, all standing on sampled rock; lanterns for the Lantern Walk; pontoon, buoy, lighthouse beacon and lens fragments rebuilt.
- `src/world/island.ts` rewritten on the metric layout with async asset loading behind the existing poster; bookmarks moved to metric inspection cameras.
- CC0 sourcing: `tools/assets/fetch-assets.ts` (Poly Haven download host, not its API), provenance in `assets.manifest.json`.

**Evidence:** before `../captures/c1b-after/`, after `../captures/c2-after/` (10 bookmarks × desktop 1920×1080 DPR1 and 390×844 DPR3, RTX 2060). Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓, glTF validate: no errors/warnings.

**Self-critique — three most visible remaining flaws per bookmark**

| Bookmark | Flaws |
|---|---|
| arrival-day | Legacy blob trees and box cabins now look worse against the real rock; a faint straight light band in the water toward the island; turf reads as brown soil more than grass |
| arrival-high-water | Shelves correctly drown, but shallow water over the cove sand is very pale; the legacy bath disc sits oddly on the low islet; causeway stones read small at this distance |
| weather-exterior | Legacy A-frame and blob foliage dominate; plateau rim edge reads soft/rounded; no grass geometry |
| weather-interior | Legacy interior unchanged; hatch absent; rim of plateau has no vegetation break-up |
| nap-observatory | Legacy dome and trees; the cliff strata under it are strong but the bedding repeats at similar thickness |
| lantern-dusk | Warm light on rock is right, but lamps/lanterns are only just on at 18:30; legacy lodge box; wet shelves could show more gloss at low sun |
| arrival-night | Moonlit rock reads; scattered lantern glints on water remain; legacy lamp globes still bright |
| coast-grazing | Surface-nets shelves are soft, rounded blobs rather than crisp fractured ledges at this distance; sand/rock transition is abrupt at the cove; texture tiling visible on the big flat shelf |
| bath-arm-length | Legacy torus bath is now the weakest object in frame; the islet top texture stretches slightly; no fixtures |
| horizon | Continuous haze; island small; the archipelago's silhouette is low and even |

**Expected movement:** materials, detail density, environment integration and atmosphere/depth up at arrival, coast-grazing, bath and horizon; architecture rows unchanged until C3.

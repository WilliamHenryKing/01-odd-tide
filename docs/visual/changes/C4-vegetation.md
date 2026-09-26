# C4 — coastal planting from CC0 scans replaces the legacy blob trees (change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: Fable 5.1 (`../reviews/C4-REVIEW.md`).

**Concern:** the C3 review's flaw 8 and the audit's vegetation item: two-tone sphere trees on cylinder trunks, the last primitive-looking family in every island frame, clashing with the rebuilt stays. Art direction asks for low coastal scrub, rim tussocks and a few wind-shaped trees on olive turf. Camera composition and the C3 construction flaws are unchanged here; they follow as C5.

**What changed**

- `src/world/vegetation.ts` (new module, `STAGE.vegetation` on in `island.ts`):
  - **Rim tussocks:** Poly Haven `grass_medium_02` scan, its two tall variants, 34 instances at 0.6–0.9 m on the turf's shoulder slopes; shadow casting.
  - **Turf:** ~1,900 tufts of nine blade cards each. The blades are cut from the same scan's atlas: its alpha was measured by connected components and each card carries one whole blade at its true aspect, foot at the tuft's base (18 triangles a tuft against ~1,000 for a scanned clump). Five tuft prototypes are instanced into 80 meadow patches (dense at the centre, thinning outward) plus a light scatter, closer to buildings than the larger plants.
  - **Ferns:** `fern_02` scan, all four variants, 16 instances in the lee of the buildings and bath.
  - **Scrub and canopies:** card clusters carrying `shrub_02`'s leaf texture (only its colour and alpha ship; its geometry costs 27k triangles a bush and loses its leaf cards under simplification). 18 scrub clusters of 44 cards; four wind-shaped trees with tapered procedural trunks and branches in `bark_brown_02`, leaning away from the prevailing wind, each branch ending in a 70-card canopy cluster. Cards are rolled at random in their own plane so the scan's upright leaves point every which way; normals are bent outward from each cluster's centre so a canopy shades as one volume.
  - **Shading:** thin cards shade both faces with the authored normal (three.js flips normals on back faces, which turned half of every tuft toward the ground and rendered it in shadow); grass, tussock and fern normals are lifted toward up so plants shade like the turf they grow from; the tuft material is tinted toward the art direction's olive.
  - **Masks and AO:** the scans' separate alpha masks load with `flipY` off to match glTF UVs; every alpha-tested mesh is excluded from the GTAO pre-pass, whose override material cannot cut cards out (each card occluded as a full dark rectangle over the sea and turf in draft captures).
  - **Wind:** shared uniforms sway all plants, frozen under reduced motion.
- `src/world/terrain-material.ts`: turf albedo pushed from dry soil toward spring olive (`× (0.92, 1.08, 0.78)`).
- `tools/assets/fetch-assets.ts`: vegetation jobs; a texture-only mode ships `shrub_02`'s colour and alpha to `public/textures/shrub_02/` without its geometry. `assets.manifest.json` records sources, hashes and steps; `shrub_03` and `grass_bermuda_01` were evaluated and not shipped.
- Found while measuring C4 and fixed in its own commit (4f6630e): the environment baker leaked a PMREM render target on every rebake.

**Evidence:** before `../captures/c4-before/` (this commit's code with `STAGE.vegetation` off and the turf tint reverted, so the pair differs only by C4), after `../captures/c4-after/`; 11 bookmarks × desktop and mobile each. Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓; no console errors or warnings in either run.

**Cost** (`renderer.info` at the settled arrival-day frame on the RTX 2060, both runs after the leak fix):

| | before (legacy trees) | after (C4) |
|---|---|---|
| draw calls per frame | 2,873 | 976 |
| triangles per frame (all passes) | 7.52 M | 8.26 M |
| vegetation scene inventory | — | 132 k triangles (tussocks 63 k, tufts 34.5 k, ferns 24.9 k, trunks 5.0 k, leaf cards 4.9 k) |
| vegetation download | — | 4.3 MB (bark set 1.9 MB, fern glb 1.0 MB, grass glb 0.6 MB, leaf 0.5 MB, masks 0.2 MB) |

The per-frame triangle count is roughly ten times the scene inventory. Most of it is the interior practical's cube shadow: six faces of every caster render each frame, even in daylight when that lamp is off. That is the next change (performance), measured with the `?perf` harness.

**Self-critique — three most visible remaining flaws per bookmark**

| Bookmark | Flaws |
|---|---|
| arrival-day | Trees read as small dark umbrellas at this distance; turf tufts invisible, turf a flat olive field; stays small in frame (C5) |
| arrival-high-water | As arrival-day; ghosted rock below the waterline (C2 carry-over) |
| weather-exterior | Canopy undersides go blue-grey in shade; scrub clusters are similar sizes; the four trees share one silhouette |
| weather-interior | The lifted hatch still floats (C3 flaw, C5); canopies frame the cabin but crop the gable |
| nap-observatory | Dome still closed in the open state (C3 flaw, C5); trees tidy rather than wind-bent at this angle; scrub sparse on the upper stack |
| lantern-dusk | Canopies read well against the sky; tufts disappear at this range; no lodge lantern (C3 flaw, C5) |
| arrival-night | Planting reads only as silhouettes, as it should; no change to night flaws from C3 |
| coast-grazing | Unchanged (no planting on the cliff face or ledges; rock blobs from C2) |
| bath-arm-length | Leaf shadow from an off-frame canopy falls on the step box with no visible caster; flat bath water (C3 flaw) |
| planting-close | Tufts are cards: at arm's length a few blades show their flat edge; no contact darkening at plant bases (cut-outs are excluded from AO); tree trunk has no root flare |
| horizon | Trees add useful silhouette; unchanged otherwise |

**Known limitations:** plant shadows do not follow the wind sway (the shadow depth material has no wind); there is no LOD tier for vegetation yet, which the performance change should decide from measurements.

# C3 — the three stays and the bath rebuilt at real scale (change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: Fable 5.1 (`../reviews/C3-REVIEW.md`).

**Concern:** audit fix-list item 3 and the cold review's second priority: box cabins, ribbed roof panels, detached roof appendages, torus bath. Vegetation (legacy blob trees) and camera composition are unchanged in this change; they follow as C4 and C5.

**What changed** (all procedural construction, justified in ASSET_PLAN: the stays must open along authored mechanisms and no licensed model matches these designs; materials are CC0 scans)

- `build/weather-house.ts`: cedar A-frame on concrete piers, sills and joists; 0.9 m knee walls; 58° roof on rafters at 600 mm with sarking and battens; 1,300+ individual glazed pan-and-cover tiles plus ridge caps (instanced, per-unit glaze variation and bedding tilt); fascia and barge boards; mullioned front gable with a French door and brass levers; board-on-board back gable with a brass porthole; steel stove flue with flashing and cap; brass weather vane; screwed deck and steps. The −X slope is a hatch hinged at the ridge on brass knuckles, opened on two telescoping gas struts. Interior: daybed with linen and wool, reading chair, side table and lamp, built-in bookshelf (~150 instanced books), slate hearth and stove with a fire glow, rug, barometer.
- `build/observatory.ts`: limewashed drum on a timber plinth, circular deck with rope railing on posts, door ajar, three brass portholes; dome clad in ~900 instanced blue-green glazed scale tiles on a brass track with roller bogies, a meridian slot with brass ribs and a crown ring, and a sliding shutter; interior daybed ring, telescope on a pier, standing lamp.
- `build/lodge.ts`: board-and-batten painted green on posts, windows and a half-glazed door ajar, railed terrace with screwed decking, 32° roof of flat interlocking slate-blue glazed tiles over sarking; the roof lifts on four brass screw jacks. Interior: long table with plates and cups, benches, two pendant lamps, two curtained sleeping nooks.
- `build/bath.ts`: 32 cedar staves with two steel hoops and a rim cap, inside bench, steps, wood-fired stove with flue and firebox glow, log stack, towel rail, lantern post; water surface.
- Materials: one weathered grain scan (`kitchen_wood`) tinted per role (cladding, structure, decks), `oak_veneer_01` for linings, `distressed_painted_planks`, `white_stucco`, `rough_concrete`, `rough_linen`, `wool_boucle`, `hessian_230`; glazed ceramics as clear-coated physical materials. The earlier plank-texture sets were rejected in look-dev (their plank seams read as patchwork on single boards; `../captures/lookdev-bld2/`).
- Light: the selected stay's main lamp is a single shadow-casting interior practical (512² cube, 7 m) so light stays in the room; other interior lamps are range-limited to 5 m.

**Evidence:** before `../captures/c2-after/`, after `../captures/c3-after/`; look-dev `../captures/lookdev-wh3/`, `lookdev-bld1/`, `lookdev-bld2/`. Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓.

**Self-critique — three most visible remaining flaws per bookmark**

| Bookmark | Flaws |
|---|---|
| arrival-day | Legacy blob trees now clash with real buildings; stays read small at this distance; turf still brownish |
| weather-exterior | Camera too high and far; trees hide most of the A-frame; the glazed gable is barely legible |
| weather-interior | The opened hatch reads as a flat lid from this angle; the interior is not framed; trees occlude |
| nap-observatory | The dome slot/shutter is hard to read from this camera; dome scales at the base look like a frill; deck edge rope thin |
| lantern-dusk | Lodge reads well; lamps only just on; terrace lanterns small; roof tile rows slightly uniform |
| arrival-night | Windows and lanterns read; glints on the water below lanterns; buildings small |
| coast-grazing | Unchanged from C2 (rock blobs, abrupt sand/rock edge) |
| bath-arm-length | Tub, stove and deck now hold at arm's length; the tub water surface reads flat/grey; lantern post is plain; no towel visible from this side |
| horizon | Unchanged from C2 |

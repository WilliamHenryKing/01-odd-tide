# C5 — the stays' open states, the lodge's lantern and the small wrongs (change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: `../reviews/C5-REVIEW.md` (pending: the reviewer model's session limit stopped the C4b review mid-run; both are queued).

**Concern:** the construction and story flaws the C3 review ranked, still present after C4: the Nap Observatory's "open" state showed a closed dome (§1.2), the Weather House's lifted roof read as a floating slab (§1.3), rainbow flecks in the Weather House glazing (§1.1), night pinpoint speckle on the dome and lodge roof and a roof whose colour changes with the camera (§1.4, §1.6), black tabs on the lodge roof and no lantern at the Lantern Lodge (§1.7), milky blobs under the dock and the two-triangle bird (§1.8), and the flat pale bath water (§1.5). Camera framing is not changed here; it is the next change.

**What changed**

- `build/observatory.ts`: the dome is now a clamshell of two quarter-shells split on a meridian, each with a brass seam rib, a brass skirt and a brass crown cap, turning on two brass pivot bosses. Opening turns the seam toward the open-state camera (0–45% of the motion), then folds the front shell 90° back over the rear one (35–100%); the front shell is 7 cm larger so it nests. The room lies open to the sky, as its copy ("Tuck the roof back in") says. `island.ts` computes the facing from the stay's open camera, so it follows any camera change.
- `build/weather-house.ts`: the hatch opens to 0.72 rad instead of 0.95, so it stays pitched about 17° below level and reads as a hinged roof slope, not a lid; a continuous brass hinge pin with 0.22 m knuckles every 0.9 m runs along the ridge; gas struts thickened to 90 mm bodies and 40 mm rods so they register from the stay camera. Book spines come from a twelve-colour cloth-binding palette in sRGB (the old `setHSL` ran in linear space and gave saturated cyans and magentas, the "spectral flecks" behind the mullions). The stove flue has a rain cowl on three legs and a storm collar.
- `build/lodge.ts`: the four screw-jack sleeves sit 0.53 m lower, inside the room's corners (above the wall plate they pierced the roof at the eaves — the "black tabs"); the screws extend further when the roof lifts. A ship's lantern hangs from a bracket on a raised terrace post, lit with the interiors from 17:45 (30 cd).
- `materials.ts`: the tile glaze is a worn clear-coat (0.7 at 0.28 roughness, was 1.0 at 0.12): lamps no longer throw a pinpoint off every tile at night, and grazing views keep the terracotta instead of mirroring the sky.
- `build/bath.ts`: the bath water has almost no diffuse colour of its own. It reflects by Fresnel, hides the tub behind it by at least 55% (about half a metre of water), and carries slow ring ripples and cross-chop from the island clock.
- `build/gull.ts` (new): a herring gull at true size (1.4 m span, 0.6 m long) — lathe body, head, yellow bill, fanned tail, M-shaped two-segment wings with a grey mantle and black tips above and white below — replacing the two-triangle bird scaled to a 3 m span. It heads along its path, banks slightly into the turn and flaps in 1.6 s bursts every 6 s when motion is on; reduced motion holds a glide.
- `build/props.ts`: the pontoon's drums are dark plastic rather than pale concrete, which read as milky blobs through the water.

**Evidence:** before `../captures/c4b-after/`, after `../captures/c5-after/`. Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓, no console errors or warnings.

**Cost** (`../perf/c5-scene/`): GPU p95 11.96 / 12.12 ms (C4b 11.82 / 11.98); worst segment bath-arm-length 12.7 ms (budget 13.33); RAF p95 15.9 / 16.0 ms, max 23.9 ms, no gap over 50 ms; 444 draw calls and 2.25 M triangles a frame. Headroom at the worst segment is now 0.6 ms.

**Self-critique — three most visible remaining flaws per hero bookmark**

| Bookmark | Flaws |
|---|---|
| nap-observatory | The camera is too low to see into the drum, so the open dome shows its inner wall but not the bed or telescope; the seam step between shells is visible when closed; the drum top edge is plain |
| weather-interior | Camera high and far: the cabin fills a fifth of the frame; the hatch's underside (sarking, rafters) is not seen from above; struts still thin at this distance |
| lantern-dusk | The lantern is small at this range; window glass shows no sky reflection; one terrace post lands on the cliff slope |
| weather-exterior | Gull now small and easy to miss; roof tiles still a regular running bond at mid distance |
| arrival-day | The island fills under half the frame width; stays read small |
| bath-arm-length | From this grazing camera the water is a bright sliver; the leaf shadow from an off-frame tree still falls on the step box |

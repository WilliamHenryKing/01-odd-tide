# C8 — the page shows the island's own renders; posters regenerated (change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: pending (queued).

**Concern:** below the hero, the site still showed the pre-reset flat vector illustrations — a triangle cabin, a dome and a box house on a green blob, and three plain circles for the lighthouse lens — beside a physically rendered island. Under D08 (wow factor first) that contrast is the weakest thing a visitor scrolls to. The loading/fallback posters were also stills of the old scene.

**What changed**

- `src/visual/plates.ts` (new): stills rendered from the live scene. Per stay: a portrait (16:20, roof down), the same camera with the roof open, and a dusk view with lamps on; the lighthouse at twilight, dark and relit; and the poster frames (desktop and phone arrival by day and night, and each stay's closed shot) matching the live cameras so the handover from poster to canvas is seamless. Development/visual-test builds only.
- `src/visual/inspection.ts`, `src/world/island.ts`: the visual-test hook can render a plate offscreen at any size (state, camera and field of view set; six frames so the environment bake, shadows and AO settle; the live view restored after).
- `tools/visual/plates.mjs` (new): renders every plate at 2× on the real GPU through that hook, downsamples with Lanczos and encodes WebP q84 (JPEG q86 for posters) with ImageMagick. External tools only.
- `src/App.tsx`, `src/style.css`: stay cards (home and the stays page) show the stay's portrait; hovering, focusing or — on touch screens — scrolling a card into view crossfades to the same camera with the roof open, with a slow 3.5% push-in (reduced motion: fade only). Each stay's page gains a gallery: afternoon, opened up (captioned with how it opens), lamps on at dusk. The lighthouse section shows the rendered lighthouse at twilight, lamp dark; it crossfades to the relit plate when all three lens pieces are found. The summary presents the chosen stay at dusk as a postcard (stamp, postmark, a GSAP drop-in; instant with reduced motion), and "Take a postcard with you" draws that dusk render rather than the live canvas.
- `island.ts`: the lighthouse lens no longer glows when unlit (0.03 × 3000 cd/m² read as a working lamp at twilight).

**Evidence:** full-page captures of every route, desktop (1440 wide) and mobile (390 wide): before `../captures/c8-pages-before/`, after `../captures/c8-pages-after/`. The hero canvas is unchanged from C7. Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓. The home cards first collapsed to 28 × 19 px because the "Step inside" chip's selector (`.portrait-button > span`) also matched the portrait; found by measuring the DOM, fixed with a class.

**Bytes:** 11 WebP plates, 2.7 MB in total (stay portraits 0.2–0.45 MB each), loaded lazily below the fold; posters 1.2 MB across seven JPEGs, of which a visitor loads one or two.

**Self-critique**

| Surface | Flaws |
|---|---|
| Stay cards | The Weather House portrait is tight on the roof; the lodge's open still is dim inside at 16:20 |
| Stay gallery | The three views share a light direction; there is no interior close-up |
| Lighthouse | Backlit, the tower is a dark silhouette with no surface detail |
| Postcard | The stamp and postmark are typographic, not illustrated; the postcard does not show the planned activities on its back |
| Plates | Renders are fixed at 16:20 and 18:45; they do not follow the visitor's chosen hour |

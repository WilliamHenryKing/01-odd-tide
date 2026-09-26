# Local verification â€” 26 September 2026

> **Visual acceptance withdrawn, 26 September 2026.** William rejected this output. The records below describe historical implementation/testing, not an accepted visual result. Follow `docs/visual/AUDIT.md` and the collection Visual Quality Directive.

Result: locally complete original portfolio demonstration, self-reviewed by the sole producer. No independent review, client acceptance, deployment or Upwork publication occurred.

## Delivered journey

Explore the changing island â†’ compare three stays â†’ inspect their articulated rooms â†’ select dates, party and activities â†’ resolve capacity, availability, tide or overlap conflicts â†’ finish a demo summary â†’ download a real postcard or edit the same choices. Optional three-lens discovery has a lighthouse ending and replay. None of this creates a reservation or collects personal details.

The bath causeway and floating dock move relative to actual rendered water. Lighting, windows and lamps change with the same selected time used by the domain. Entire activity intervals are checked for access. Final art is original procedural geometry, texture/shader work, illustrations and graphics; two self-hosted OFL fonts are the outside assets.

## Technical and browser evidence

- `bun run check`: strict TypeScript, Biome, six domain tests / 24 assertions and a Vite production build with nine prerendered HTML routes pass. Frozen dependency installation passed in environment setup. Exact versions remain in package.json and bun.lock.
- Windows, Headless Chrome 154.0.0.0, Playwright CLI 0.1.21. Desktop 1440 Ã— 1000; responsive/touch emulation at 320, 390 and 768 px widths. These are emulated viewports, not physical devices.
- All nine routes hydrated without runtime errors. Comparison capacity notes, chosen-stay navigation, browser back and scene raycast cabin selection passed. Clean routes serve the right saved HTML; no-JavaScript comparison content and the limitation banner were checked.
- Planner: capacity four rejects the two-person stay; Lodge accepts it. Blocked dates, high-tide activity and overlaps explain the conflict and prevent finishing. Schedule repair succeeds. Save/restore, URL choices, editable summary and intentionally empty days work. Actual PNG downloads were saved and inspected.
- Optional discovery: raycast collection, equivalent DOM controls, time-dependent star clue, three-piece lighthouse ending and replay passed.
- Actual WebGL draw instrumentation: pause and offscreen state stop GPU draws after transitions. Forced context loss reveals a real poster; retry creates one working canvas. Forced missing WebGL preserves stay comparison, planning and fallback postcard export. Denied storage explains recovery without blocking the planner.
- OS reduced-motion emulation changes the motion mode while cabin inspection still works. Keyboard changes the time and volume ranges. Touch navigation, party selection and summary work, menu closes after navigation, primary export target exceeds 40 px, and tested routes have no horizontal overflow.
- No audio context before opt-in; deliberate start creates a running context, keyboard volume reaches zero and mute closes it. This is an audio-state check, **not a listening review**.

Procedures: `tools/browser/review-production.txt`, `review-planner.txt`, `review-summary.txt`, `review-recovery.txt`, `review-discovery.txt`, `review-mobile.txt`, `final-walkthrough.txt`. Read their prerequisites: planner starts on `/plan`, summary follows that planner journey, discovery follows the production discovery setup. Logs/captures are under ignored `output/playwright/`; selected evidence is preserved in the root delivery package.

## Visual and motion self-review

Actual desktop and portrait images were inspected, including three daylight studies, all three open interiors, high tide, night, the lighthouse ending and exported postcards. Revisions corrected repetitive water marks, inverted bath geometry, obstructive vegetation, unattached chimney motion, a floating observatory roof, clipped open roofs, tablet type/scene overlap and narrow-phone camera fit. Final daylight is the clearest arrival; blue hour supplies the warm payoff.

`island-motion.webm` records a real 36.72-second browser interaction at 1440 Ã— 1000 / 25 fps, including changing tide, camera approach and roof opening/closing. Its one-second frame samples were visually reviewed alongside timed live interactions and final states. This is **sampled motion review**, not a claim of uninterrupted audiovisual viewing. The source capture includes preparation time and is evidence, not a finished promotional edit.

## Practical limits

This is a compact stylised miniature, with authored cameras and a fictional October 2026 season/tide model. It is not a real tide, weather, price or availability service. The postcard falls back to a saved scene image when live WebGL is unavailable. Planning requires JavaScript; static explanatory/stay content survives without it. No account or backend is needed.

Only the named Chrome environment was tested. Cross-browser, physical-device and assistive-technology compatibility are not claimed. The lazy Three.js scene bundle is about 594 kB uncompressed / 153 kB gzip and produces Vite's standard chunk-size advisory; the scene stays separate from the core application. A host must serve directory indexes and use `404/index.html` for missing routes. Publication is outside this task's authority.

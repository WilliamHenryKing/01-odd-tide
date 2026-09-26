# ODD TIDE

> **Visual acceptance withdrawn, 26 September 2026.** William rejected this output. The records below describe historical implementation/testing, not an accepted visual result. Follow `docs/visual/AUDIT.md` and the collection Visual Quality Directive.

Status: paused at the visual-reset handover, 26 September 2026. The baseline is independently rejected; local hardware testing is complete; look-dev and improved art remain pending. This is an original fictional coastal stay planner with working journeys, not a visually accepted delivery. Nothing is published and no real booking or payment is possible. Read ../../HANDOFF.md for continuation and VERIFICATION.md only as historical self-review evidence.

Working checkout: `experiences/01-odd-tide`. Repository anchor: `.repositories/01-odd-tide`. Branch: `work/experience`. Preserve both directories.

## Development

```powershell
bun install --frozen-lockfile
bun run dev
bun run check
bun run preview
```

Development: http://127.0.0.1:4511/
Preview: http://127.0.0.1:4611/

The production app lives in `src/`. `bun run build` creates `dist/` and prerenders nine HTML entry points. `bun run test` checks calendar/price/availability/tide/scheduling/URL rules. `bun run check` combines strict types, lint, these tests and the production build. The earlier developer smoke harness remains available with `dev:smoke` / `build:smoke` and is excluded from production.

Each project owns its dependencies and lockfile. Tailwind uses its Vite plugin; Lightning CSS performs final CSS minification. No shared visual runtime or sibling imports.

Read DESIGN.md and ASSET-REGISTER.md for creative intent and provenance. The domain module owns all tide and itinerary rules; React owns the visitor's discrete choices; Three owns the scene; GSAP owns camera/roof/day choreography. No external services, forms, accounts or asset CDNs are required at runtime. Optional original sound starts only after a deliberate press.

Historical journey evidence is in `output/playwright/` (not committed). The current visual-reset frames and metadata are committed in `docs/visual/captures/`; performance evidence is in `docs/visual/perf/`. Reproducible browser procedures under `tools/browser/*.txt` run through the installed Playwright CLI's `run-code --filename` command. These are function expressions because that CLI wraps its input; do not append a semicolon or turn them into a test runner suite.

The old, explicitly unaccepted local delivery package lives at `../../portfolio-packages/01-odd-tide/`: build, selected actual captures and factual case study. Hosting needs directory-index routing for the prerendered pages and a custom 404 document; the preview middleware's unknown-route status still needs verification (see HANDOFF). No host is configured. Chrome desktop and touch emulation were exercised, not physical phones or cross-browser compatibility. Audio controls were instrumented, not auditioned. All planner tasks are available with sound off.

# Local performance harness

No extra package is saved. Use the existing external Playwright installation. The recorded run includes its browser version and custom launch arguments; the full CDP command-line query returned null in this Chrome configuration. Close only benchmark windows created by this runner; leave unrelated apps and power settings alone.

```powershell
bunx --no-install vite build --mode performance --outDir dist-perf
bunx --no-install vite preview --outDir dist-perf
# In another terminal, from this same project:
node tools/perf/run.mjs '<existing external playwright/index.mjs>' tools/perf/boundary.json local-rtx2060-boundary
```

Open `http://127.0.0.1:4611/?perf` in the performance build for the repeatable existing-tier camera path, Stop and Copy JSON controls. The site normalises its query string after entry; the performance build latches the explicit opt-in before that happens. The ordinary production build contains neither `__PERF__` nor `__VISUAL_TEST__`.

The runner starts headed installed Chrome in a temporary context; checks the actual served bundle SHA256 against `dist-perf`; starts NVIDIA/CPU/RAM telemetry; runs the declared plan serially; stores raw samples, metadata, setup canvas PNGs and errors; then closes only its own browser and telemetry process. Do not run builds, GPU captures or other renders while the plan is measuring. Source/build hashes describe the tested revision even when the worktree has uncommitted instrumentation.

`staircase.json` is the first exploratory pass. `boundary.json` separates axes and includes exact full-HD buffers and the real scene. Final plans and the budget report identify which runs qualify for operating decisions. Keep exploratory/failed stages; do not overwrite them to remove inconvenient spikes. `py tools/perf/summarize.py` generates `docs/visual/perf/SUMMARY.json` from every retained stage.

`narrow.json` tests memory and combined candidates. `final.json` repeats the chosen fixture, compares GPU queries on/off/on and reruns the actual island. `thermal.json` adds a 720-second uninterrupted heat soak with UTC measurement anchors. Run `py tools/perf/assess.py` for the numerical repetition gates and `py tools/perf/assess-thermal.py` for the predeclared sustained tail. Both must pass, followed by independent review, before adopting the operating point. The ordinary `?perf` button retains its 60-second default; extended durations are bounded diagnostics only.

Read [methodology](../../docs/visual/perf/METHODOLOGY.md) before changing or interpreting the harness. The model count, texture count and maximum DPR are bounds on these diagnostic fixtures, not permission to exhaust machine memory. No phone, network throughput, shipping asset-size or final-art approval follows from these tests.

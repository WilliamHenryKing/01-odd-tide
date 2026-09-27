# C11 — portrait composition: the island in the upper half, the instrument in the first viewport (change record)

27 September 2026 · implementer: root (Claude Opus 5.5). Independent review deferred to the ODD TIDE completion milestone.

**Target** (`../ART_DIRECTION.md`, Arrival; `../../../DESIGN.md`, Working view): "Portrait uses its own camera: island centred in the upper half, time instrument visible in the first viewport"; "stack masthead, tall island view, time control and journal". The C5-C6 review measured the island's centre at 73 % of the first viewport, with only the top edge of the instrument visible (`../reviews/C5-C6-REVIEW.md`, composition).

**Change**

| Where | What |
|---|---|
| `src/style.css` (≤1100 px) | The hero becomes a grid: eyebrow, title, call to action, then a window row for the island (`--window: clamp(230px, 100svh − 585px, 520px)`), the instrument, and the description as the journal's lead. The canvas spans the window and overhangs it (−154 px above, −106 px below), so the sea runs on behind the masthead and the instrument, and the island sits slightly above the window's centre. The title keeps its three designed lines at 36–62 px, with a compact call to action. |
| `src/style.css` (stays) | Stay frames fade to 22 % behind the title and buttons, so a busy background never sits under text. |
| `src/style.css` (short screens) | Screens ≤720 px tall drop the eyebrow and use a 32–44 px title. |
| `src/world/island.ts` | Portrait arrival: the camera distance follows the frame's height-to-width ratio (the island keeps about 88 % of the width) and the window's share of the canvas (it stays inside a short, wide window). The target moved 3.75 m to screen-left to centre the island's silhouette, bath rock included. Stay shots use the same rule instead of a fixed 1.45 pull-back. |

**Evidence** (390×844 at DPR 3 unless noted)

| Frame | Before | After |
|---|---|---|
| Arrival, phone | island centre 73 % of the first viewport, instrument below the fold (`../captures/cycle-02-captures/arrival-day_existing_mobile.png`) | island centre ≈45 %, spanning ≈87 % of the width; the whole instrument and the start of the description in view (`../captures/c11-portrait-3/arrival-day_existing_mobile.png`) |
| Stays, phone | — | building inside the window at all three stays, open and closed, with the instrument in view (`../captures/c11-portrait-3/{weather-exterior,weather-interior,nap-observatory,lantern-dusk}_existing_mobile.png`) |
| Other shapes | — | tablet portrait 820×1180; small phone 375×667 (island centre ≈48 %, instrument in view); phone on its side 844×390 (island reaches the first viewport) (`../captures/c11-portrait-shapes/`) |
| Desktop | — | unchanged: 16 and 87 pixels differ (of 2 073 600, 3 % fuzz) from cycle-02 at arrival-day and weather-exterior (`../captures/c11-desktop-check/`) |

Intermediate steps are kept in `../captures/c11-portrait-1/` (first grid: centre at ≈51 %, and "sea." left alone on the title's third line) and `../captures/c11-portrait-2/` (≈48 %, stays reaching behind the title).

**Checks:** `tsc` ✓, Biome ✓, no console errors in any capture.

**Still open:** the phone poster (`world-poster`, shown only if WebGL fails) was rendered for the old 390×400 frame and should be re-rendered at the new framing. On tablets the island's centre is at ≈52 %.

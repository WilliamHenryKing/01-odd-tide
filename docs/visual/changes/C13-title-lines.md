# C13 — the title keeps its three designed lines at every desktop width (change record)

27 September 2026 · implementer: root (Claude Opus 5.5). Found by breakpoint sweep-01 (`../captures/sweep-01/`, seven routes × thirteen sizes: no horizontal overflow, no errors).

**Fault.** "Somewhere / between here / & the sea." broke into four lines ("between / here") wherever "between here" (about 7.2 em) outgrew the 570 px copy column: from about 1450 px wide at 5.5vw, and always at ≥1600 px, where the title was 104 px. The fourth line pushed the call to action down so that "Or tap a cabin. We left the doors open." ran under the sea-time panel at 1920×1080 and 2560×1440 (`../captures/sweep-01/home_1920x1080.png`), the near-miss the C5-C6 review had noted at 18 px.

**Change** (`src/style.css`): title `clamp(56px, 5.2vw, 82px)` (5.2vw fits inside the 39 % column at any width), column 590 px; at ≥1600 px a 650 px column and an 88 px title.

**Evidence** (`../captures/c13-title/home_<width>.png`, measured in the browser): three lines at 1180, 1440, 1500, 1680, 1920 and 2560 px; the lowest copy element (note or button) clears the panel by 160, 118, 108, 146, 146 and 146 px; the title's right edge stays at 513–777 px, left of the island. The bath now sits beside the title's last line, as the art direction describes.

**Checks:** Biome ✓; phones and tablets are unaffected (their rules live in the ≤1100 px block).

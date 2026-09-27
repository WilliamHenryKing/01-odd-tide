# C6 — cameras and composition to the art direction; hero copy contrast (change record)

27 September 2026 · implementer: root (Claude Opus 5.5) · independent review: `../reviews/C5-C6-REVIEW.md` (C5 and C6 reviewed together).

**Concern:** every review since C3 capped composition: the arrival showed the island at under a third of the frame width with no horizon (ART_DIRECTION asks for the archipelago across the right two-thirds, the horizon near the top edge); stay cameras sat 20–30 m out and 10–14 m up, so the cabins filled a fifth of the frame (ART_DIRECTION: three-quarter views at ~6–9 m eye height); open states were not composed to show what opens. The hero eyebrow and mobile text sat below 4.5:1 on some frames.

**What changed**

- `island.ts`: the desktop arrival camera moved from 90 m out at 26° to 58 m at 18°, aimed 11 m to the screen-left of the island so the archipelago fills the right two-thirds beside the headline, with the bath near the headline's lower edge but clear of text and the horizon just inside the top edge. The fallback-plate capture now aims at the same target.
- `layout.ts`: new stay shots, found by rendering candidates in one browser session (dev-only camera handle, not committed): three-quarter views 11–15 m out at 5.5–8 m eye height, aimed so the building sits in the right two-thirds on desktop and centred in portrait. Open shots are composed around the mechanism: under the Weather House's lifted slope into the room (bed, lamp, bookshelf, struts), down into the observatory's drum (daybed, rug, telescope; the clamshell opens toward this camera), and through the gap under the Lantern Lodge's raised roof to the table and pendants, with the terrace lantern in frame. Portrait stay shots pull back 1.45× for the narrower horizontal field.
- `build/lodge.ts`: the raised roof's jack screws end under the roof plane (they pierced it by 0.4 m when open).
- `style.css`: the copy veil reaches up over the eyebrow (the new arrival puts the horizon's glow behind it), and the hero eyebrow sits on a frosted chip of the scene's darkest teal, so small uppercase text holds 4.5:1 over any sky, sea or roof.

**Contrast** (WCAG, text #fbf3d9 against the median / brightest-10% of the pixels behind it, desktop full frames): eyebrow at arrival 3.26 → 7.47 median (C5 4.47); at weather-exterior 10.19, lantern-dusk 8.83, planting-close 6.97. Headline (large text, needs 3:1): 6.14 median, 4.40 worst decile at arrival. Body copy at arrival: 6.05 median, 4.60 worst decile.

**Evidence:** before `../captures/c5-after/`, after `../captures/c6-after/`. Checks: `tsc` ✓, Biome ✓, `bun test` 8/8 ✓, no console errors or warnings.

**Self-critique — three most visible remaining flaws per hero bookmark**

| Bookmark | Flaws |
|---|---|
| arrival-day | The annotation "A place to get a little lost" sits over the observatory rather than pointing at something; the lighthouse is at the right edge; ripple tiling visible in the top band |
| weather-exterior | A tree trunk and canopy cross the left of the cabin; the camera is close enough that roof tiles show their regular running bond |
| weather-interior | The hatch's top face dominates the upper third; the room is lit only by daylight at 09:00, so it reads cooler than the art direction's warm interiors |
| nap-observatory | The drum's inner wall is plain white render; the clamshell's folded shell reads as a canopy but its pivot is small at this distance |
| lantern-dusk | The lantern is the right size but not yet the brightest point at 18:30 (windows compete); the far-left deck post still lands on the cliff slope |

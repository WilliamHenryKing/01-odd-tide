# Browser journeys (`tools/visual/journeys.mjs`)

Headed Chrome through the real interface: dev server 4511 for the journeys, the production preview 4611 for status codes. Each run writes `report.json` (steps, timings, details, page and console errors) and a screenshot per step. These are sampled interactions, not continuous viewing.

| Run | Date (UTC) | Result | Findings |
|---|---|---|---|
| journeys-01 | 27 Sep 12:01 | 16/18, 0 page errors | Two harness faults (an "Added ✓" button matched `/^add/`; lens sliders assumed one per clue). One site fault: the preview answered unknown routes with 200, because static serving reset the middleware's 404. Fixed in `vite.config.ts`; the build also emits `dist/404.html` for static hosts. |
| journeys-02 | 27 Sep 13:14 (chained) | 18/20 | The harness asked for 3 guests in a 2-guest stay; the site correctly kept the summary disabled with "sleeps 2". The status journey logged the deliberate 404s as console errors. |
| journeys-03 | 27 Sep 13:26 | 20/22 | The harness chose 14–17 October, when the Weather House is blocked; the site correctly refused. |
| journeys-04 | 27 Sep 13:31 | 21/23 | The added activity landed at 09:00 over the bath; the planner flagged the overlap. |
| journeys-05 | 27 Sep 13:33 | **23/23, 0 page errors** | Booking now proves three guards on the way (capacity, blocked dates, activity clash with the planner's "Find a time that works" repair) before the summary and the postcard download (1600×1100 PNG, plan and repaired day printed on it). Lens pieces collected at 08:00, 20:00 and 06:30; the lighthouse is restored. The time-lapse advances the hour. The phone menu reaches the planner. Preview: unknown route 404 with the wrong-turn page, unknown stay 404, missing file 404, stay route 200. |

Steps covered: arrival (loader shown, then a ready island) → stays → the Weather House → roof opened → plan → guards → summary → postcard; lens hunt → lighthouse; time-lapse; phone menu; status codes.

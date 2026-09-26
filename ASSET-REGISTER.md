# ODD TIDE asset register

26 September 2026. Final original assets reviewed locally by the sole producer; no independent or client approval is implied.

| Family | Purpose / view | Creation and rights | Planned location | Status |
|---|---|---|---|---|
| Coast / tide shelves / rocks | Arrival silhouette and cabin close views | Original procedural geometry and colour fields | `src/world/objects.ts` | Implemented; desktop/phone inspected, strata refined |
| Weather House | Hero A-frame and inspectable reading room | Original geometry, roof hinge, room props | `src/world/objects.ts` | Open/closed closeup inspected; sightline and moving chimney corrected |
| Nap Observatory | Round star cabin, aperture and daybed | Original geometry and articulation | `src/world/objects.ts` | Final closeup reviewed; rotary shutter replaces the floating roof |
| Lantern Lodge | Family cabin and raised boardwalk | Original geometry and local material system | `src/world/objects.ts` | Two sleeping nooks and central table reviewed; open roof fits the camera |
| Bathhouse / causeway / floating dock | Tide-dependent path with physical water relation | Original scene geometry tied to domain state | `src/world/island.ts` | Implemented; bowl orientation corrected in rendered review |
| Vegetation / gull / buoys / lens | Scale, response and bounded discovery | Original geometry and choreography | `src/world/objects.ts`, `island.ts` | Vegetation refined in wide and close views; three-piece discovery and lighthouse ending completed in browser |
| Water / ceramic / wood / rock | Close-view material character | Original procedural canvas/shader work; no borrowed image textures | `src/world/objects.ts`, `island.ts` | Water pattern replaced after actual first-render review |
| Wayfinding / postcard / coast marks | Identity and useful exported plan | Original SVG/Canvas graphics | `src/App.tsx`, `public/favicon.svg` | Actual live and fallback PNG exports downloaded and inspected |
| Young Serif | Display/identity | [Google Fonts upstream](https://github.com/google/fonts/tree/main/ofl/youngserif); SIL Open Font License read; converted to WOFF2 with fontTools | `public/fonts/young-serif.woff2` and adjacent OFL | Self-hosted and rendered |
| DM Sans | Body/controls | [Google Fonts upstream](https://github.com/google/fonts/tree/main/ofl/dmsans); SIL Open Font License read; converted to WOFF2 with fontTools | `public/fonts/dm-sans.woff2` and adjacent OFL | Self-hosted and rendered |
| Water/chime ambience | Opt-in sense of place | Original Web Audio synthesis; no third-party recordings | `src/Sound.tsx` | Real activation, volume-to-zero and closed-context mute verified; no listening review claimed |
| Fallback/postcard scene captures | First-frame continuity and truthful portfolio evidence | Render from the actual original scene | `public/plates/`, `output/playwright/` | Seven JPEG plates integrated; context-loss, missing-WebGL and first-frame use verified; final captures retained in portfolio package |

Ulcombe code/images were inspected read-only as craft references; its branded geometry, business copy and assets are not copied into ODD TIDE. Community skills are internal reference guidance, not shipped assets. Temporary geometry cannot be marked final merely because it renders.

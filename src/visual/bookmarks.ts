import type { IslandState } from "../world/island";

export type Bookmark = {
  id: string;
  purpose: string;
  hero: boolean;
  state: IslandState;
  camera?: { position: [number, number, number]; target: [number, number, number] };
};
const base: IslandState = {
  hour: 9,
  selected: null,
  opened: false,
  paused: true,
  reduced: true,
  found: [],
  discover: false,
};
// Existing scene states. Inspection cameras expose flaws; they do not replace the public cameras.
export const BOOKMARKS: Bookmark[] = [
  {
    id: "arrival-day",
    purpose: "Establishing hero and portrait composition",
    hero: true,
    state: { ...base },
  },
  {
    id: "arrival-high-water",
    purpose: "Water and causeway integration",
    hero: false,
    state: { ...base, hour: 15 },
  },
  {
    id: "weather-exterior",
    purpose: "Main cabin hero",
    hero: true,
    state: { ...base, selected: "weather-house" },
  },
  {
    id: "weather-interior",
    purpose: "Open roof, joinery and interior detail",
    hero: true,
    state: { ...base, selected: "weather-house", opened: true },
  },
  {
    id: "nap-observatory",
    purpose: "Second hero silhouette and open shutter",
    hero: true,
    state: { ...base, selected: "nap-observatory", opened: true },
  },
  {
    id: "lantern-dusk",
    purpose: "Dusk lighting and practical lamps",
    hero: true,
    state: { ...base, hour: 18.5, selected: "lantern-lodge" },
  },
  {
    id: "arrival-night",
    purpose: "Night exposure and densest active-light state",
    hero: false,
    state: { ...base, hour: 21, found: ["bath", "weather", "stars"] },
  },
  {
    id: "coast-grazing",
    purpose: "Rock, shore and grazing-angle roughness inspection",
    hero: false,
    state: { ...base },
    camera: { position: [-7, 2.8, 6], target: [-1.5, 0.8, 1.6] },
  },
  {
    id: "bath-arm-length",
    purpose: "Arm-length fixture and contact inspection",
    hero: false,
    state: { ...base },
    camera: { position: [-7.6, 3.1, 4.8], target: [-5, 1.5, 2.2] },
  },
  {
    id: "horizon",
    purpose: "Far atmosphere, silhouettes and fog",
    hero: false,
    state: { ...base, hour: 12 },
    camera: { position: [20, 6, 29], target: [0.8, 1.4, 0] },
  },
];

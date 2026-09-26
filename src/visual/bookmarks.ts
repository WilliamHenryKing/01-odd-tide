import type { IslandState } from "../world/island";

export type Bookmark = {
  id: string;
  purpose: string;
  hero: boolean;
  state: IslandState;
  /** Inspection camera in metres (world space), when the public camera is not enough. */
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
// Scene states shared by captures, tests and the perf path. Inspection cameras expose flaws;
// they do not replace the public cameras. All positions are metres (1 unit = 1 m).
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
    camera: { position: [-15.5, 4.2, 15.5], target: [-7.5, 1.4, 5.8] },
  },
  {
    id: "bath-arm-length",
    purpose: "Arm-length fixture and contact inspection",
    hero: false,
    state: { ...base },
    camera: { position: [-19.8, 4.4, 11.4], target: [-16.6, 3.3, 7.6] },
  },
  {
    id: "planting-close",
    purpose: "Vegetation and ground contact at arm's length",
    hero: false,
    state: { ...base },
    camera: { position: [-9.6, 7.3, 5.4], target: [-5.6, 5.7, 0.8] },
  },
  {
    id: "horizon",
    purpose: "Far atmosphere, silhouettes and fog",
    hero: false,
    state: { ...base, hour: 12 },
    camera: { position: [62, 16, 88], target: [2, 4, 0] },
  },
];

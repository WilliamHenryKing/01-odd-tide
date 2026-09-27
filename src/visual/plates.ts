import type { StayId } from "../domain";
import type { IslandState } from "../world/island";
import { LIGHTHOUSE_SITE, STAY_CAMERAS, STAY_SITES } from "../world/layout";

// Stills rendered from the live scene for the page: stay portraits (closed and open, for the
// cards' hover), gallery views, the lighthouse, and the poster frames shown while the world
// loads or if WebGL fails. Rendered by tools/visual/plates.mjs at twice the listed size and
// downsampled; cameras in metres (1 unit = 1 m).

type Vec3 = [number, number, number];
export type Plate = {
  id: string;
  /** Output path under public/, with extension. */
  file: string;
  width: number;
  height: number;
  state: IslandState;
  camera: { position: Vec3; target: Vec3; fov?: number };
};

const base: IslandState = {
  hour: 16.3,
  selected: null,
  opened: false,
  paused: true,
  reduced: true,
  found: [],
  discover: false,
};

/** Each stay's footprint centre above its site, in local metres (floor lift included). */
const CENTRES: Record<StayId, Vec3> = {
  "weather-house": [0, 2.9, 0],
  "nap-observatory": [0, 2.7, 0],
  "lantern-lodge": [0, 2.3, 1.0],
};

/**
 * A camera orbiting a stay: 'angle' degrees round from its front (+local Z) toward its left
 * (−local X), 'distance' metres out horizontally, 'height' metres above its site.
 */
function orbit(id: StayId, angle: number, distance: number, height: number, aimDrop = 0) {
  const site = STAY_SITES[id];
  const rotation = site.rotation;
  const a = (angle * Math.PI) / 180;
  const lx = -Math.sin(a);
  const lz = Math.cos(a);
  const wx = lx * Math.cos(rotation) + lz * Math.sin(rotation);
  const wz = -lx * Math.sin(rotation) + lz * Math.cos(rotation);
  const [cx, cy, cz] = CENTRES[id];
  const centre: Vec3 = [
    site.position[0] + cx * Math.cos(rotation) + cz * Math.sin(rotation),
    site.position[1] + cy - aimDrop,
    site.position[2] - cx * Math.sin(rotation) + cz * Math.cos(rotation),
  ];
  return {
    position: [
      centre[0] + wx * distance,
      site.position[1] + height,
      centre[2] + wz * distance,
    ] as Vec3,
    target: centre,
  };
}

/** Portrait framings per stay: one camera shared by the closed and open stills. */
const PORTRAIT: Record<StayId, [number, number, number, number]> = {
  "weather-house": [28, 12.5, 7.5, 0.6],
  "nap-observatory": [18, 9.5, 10.5, 0.9],
  "lantern-lodge": [-30, 13.5, 8.2, 0.5],
};

const stayPlates = (Object.keys(PORTRAIT) as StayId[]).flatMap((id): Plate[] => {
  const [angle, distance, height, drop] = PORTRAIT[id];
  const camera = { ...orbit(id, angle, distance, height, drop), fov: 30 };
  const dusk = { ...orbit(id, angle + 14, distance * 1.08, height * 0.85, drop), fov: 30 };
  return [
    {
      id: `${id}-portrait`,
      file: `plates/${id}-portrait.webp`,
      width: 1500,
      height: 1000,
      state: { ...base, selected: id },
      camera,
    },
    {
      id: `${id}-open`,
      file: `plates/${id}-open.webp`,
      width: 1500,
      height: 1000,
      state: { ...base, selected: id, opened: true },
      camera,
    },
    {
      id: `${id}-dusk`,
      file: `plates/${id}-dusk.webp`,
      width: 1500,
      height: 1000,
      state: { ...base, hour: 18.75, selected: id },
      camera: dusk,
    },
  ];
});

/**
 * The lighthouse at twilight from the observatory's deck, looking out to the afterglow: dark
 * ("lost its sparkle") and relit once all three pieces are found.
 */
const lighthouseCamera = {
  position: [LIGHTHOUSE_SITE[0] - 2.4, LIGHTHOUSE_SITE[1] + 1.6, LIGHTHOUSE_SITE[2] + 3.7] as Vec3,
  target: [LIGHTHOUSE_SITE[0] + 1.6, LIGHTHOUSE_SITE[1] + 2.3, LIGHTHOUSE_SITE[2] - 2.3] as Vec3,
  fov: 44,
};

/** Poster frames: the live cameras' compositions (the hero canvas is 1440 × 770 on desktop). */
const ARRIVAL_POSTER = {
  position: [22.51, 19.12, 51.01] as Vec3,
  target: [-9.42, 1.2, 6.05] as Vec3,
};
// The portrait arrival camera at the phone hero's aspect (~1:1.03), where it pulls in to 85%.
const PHONE_POSTER = {
  position: [41.12, 46.08, 66.3] as Vec3,
  target: [2.1, 1.2, 0] as Vec3,
};
const posterFor = (id: StayId) => {
  const site = STAY_SITES[id].position;
  const shot = STAY_CAMERAS[id].closed;
  return {
    position: [
      site[0] + shot.offset[0],
      site[1] + shot.offset[1],
      site[2] + shot.offset[2],
    ] as Vec3,
    target: [site[0] + shot.aim[0], site[1] + shot.aim[1], site[2] + shot.aim[2]] as Vec3,
  };
};

export const PLATES: Plate[] = [
  ...stayPlates,
  {
    id: "lighthouse-dark",
    file: "plates/lighthouse-dark.webp",
    width: 1100,
    height: 1100,
    state: { ...base, hour: 19.25 },
    camera: lighthouseCamera,
  },
  {
    id: "lighthouse-lit",
    file: "plates/lighthouse-lit.webp",
    width: 1100,
    height: 1100,
    state: { ...base, hour: 19.25, found: ["bath", "weather", "stars"] },
    camera: lighthouseCamera,
  },
  {
    id: "island-day",
    file: "plates/island-day.jpg",
    width: 1440,
    height: 770,
    state: { ...base, hour: 9 },
    camera: ARRIVAL_POSTER,
  },
  {
    id: "island-night",
    file: "plates/island-night.jpg",
    width: 1440,
    height: 770,
    state: { ...base, hour: 21, found: ["bath", "weather", "stars"] },
    camera: ARRIVAL_POSTER,
  },
  {
    id: "island-day-phone",
    file: "plates/island-day-phone.jpg",
    width: 780,
    height: 802,
    state: { ...base, hour: 9 },
    camera: PHONE_POSTER,
  },
  {
    id: "island-night-phone",
    file: "plates/island-night-phone.jpg",
    width: 780,
    height: 802,
    state: { ...base, hour: 21, found: ["bath", "weather", "stars"] },
    camera: PHONE_POSTER,
  },
  ...(Object.keys(STAY_SITES) as StayId[]).map((id) => ({
    id: `${id}-day`,
    file: `plates/${id}-day.jpg`,
    width: 1440,
    height: 770,
    state: { ...base, hour: 9, selected: id },
    camera: posterFor(id),
  })),
];

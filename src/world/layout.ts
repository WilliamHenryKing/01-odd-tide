import type { StayId } from "../domain";

// The authored island in metres (1 unit = 1 m, +Y up). The terrain bake (tools/assets/
// build-terrain.ts) and the runtime scene both read these numbers, so rock, water, paths and
// buildings stay registered to one another.

export type Islet = {
  id: string;
  centre: [number, number];
  radii: [number, number];
  /** Top of the rock plateau above chart datum, metres. */
  top: number;
  /** Rotation of the footprint's noise, for variety. */
  seed: number;
};

export const ISLETS: Islet[] = [
  { id: "home", centre: [-1.5, 0], radii: [11.5, 9], top: 5.4, seed: 11 },
  { id: "lodge", centre: [11.5, 8.2], radii: [8, 5.8], top: 3.7, seed: 23 },
  { id: "nap", centre: [14, -9.5], radii: [7.4, 6.6], top: 7.8, seed: 37 },
  { id: "bath", centre: [-16.5, 7.5], radii: [4.9, 4.4], top: 2.8, seed: 53 },
];

/** Visual tide: the domain's water height (0.16–1.02) scaled to metres. */
export const TIDE_SCALE = 3;
export const waterLevelMetres = (domainHeight: number) => domainHeight * TIDE_SCALE;
/** The domain's safe causeway threshold (0.54) in metres. */
export const CAUSEWAY_THRESHOLD = 0.54 * TIDE_SCALE;
/** Causeway stepping-stone tops sit just above the threshold, so the rule is visible. */
export const CAUSEWAY_STONE_TOP = CAUSEWAY_THRESHOLD + 0.2;
/** Highest tide in the authored cycle: marks the top of the wet intertidal band. */
export const HIGH_WATER = 1.02 * TIDE_SCALE;

export const CAUSEWAY: [number, number][] = [
  [-8.2, 5.1],
  [-9.3, 5.9],
  [-10.3, 6.3],
  [-11.4, 6.9],
  [-12.4, 7.2],
];

export const STAY_SITES: Record<StayId, { position: [number, number, number]; rotation: number }> =
  {
    "weather-house": { position: [-3, 5.4, 0.2], rotation: -0.3 },
    "nap-observatory": { position: [14, 7.8, -9.4], rotation: 0.35 },
    "lantern-lodge": { position: [11.2, 3.7, 8.2], rotation: 0.15 },
  };

export const BATH_SITE: [number, number, number] = [-16.6, 2.8, 7.6];
export const LIGHTHOUSE_SITE: [number, number, number] = [18.6, 7.8, -12.3];

/** Terrain bake bounds (metres) and resolution. */
export const TERRAIN_BOUNDS = {
  min: [-30, -8, -24] as [number, number, number],
  max: [30, 10.5, 22] as [number, number, number],
  voxel: 0.25,
};
/** Depth of the flat seabed beyond the bake; the bake feathers into it at its edges. */
export const FAR_SEABED = -6.75;
/** Heightmap of the rock/sand top surface for water depth, sampled over the same x/z bounds. */
export const HEIGHTMAP_SIZE = 256;

/**
 * Authored walks. Boardwalk points are [x, deck height | undefined (follow rock), z]; stairs
 * run between two points. Lanterns are [x, z, switch-on order] beside the walk.
 */
export type PathSpec = {
  id: string;
  kind: "boardwalk" | "stairs";
  points: [number, number | undefined, number][];
  width: number;
  rails: boolean;
  seed: number;
  lanterns?: [number, number, number][];
};
export const PATHS: PathSpec[] = [
  {
    id: "walk-lodge",
    kind: "boardwalk",
    points: [
      [0.8, undefined, 2.6],
      [4.2, undefined, 4.4],
      [7.3, undefined, 5.6],
      [9.2, undefined, 6.2],
    ],
    width: 1.1,
    rails: false,
    seed: 11,
    lanterns: [
      [2.2, 2.9, 0],
      [5.6, 4.5, 1],
      [8.4, 5.4, 2],
    ],
  },
  {
    id: "bridge-nap",
    kind: "boardwalk",
    points: [
      [4.2, 5.45, -3.3],
      [7.0, 6.55, -5.0],
      [9.5, 7.85, -6.6],
    ],
    width: 1.1,
    rails: true,
    seed: 13,
    lanterns: [[4.9, -2.7, 3]],
  },
  {
    id: "stairs-cove",
    kind: "stairs",
    points: [
      [2.9, 5.45, 3.5],
      [3.4, 2.55, 6.4],
    ],
    width: 1.0,
    rails: true,
    seed: 17,
    lanterns: [[3.9, 3.3, 4]],
  },
  {
    id: "stairs-causeway",
    kind: "stairs",
    points: [
      [-6.4, 5.45, 3.1],
      [-7.9, 2.0, 4.8],
    ],
    width: 0.95,
    rails: true,
    seed: 19,
    lanterns: [[-5.6, 2.6, 5]],
  },
];

type Shot = {
  offset: [number, number, number];
  aim: [number, number, number];
  aimPortrait: [number, number, number];
};
/** Camera shots per stay, relative to the stay's site: closed exterior and roof-open views. */
export const STAY_CAMERAS: Record<StayId, { closed: Shot; open: Shot }> = {
  "weather-house": {
    closed: { offset: [-11, 10.5, 18.5], aim: [-6, 2, -3.4], aimPortrait: [0, 2, 0] },
    open: { offset: [-12, 15, 23], aim: [-6.8, 3, -3.9], aimPortrait: [0, 3, 0.5] },
  },
  "nap-observatory": {
    closed: { offset: [13, 10, 18], aim: [-5.4, 2.1, 3.8], aimPortrait: [0, 2.1, 0] },
    open: { offset: [14, 14, 22], aim: [-6, 3, 4.3], aimPortrait: [0, 3, 0.5] },
  },
  "lantern-lodge": {
    closed: { offset: [13, 10, 18.5], aim: [-5.6, 2.1, 4], aimPortrait: [0, 2.1, 0] },
    open: { offset: [14, 14, 22], aim: [-6, 3, 4.4], aimPortrait: [0, 3, 0.5] },
  },
};

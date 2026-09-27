import type { Recipes } from "./kit/build";
import {
  bend,
  blend,
  box,
  capsule,
  carve,
  chain,
  cone,
  cylinder,
  displace,
  ellipsoid,
  extrude,
  fbm,
  lathe,
  type Mat,
  mat,
  mirrorX,
  mottle,
  move,
  type Node,
  paint,
  polygon2,
  radial,
  rng,
  rotate,
  scale,
  sphere,
  subtract,
  torus,
  union,
  type Vec3,
} from "./kit/sdf";

const pick = <T>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)] as T;
const range = (r: () => number, a: number, b: number) => a + (b - a) * r();
void [bend, blend, box, capsule, carve, chain, cone, cylinder, displace, ellipsoid, extrude, fbm, lathe, mirrorX, mottle, move, paint, polygon2, radial, rotate, scale, sphere, subtract, torus, union];
type Build = (seed: number, index: number) => Node;
void (0 as unknown as Mat | Vec3 | Build);

// ODD TIDE — coast kit for the island: layered sandstone boulders, driftwood, shells,
// sea-thrift cushions, a broadleaf milkwood (the second tree species) and harbour props.
const SAND = [0xc9965f, 0xb98352, 0xd7a86f, 0xa8744a];

const boulder: Build = (seed) => {
  const r = rng(seed);
  const w = range(r, 0.6, 2.4);
  const h = w * range(r, 0.35, 0.7);
  const stone = mat(pick(r, SAND), 0.85);
  let rock = blend(w * 0.15, box(w, h, w * range(r, 0.6, 1), w * 0.12, stone), move(ellipsoid(w * 0.45, h * 0.6, w * 0.4, stone), [w * 0.2, h * 0.2, 0]));
  rock = displace(rock, w * 0.035, 2.2 / w, 5, seed);
  // Bedding: thin horizontal grooves and banded colour, algae toward the base.
  const beds = 2 + Math.floor(r() * 4);
  for (let i = 1; i <= beds; i++) rock = carve(w * 0.02, rock, move(box(w * 3, h * 0.035, w * 3), [0, -h / 2 + (i * h) / (beds + 1), 0]));
  const algae = mat(0x4d5a2e, 0.7);
  return paint(rock, (x, y, z, base) => {
    const band = 0.85 + 0.25 * Math.sin((y / h) * 18 + fbm(x * 3, y * 3, z * 3, 3, seed) * 3);
    if (y < -h * 0.32 + fbm(x * 4, 0, z * 4, 3, seed) * h * 0.15) return algae;
    return { ...base, c: [base.c[0] * band, base.c[1] * band, base.c[2] * band] };
  });
};

const driftwood: Build = (seed) => {
  const r = rng(seed);
  const len = range(r, 0.8, 2.2);
  const wood = mat(pick(r, [0xb9b1a3, 0xa39a8b, 0xc7bfb0]), 0.9);
  const pts: Vec3[] = [];
  for (let i = 0; i <= 6; i++) pts.push([(i / 6 - 0.5) * len, Math.sin(i * 1.3 + r() * 3) * 0.05, Math.cos(i * 0.9 + r() * 2) * 0.08]);
  let log = chain(pts, range(r, 0.05, 0.1), range(r, 0.02, 0.05), wood, 0.03);
  if (r() < 0.7) log = blend(0.02, log, chain([pts[3] as Vec3, [(pts[3] as Vec3)[0] + 0.2, 0.12, 0.25]], 0.035, 0.012, wood));
  return mottle(displace(log, 0.006, 18, 3, seed), 0.15, 6, seed);
};

const shell: Build = (seed, index) => {
  const r = rng(seed);
  const tone = mat(pick(r, [0xe9d8c4, 0xd9a58a, 0xf1e6d6, 0xc98f7a, 0xb7a9c9]), 0.45);
  if (index % 3 === 0) {
    // Scallop: ribbed fan.
    const fan = subtract(radial(capsule([0, 0, 0], [0.05, 0, 0], 0.006, 0.009, tone), 18), move(box(0.2, 0.2, 0.2), [0, 0, -0.1]));
    return rotate(blend(0.004, intersect2(ellipsoid(0.05, 0.012, 0.05, tone), fan), move(box(0.03, 0.01, 0.012, 0.004, tone), [0, 0, 0.002])), [0, 0, 0]);
  }
  if (index % 3 === 1) {
    // Limpet: ribbed cone.
    return displace(union(cone(0.035, 0.004, 0.02, tone), radial(capsule([0.004, 0.009, 0], [0.034, -0.009, 0], 0.002, 0.003, tone), 22)), 0.001, 90, 2, seed);
  }
  // Cockle: ribbed dome.
  return blend(0.003, ellipsoid(0.03, 0.02, 0.033, tone), radial(rotate(capsule([0, 0.018, 0], [0.03, -0.004, 0], 0.003, 0.003, tone), [0, 0, 0]), 16));
};
const intersect2 = (a: Node, b: Node): Node => ({ d: (x, y, z) => Math.max(a.d(x, y, z), b.d(x, y, z)), mat: a.mat, box: a.box });

const thrift: Build = (seed) => {
  const r = rng(seed);
  const leaf = mat(0x5f7a3c, 0.8);
  const bloom = mat(pick(r, [0xe39bb4, 0xf2c1d0, 0xd07a9a]), 0.6);
  const s = range(r, 0.12, 0.3);
  const cushion = displace(subtract(ellipsoid(s, s * 0.6, s * range(r, 0.8, 1.1), leaf), move(box(2, 2, 2), [0, -1, 0])), s * 0.06, 12 / s, 4, seed);
  const flowers: Node[] = [];
  const count = 5 + Math.floor(r() * 10);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * s * 0.7;
    const p: Vec3 = [Math.cos(a) * d, s * 0.55 + r() * s * 0.25, Math.sin(a) * d];
    flowers.push(capsule([p[0], s * 0.4, p[2]], p, 0.003, 0.003, leaf), move(sphere(s * 0.07, bloom), p));
  }
  return union(cushion, ...flowers);
};

const milkwood: Build = (seed) => {
  const r = rng(seed);
  const bark = mat(pick(r, [0x6d5a48, 0x5e4c3c, 0x7a6552]), 0.95);
  const leaves = mat(pick(r, [0x3f5a2c, 0x4a6634, 0x566f3a]), 0.85);
  const h = range(r, 2.6, 4.2);
  const lean = range(r, -0.5, 0.5);
  const trunk = chain([[0, 0, 0], [lean * 0.3, h * 0.35, 0.1], [lean * 0.7, h * 0.7, -0.1], [lean, h, 0]], 0.22, 0.09, bark, 0.08);
  const parts: Node[] = [trunk];
  const crowns = 5 + Math.floor(r() * 4);
  for (let i = 0; i < crowns; i++) {
    const a = (i / crowns) * Math.PI * 2 + r();
    const d = range(r, 0.6, 1.4);
    const top: Vec3 = [lean + Math.cos(a) * d, h + range(r, -0.2, 0.6), Math.sin(a) * d];
    parts.push(chain([[lean * 0.8, h * 0.8, 0], top], 0.08, 0.04, bark));
    parts.push(displace(move(ellipsoid(range(r, 0.7, 1.1), range(r, 0.45, 0.7), range(r, 0.7, 1.1), leaves), [top[0], top[1] + 0.2, top[2]]), 0.12, 3.5, 4, seed + i));
  }
  return mottle(blend(0.1, ...parts), 0.2, 3, seed);
};

const crabPot: Build = (seed) => {
  const r = rng(seed);
  const wicker = mat(pick(r, [0x9b7a4c, 0x8a6a40]), 0.9);
  const rope = mat(0xcdb68c, 0.9);
  const rad = range(r, 0.3, 0.42);
  const ribs = radial(capsule([rad, 0, 0], [rad * 0.55, rad * 0.9, 0], 0.012, 0.012, wicker), 14);
  const rings = union(...[0, 0.25, 0.5, 0.75].map((t) => move(torus(rad * (1 - t * 0.45), 0.01, wicker), [0, t * rad * 0.9, 0])));
  return union(ribs, rings, move(torus(rad * 0.55, 0.018, rope), [0, rad * 0.9, 0]), move(cylinder(rad, 0.03, 0.01, wicker), [0, 0, 0]));
};

const ropeCoil: Build = (seed) => {
  const r = rng(seed);
  const rope = mat(pick(r, [0xcdb68c, 0x9c8f73, 0x3f6f7a]), 0.9);
  const turns = 3 + Math.floor(r() * 4);
  const parts: Node[] = [];
  for (let i = 0; i < turns; i++) parts.push(move(torus(range(r, 0.18, 0.26) - i * 0.015, 0.022, rope), [range(r, -0.01, 0.01), i * 0.04, range(r, -0.01, 0.01)]));
  return displace(union(...parts), 0.003, 40, 2, seed);
};

export const project = { id: "01-odd-tide", name: "ODD TIDE", background: 0x2f4a4f };
export const families: Recipes["families"] = [
  { id: "sandstone-boulder", count: 48, voxel: 0.018, keep: 0.25, wear: 0.4, dirt: 0.5, build: boulder },
  { id: "driftwood", count: 24, voxel: 0.008, keep: 0.3, build: driftwood },
  { id: "shell", count: 30, voxel: 0.0012, keep: 0.3, build: shell },
  { id: "sea-thrift", count: 20, voxel: 0.006, keep: 0.3, build: thrift },
  { id: "milkwood-tree", count: 12, voxel: 0.03, keep: 0.25, hero: true, build: milkwood },
  { id: "crab-pot", count: 10, voxel: 0.008, keep: 0.3, build: crabPot },
  { id: "rope-coil", count: 12, voxel: 0.005, keep: 0.3, build: ropeCoil },
];
export const textures: Recipes["textures"] = [
  { id: "sandstone-bedded", ramp: [0x8a5f3a, 0xb98352, 0xd7a86f, 0xe6c290], layers: [{ kind: "grain", rings: 14, warp: 0.6 }, { kind: "fbm", scale: 8, octaves: 6, weight: 0.8 }], roughness: [0.75, 0.95], normal: 2.5 },
  { id: "wet-sand", ramp: [0x6e5a45, 0x8f7658, 0xa98d6a], layers: [{ kind: "fbm", scale: 48, octaves: 4 }, { kind: "fbm", scale: 6, weight: 0.5 }], roughness: [0.25, 0.6], normal: 0.8 },
  { id: "bleached-wood", ramp: [0x8f877a, 0xb9b1a3, 0xd0c9bc], layers: [{ kind: "fibres", scale: 16, stretch: 10 }, { kind: "grain", rings: 30, warp: 1.2, weight: 0.5 }], roughness: [0.8, 0.95], normal: 1.5 },
  { id: "glazed-tile", ramp: [0xa9563a, 0xd06d44, 0xe08a5c], layers: [{ kind: "cells", count: 6, crack: true }, { kind: "fbm", scale: 20, weight: 0.3 }], roughness: [0.15, 0.4], normal: 1 },
  { id: "rope-weave", ramp: [0x8c7654, 0xcdb68c, 0xe0cfa6], layers: [{ kind: "weave", count: 24 }, { kind: "fibres", scale: 64, stretch: 4, weight: 0.4 }], roughness: [0.8, 0.95], normal: 2 },
];

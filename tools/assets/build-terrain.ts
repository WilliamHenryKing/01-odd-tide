// Bakes the ODD TIDE coast: a signed-distance island meshed with surface nets.
// Run: bun tools/assets/build-terrain.ts  → assets-src/terrain/island-terrain.raw.glb
//                                        → public/models/island-height.bin (+ .json)
// Then compress with glTF Transform (see tools/assets/README.md).
// Procedural by necessity: the island is fictional, its tide levels are authored rules, and
// sandstone bedding with undercut ledges is the kind of form a heightfield cannot express.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CAUSEWAY,
  HEIGHTMAP_SIZE,
  HIGH_WATER,
  ISLETS,
  type Islet,
  TERRAIN_BOUNDS,
} from "../../src/world/layout.ts";

// ------------------------------------------------------------------ noise
const PERM = new Uint8Array(512);
{
  let s = 2463534242;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j] as number, p[i] as number];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255] as number;
}
const G3 = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h: number, x: number, y: number, z: number) {
  const g = G3[h % 12] as number[];
  return (g[0] as number) * x + (g[1] as number) * y + (g[2] as number) * z;
}
/** Perlin gradient noise, roughly [-1, 1]. */
function noise3(x: number, y: number, z: number) {
  const X = Math.floor(x),
    Y = Math.floor(y),
    Z = Math.floor(z);
  const xf = x - X,
    yf = y - Y,
    zf = z - Z;
  const xi = X & 255,
    yi = Y & 255,
    zi = Z & 255;
  const u = fade(xf),
    v = fade(yf),
    w = fade(zf);
  const P = PERM;
  const aa = P[(P[(P[xi] as number) + yi] as number) + zi] as number;
  const ab = P[(P[(P[xi] as number) + yi + 1] as number) + zi] as number;
  const ba = P[(P[(P[xi + 1] as number) + yi] as number) + zi] as number;
  const bb = P[(P[(P[xi + 1] as number) + yi + 1] as number) + zi] as number;
  const aa1 = P[(P[(P[xi] as number) + yi] as number) + zi + 1] as number;
  const ab1 = P[(P[(P[xi] as number) + yi + 1] as number) + zi + 1] as number;
  const ba1 = P[(P[(P[xi + 1] as number) + yi] as number) + zi + 1] as number;
  const bb1 = P[(P[(P[xi + 1] as number) + yi + 1] as number) + zi + 1] as number;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(
      lerp(grad(aa, xf, yf, zf), grad(ba, xf - 1, yf, zf), u),
      lerp(grad(ab, xf, yf - 1, zf), grad(bb, xf - 1, yf - 1, zf), u),
      v,
    ),
    lerp(
      lerp(grad(aa1, xf, yf, zf - 1), grad(ba1, xf - 1, yf, zf - 1), u),
      lerp(grad(ab1, xf, yf - 1, zf - 1), grad(bb1, xf - 1, yf - 1, zf - 1), u),
      v,
    ),
    w,
  );
}
function fbm3(x: number, y: number, z: number, octaves = 4) {
  let sum = 0,
    amp = 0.5,
    f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

// ------------------------------------------------------------------ sandstone bedding
// Beds of 0.3–0.9 m alternate hard (proud) and soft (recessed). A wave-cut notch sits in the
// intertidal band, deepest a little below high water.
const BEDS: { base: number; hard: boolean }[] = [];
{
  let y = -8;
  let i = 0;
  while (y < 12) {
    const thickness = 0.3 + ((((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1) * 0.6;
    BEDS.push({ base: y, hard: i % 2 === 0 || i % 5 === 3 });
    y += thickness;
    i++;
  }
}
function beddingRecess(y: number, wobble: number) {
  const yy = y + wobble;
  let lo = 0,
    hi = BEDS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((BEDS[mid] as { base: number }).base <= yy) lo = mid;
    else hi = mid - 1;
  }
  const bed = BEDS[lo] as { base: number; hard: boolean };
  const next = BEDS[lo + 1]?.base ?? bed.base + 0.6;
  const t = (yy - bed.base) / (next - bed.base);
  // Rounded profile within each bed: soft beds cave in, hard beds keep a lip.
  const bulge = Math.sin(Math.PI * Math.min(Math.max(t, 0), 1));
  const recess = bed.hard ? 0.05 - 0.07 * bulge : 0.18 + 0.2 * bulge;
  const notch = 0.55 * Math.exp(-(((y - (HIGH_WATER - 0.9)) / 0.7) ** 2));
  return recess + notch;
}

// ------------------------------------------------------------------ islets
function footprintRadius(islet: Islet, angle: number) {
  const s = islet.seed;
  return (
    1 +
    0.11 * Math.sin(3 * angle + s) +
    0.07 * Math.sin(5 * angle + 2.3 * s) +
    0.035 * Math.sin(9 * angle + 0.7 * s) +
    0.06 * noise3(Math.cos(angle) * 1.7 + s, Math.sin(angle) * 1.7, s * 0.37)
  );
}
/** Approximate horizontal distance (m) outside the islet's footprint at scale 'grow'. */
function footprintDistance(islet: Islet, x: number, z: number, grow = 0) {
  const qx = (x - islet.centre[0]) / islet.radii[0];
  const qz = (z - islet.centre[1]) / islet.radii[1];
  const rho = Math.hypot(qx, qz);
  const angle = Math.atan2(qz, qx);
  const r = footprintRadius(islet, angle);
  const scale = Math.min(islet.radii[0], islet.radii[1]);
  return (rho - r) * scale - grow;
}
function plateauHeight(islet: Islet, x: number, z: number, edge: number) {
  const undulate = 0.28 * fbm3(x * 0.09, 3.1, z * 0.09, 3) + 0.08 * noise3(x * 0.6, 7.7, z * 0.6);
  // Weathered rim: the top rounds down over the last metre and a half before the cliff.
  const rim = 0.55 * smoothstep(-1.6, 0, edge);
  let h = islet.top + undulate - rim;
  if (islet.id === "home") {
    // A lower eastern step toward the lodge bridge and a small hollow for the Weather House.
    const east = smoothstep(4, 9, x - islet.centre[0]);
    h -= east * 1.1;
  }
  return h;
}
function shelfSpec(islet: Islet, angle: number) {
  // Width and height of the tidal platform around each islet, varying by sector.
  const s = islet.seed;
  const width = Math.max(0, 1.6 + 2.6 * Math.sin(angle * 2 + s) + 1.4 * Math.sin(angle * 3 - s));
  const height = 1.15 + 0.35 * Math.sin(angle * 4 + s * 0.5);
  return { width, height };
}

function causewayDistance(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < CAUSEWAY.length - 1; i++) {
    const [ax, az] = CAUSEWAY[i] as [number, number];
    const [bx, bz] = CAUSEWAY[i + 1] as [number, number];
    const px = x - ax;
    const pz = z - az;
    const vx = bx - ax;
    const vz = bz - az;
    const t = Math.max(0, Math.min(1, (px * vx + pz * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(px - vx * t, pz - vz * t));
  }
  return best;
}

function isletSdf(islet: Islet, x: number, y: number, z: number) {
  const wobble = 0.18 * noise3(x * 0.35, y * 0.2, z * 0.35);
  const edge = footprintDistance(islet, x, z);
  // Cliff face: gentle batter plus bedding recesses (only where rock stands above the shelf).
  const batter = Math.max(0, y - 1) * 0.06;
  const wall = edge + batter + beddingRecess(y, wobble) * smoothstep(-0.5, 1.2, y);
  const top = y - plateauHeight(islet, x, z, edge);
  let d = smax(wall, top, 0.5);
  // Tidal shelf apron.
  const qx = (x - islet.centre[0]) / islet.radii[0];
  const qz = (z - islet.centre[1]) / islet.radii[1];
  const angle = Math.atan2(qz, qx);
  const shelf = shelfSpec(islet, angle);
  // No shelf in a corridor around the causeway: the stepping stones must be the only dry route.
  shelf.width *= smoothstep(1.2, 3.2, causewayDistance(x, z));
  if (shelf.width > 0.2) {
    const shelfWall = footprintDistance(islet, x, z, shelf.width) + beddingRecess(y, wobble) * 0.5;
    const shelfTop = y - (shelf.height + 0.12 * noise3(x * 0.5, 1.3, z * 0.5));
    d = Math.min(d, smax(shelfWall, shelfTop, 0.35));
  }
  return d;
}

// ------------------------------------------------------------------ cove, seabed, pools
const COVE_CENTRE: [number, number] = [0.5, 8.6];
/** Beach surface height inside the cove: from ~2.4 m at the back to below low water at the mouth. */
function beachHeight(x: number, z: number) {
  const back = z - (COVE_CENTRE[1] - 4.2);
  return 2.45 - Math.max(0, back) * 0.36 + 0.05 * noise3(x * 0.8, 0.5, z * 0.8);
}
/** Signed horizontal distance to the cove's footprint (negative inside). */
function coveFootprint(x: number, z: number) {
  const dx = (x - COVE_CENTRE[0]) / 4.2;
  const dz = (z - COVE_CENTRE[1]) / 5.2;
  return (Math.hypot(dx, dz) - 1) * 4.2 + 0.4 * noise3(x * 0.4, 2.2, z * 0.4);
}
function applyCove(d: number, x: number, y: number, z: number) {
  const inside = coveFootprint(x, z);
  const beach = beachHeight(x, z);
  // Carve the cliff away above the beach, then lay the sand.
  const air = Math.max(inside, beach - y);
  const carved = smax(d, -air, 0.9);
  return smin(carved, Math.max(inside + 0.6, y - beach), 0.6);
}
function nearestEdge(x: number, z: number) {
  let best = Infinity;
  for (const islet of ISLETS) best = Math.min(best, footprintDistance(islet, x, z));
  return best;
}
function seabedHeight(x: number, z: number) {
  const edge = Math.max(0, nearestEdge(x, z));
  // Broad pale sand flats on the camera side (+z, +x) for the turquoise shallows.
  const flats = smoothstep(-6, 10, z + x * 0.35);
  const shelfDepth = -0.25 - (1 - flats) * 0.9;
  const deep = -6.5;
  const falloff = 7 + 7 * flats;
  let h = deep + (shelfDepth - deep) * Math.exp(-edge / falloff);
  // Sand ripples and a few gravel mounds.
  h += 0.06 * Math.sin(x * 2.1 + noise3(x * 0.2, 0, z * 0.2) * 4) * smoothstep(-5, -0.5, h);
  h += 0.25 * fbm3(x * 0.07, 9.1, z * 0.07, 3);
  return h;
}
const POOLS: [number, number, number, number][] = []; // x, z, radius, depth
{
  let s = 97;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (const islet of ISLETS)
    for (let i = 0; i < 7; i++) {
      const angle = r() * Math.PI * 2;
      const shelf = shelfSpec(islet, angle);
      if (shelf.width < 1.4) continue;
      const k = footprintRadius(islet, angle) + (shelf.width * 0.55) / Math.min(...islet.radii);
      POOLS.push([
        islet.centre[0] + Math.cos(angle) * islet.radii[0] * k,
        islet.centre[1] + Math.sin(angle) * islet.radii[1] * k,
        0.35 + r() * 0.55,
        0.25 + r() * 0.2,
      ]);
    }
}

export function sdf(x: number, y: number, z: number) {
  let d = Infinity;
  for (const islet of ISLETS) d = Math.min(d, isletSdf(islet, x, y, z));
  d = applyCove(d, x, y, z);
  // Causeway ridge: a low sandstone spine the stepping stones sit on (well below the stones).
  for (let i = 0; i < CAUSEWAY.length - 1; i++) {
    const [ax, az] = CAUSEWAY[i] as [number, number];
    const [bx, bz] = CAUSEWAY[i + 1] as [number, number];
    const px = x - ax,
      pz = z - az,
      vx = bx - ax,
      vz = bz - az;
    const t = Math.max(0, Math.min(1, (px * vx + pz * vz) / (vx * vx + vz * vz)));
    const dist = Math.hypot(px - vx * t, pz - vz * t);
    d = smin(d, Math.max(dist - 1.1, y - 0.3), 0.5);
  }
  d = smin(d, y - seabedHeight(x, z), 1.4);
  for (const [px, pz, radius, depth] of POOLS) {
    const pool = Math.hypot((x - px) / radius, (y - 1.35) / depth, (z - pz) / radius) - 1;
    d = smax(d, -pool * Math.min(radius, depth), 0.12);
  }
  // Rock grain: small-scale roughness everywhere, stronger on steep ground.
  d += 0.06 * fbm3(x * 1.6, y * 1.6, z * 1.6, 3) + 0.018 * noise3(x * 5.3, y * 5.3, z * 5.3);
  return d;
}

// ------------------------------------------------------------------ surface nets
const { min, max, voxel } = TERRAIN_BOUNDS;
const nx = Math.round((max[0] - min[0]) / voxel) + 1;
const ny = Math.round((max[1] - min[1]) / voxel) + 1;
const nz = Math.round((max[2] - min[2]) / voxel) + 1;
console.log(`grid ${nx}×${ny}×${nz} = ${((nx * ny * nz) / 1e6).toFixed(2)}M samples`);
const t0 = performance.now();
const field = new Float32Array(nx * ny * nz);
const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
for (let k = 0; k < nz; k++)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      field[at(i, j, k)] = sdf(min[0] + i * voxel, min[1] + j * voxel, min[2] + k * voxel);
console.log(`field ${(performance.now() - t0).toFixed(0)} ms`);

const cellIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
const cellAt = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
const positions: number[] = [];
const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];
const EDGES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
for (let k = 0; k < nz - 1; k++)
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const values = CORNERS.map(
        ([a, b, c]) => field[at(i + (a as number), j + (b as number), k + (c as number))] as number,
      );
      let inside = 0;
      for (const v of values) if (v < 0) inside++;
      if (inside === 0 || inside === 8) continue;
      let sx = 0,
        sy = 0,
        sz = 0,
        count = 0;
      for (const [a, b] of EDGES) {
        const va = values[a as number] as number,
          vb = values[b as number] as number;
        if (va < 0 === vb < 0) continue;
        const t = va / (va - vb);
        const ca = CORNERS[a as number] as number[],
          cb = CORNERS[b as number] as number[];
        sx += (ca[0] as number) + ((cb[0] as number) - (ca[0] as number)) * t;
        sy += (ca[1] as number) + ((cb[1] as number) - (ca[1] as number)) * t;
        sz += (ca[2] as number) + ((cb[2] as number) - (ca[2] as number)) * t;
        count++;
      }
      cellIndex[cellAt(i, j, k)] = positions.length / 3;
      positions.push(
        min[0] + (i + sx / count) * voxel,
        min[1] + (j + sy / count) * voxel,
        min[2] + (k + sz / count) * voxel,
      );
    }
const indices: number[] = [];
// Winding: with 'inside' at the lower end of an edge the outward normal points along +axis;
// (a, b, c, d) then run clockwise seen from outside, so the unflipped order is (a, c, b).
const quad = (a: number, b: number, c: number, d: number, insideLow: boolean) => {
  if (a < 0 || b < 0 || c < 0 || d < 0) return;
  if (insideLow) indices.push(a, b, c, a, c, d);
  else indices.push(a, c, b, a, d, c);
};
for (let k = 1; k < nz - 1; k++)
  for (let j = 1; j < ny - 1; j++)
    for (let i = 1; i < nx - 1; i++) {
      const v0 = field[at(i, j, k)] as number;
      // x-edge
      if (i < nx - 1) {
        const v1 = field[at(i + 1, j, k)] as number;
        if (v0 < 0 !== v1 < 0)
          quad(
            cellIndex[cellAt(i, j - 1, k - 1)] as number,
            cellIndex[cellAt(i, j, k - 1)] as number,
            cellIndex[cellAt(i, j, k)] as number,
            cellIndex[cellAt(i, j - 1, k)] as number,
            v0 < 0,
          );
      }
      if (j < ny - 1) {
        const v1 = field[at(i, j + 1, k)] as number;
        if (v0 < 0 !== v1 < 0)
          quad(
            cellIndex[cellAt(i - 1, j, k - 1)] as number,
            cellIndex[cellAt(i - 1, j, k)] as number,
            cellIndex[cellAt(i, j, k)] as number,
            cellIndex[cellAt(i, j, k - 1)] as number,
            v0 < 0,
          );
      }
      if (k < nz - 1) {
        const v1 = field[at(i, j, k + 1)] as number;
        if (v0 < 0 !== v1 < 0)
          quad(
            cellIndex[cellAt(i - 1, j - 1, k)] as number,
            cellIndex[cellAt(i, j - 1, k)] as number,
            cellIndex[cellAt(i, j, k)] as number,
            cellIndex[cellAt(i - 1, j, k)] as number,
            v0 < 0,
          );
      }
    }
console.log(
  `mesh ${positions.length / 3} vertices, ${indices.length / 3} triangles (${(performance.now() - t0).toFixed(0)} ms)`,
);

// ------------------------------------------------------------------ attributes
const vertexCount = positions.length / 3;
const normals = new Float32Array(vertexCount * 3);
const colours = new Uint8Array(vertexCount * 4);
const e = 0.06;
let maxX = -Infinity,
  maxY = -Infinity,
  maxZ = -Infinity,
  minX = Infinity,
  minY = Infinity,
  minZ = Infinity;
for (let v = 0; v < vertexCount; v++) {
  const x = positions[v * 3] as number,
    y = positions[v * 3 + 1] as number,
    z = positions[v * 3 + 2] as number;
  minX = Math.min(minX, x);
  minY = Math.min(minY, y);
  minZ = Math.min(minZ, z);
  maxX = Math.max(maxX, x);
  maxY = Math.max(maxY, y);
  maxZ = Math.max(maxZ, z);
  let gx = sdf(x + e, y, z) - sdf(x - e, y, z);
  let gy = sdf(x, y + e, z) - sdf(x, y - e, z);
  let gz = sdf(x, y, z + e) - sdf(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  gx /= l;
  gy /= l;
  gz /= l;
  normals.set([gx, gy, gz], v * 3);
  // SDF ambient occlusion (Quilez): compare expected and actual distance along the normal.
  let occlusion = 0,
    weight = 1;
  for (let s = 1; s <= 5; s++) {
    const h = 0.08 + 0.22 * s;
    occlusion += (h - sdf(x + gx * h, y + gy * h, z + gz * h)) * weight;
    weight *= 0.75;
  }
  const ao = Math.max(0, Math.min(1, 1 - 0.9 * occlusion));
  const cove = coveFootprint(x, z);
  const flat = smoothstep(0.72, 0.93, gy);
  const low = 1 - smoothstep(2.1, 3.1, y);
  const sand = Math.max(
    flat * low * (y < 1.0 ? 1 : smoothstep(0.5, -1.0, cove)),
    smoothstep(-0.8, -2, y) * smoothstep(0.5, 0.8, gy),
  );
  let topness = 0;
  for (const islet of ISLETS) {
    const edge = footprintDistance(islet, x, z);
    if (edge < -0.4 && y > islet.top - 1.8)
      topness = Math.max(topness, smoothstep(-0.4, -2.2, edge));
  }
  const patch = 0.5 + 0.5 * fbm3(x * 0.18, 2.2, z * 0.18, 3);
  const grass = topness * flat * smoothstep(3.0, 3.6, y) * smoothstep(0.2, 0.55, patch + 0.25);
  const variation = 0.5 + 0.5 * noise3(x * 0.07, y * 0.3, z * 0.07);
  colours.set(
    [
      Math.round(ao * 255),
      Math.round(Math.min(1, sand) * 255),
      Math.round(grass * 255),
      Math.round(variation * 255),
    ],
    v * 4,
  );
}

// ------------------------------------------------------------------ heightmap (top surface)
const heights = new Float32Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
for (let row = 0; row < HEIGHTMAP_SIZE; row++)
  for (let col = 0; col < HEIGHTMAP_SIZE; col++) {
    const x = min[0] + ((col + 0.5) / HEIGHTMAP_SIZE) * (max[0] - min[0]);
    const z = min[2] + ((row + 0.5) / HEIGHTMAP_SIZE) * (max[2] - min[2]);
    let y = max[1];
    let d = sdf(x, y, z);
    for (let step = 0; step < 200 && d > 0.01 && y > min[1]; step++) {
      y -= Math.max(0.03, d * 0.8);
      d = sdf(x, y, z);
    }
    let lo = y,
      hi = y + 0.3;
    for (let b = 0; b < 12; b++) {
      const mid = (lo + hi) / 2;
      if (sdf(x, mid, z) < 0) lo = mid;
      else hi = mid;
    }
    heights[row * HEIGHTMAP_SIZE + col] = Math.max(lo, min[1]);
  }

// ------------------------------------------------------------------ write glb + heightmap
function glb(
  positionsArray: Float32Array,
  normalArray: Float32Array,
  colourArray: Uint8Array,
  index: Uint32Array,
) {
  const chunks = [positionsArray, normalArray, colourArray, index].map(
    (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength),
  );
  const offsets: number[] = [];
  let length = 0;
  for (const c of chunks) {
    offsets.push(length);
    length += Math.ceil(c.byteLength / 4) * 4;
  }
  const bin = new Uint8Array(length);
  chunks.forEach((c, i) => {
    bin.set(c, offsets[i]);
  });
  const json = {
    asset: { version: "2.0", generator: "odd-tide build-terrain.ts" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "island-terrain", mesh: 0 }],
    meshes: [
      {
        name: "island-terrain",
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, mode: 4 }],
      },
    ],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: chunks[0]?.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[1], byteLength: chunks[1]?.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[2], byteLength: chunks[2]?.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsets[3], byteLength: chunks[3]?.byteLength, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5121, normalized: true, count: vertexCount, type: "VEC4" },
      { bufferView: 3, componentType: 5125, count: index.length, type: "SCALAR" },
    ],
  };
  let jsonText = JSON.stringify(json);
  while (jsonText.length % 4) jsonText += " ";
  const jsonBytes = new TextEncoder().encode(jsonText);
  const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const binStart = 20 + jsonBytes.byteLength;
  view.setUint32(binStart, bin.byteLength, true);
  view.setUint32(binStart + 4, 0x004e4942, true);
  out.set(bin, binStart + 8);
  return out;
}
const src = path.resolve("assets-src/terrain");
mkdirSync(src, { recursive: true });
mkdirSync(path.resolve("public/models"), { recursive: true });
writeFileSync(
  path.join(src, "island-terrain.raw.glb"),
  glb(new Float32Array(positions), normals, colours, new Uint32Array(indices)),
);
writeFileSync(path.resolve("public/models/island-height.bin"), new Uint8Array(heights.buffer));
writeFileSync(
  path.resolve("public/models/island-height.json"),
  JSON.stringify(
    {
      size: HEIGHTMAP_SIZE,
      min: [min[0], min[2]],
      max: [max[0], max[2]],
      format: "float32 row-major, row = z",
    },
    null,
    2,
  ),
);
console.log(
  `done ${(performance.now() - t0).toFixed(0)} ms; bounds y ${minY.toFixed(2)}…${maxY.toFixed(2)}`,
);

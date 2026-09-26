import { BufferGeometry, Float32BufferAttribute } from "three";

// Ceramic roofing units as real geometry (not ribs): curved pan-and-cover tiles, half-round
// ridge caps, fish-scale dome tiles and flat interlocking tiles. Dimensions in metres; +Z is
// down-slope (toward the eave), +Y is out of the roof.

/** A curved strip: arc across X, length along Z, with thickness and a taper toward the head. */
export function arcTile(options: {
  radius: number;
  sweep: number;
  length: number;
  thickness: number;
  taper?: number;
  concave?: boolean;
  segments?: number;
}) {
  const { radius, sweep, length, thickness } = options;
  const taper = options.taper ?? 0.88;
  const segments = options.segments ?? 8;
  // Concave units (pans) rise toward their edges; convex ones (covers, caps) fall away.
  const sign = options.concave ? -1 : 1;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // Rings along the length; each ring has outer and inner arcs.
  const rows = 3;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const z = (t - 0.5) * length;
    const scale = taper + (1 - taper) * t; // narrower at the head (t = 0), full at the tail
    for (let side = 0; side < 2; side++) {
      const rr = radius + (side === 0 ? 0 : -thickness);
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments - 0.5) * sweep;
        const x = Math.sin(a) * rr * scale;
        const y = sign * (Math.cos(a) * rr - radius) * scale;
        positions.push(x, y, z);
        const nx = Math.sin(a) * (side === 0 ? 1 : -1) * -sign;
        const ny = Math.cos(a) * (side === 0 ? 1 : -1) * -sign;
        normals.push(options.concave ? -nx : nx, options.concave ? ny : -ny, 0);
        uvs.push(s / segments, t);
      }
    }
  }
  const ring = (segments + 1) * 2;
  for (let r = 0; r < rows; r++)
    for (let side = 0; side < 2; side++)
      for (let s = 0; s < segments; s++) {
        const a = r * ring + side * (segments + 1) + s;
        const b = a + ring;
        if (side === 0) indices.push(a, b, a + 1, a + 1, b, b + 1);
        else indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
  // Close the two long edges and the two ends so the unit reads as solid at the eave.
  const addQuad = (p0: number[], p1: number[], p2: number[], p3: number[], n: number[]) => {
    const base = positions.length / 3;
    for (const p of [p0, p1, p2, p3]) {
      positions.push(p[0] as number, p[1] as number, p[2] as number);
      normals.push(n[0] as number, n[1] as number, n[2] as number);
      uvs.push(0, 0);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const vertex = (r: number, side: number, s: number) => {
    const i = (r * ring + side * (segments + 1) + s) * 3;
    return [positions[i] as number, positions[i + 1] as number, positions[i + 2] as number];
  };
  addQuad(
    vertex(rows, 0, 0),
    vertex(rows, 0, segments),
    vertex(rows, 1, segments),
    vertex(rows, 1, 0),
    [0, 0, 1],
  );
  addQuad(
    vertex(0, 1, 0),
    vertex(0, 1, segments),
    vertex(0, 0, segments),
    vertex(0, 0, 0),
    [0, 0, -1],
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Barrel pan (concave, carries water) sized for a coastal cottage roof. */
export const panTile = () =>
  arcTile({
    radius: 0.13,
    sweep: 1.95,
    length: 0.42,
    thickness: 0.013,
    taper: 0.86,
    concave: true,
  });
/** Barrel cover (convex, bridges two pans). */
export const coverTile = () =>
  arcTile({ radius: 0.08, sweep: 2.5, length: 0.42, thickness: 0.012, taper: 0.84 });
/** Half-round ridge cap. */
export const ridgeTile = () =>
  arcTile({ radius: 0.13, sweep: 3.0, length: 0.42, thickness: 0.016, taper: 0.9, segments: 10 });

/** A fish-scale tile for the observatory dome: a thin rounded shield, +Y out of the surface. */
export function scaleTile(width = 0.16, length = 0.2, thickness = 0.012) {
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = 10;
  // Outline: straight head, rounded tail (a "U"), slightly domed.
  const outline: [number, number][] = [];
  outline.push([-width / 2, -length / 2], [width / 2, -length / 2]);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    outline.push([Math.cos(a) * (width / 2), length / 2 - width / 2 + Math.sin(a) * (width / 2)]);
  }
  // Reorder the rounded tail to run from right to left.
  const ring = [
    outline[0] as [number, number],
    outline[1] as [number, number],
    ...outline.slice(2),
  ];
  const dome = (x: number) => 0.012 * (1 - (x / (width / 2)) ** 2);
  const top = ring.map(([x, z]) => [x, thickness + dome(x), z]);
  const bottom = ring.map(([x, z]) => [x, 0, z]);
  const centreTop = [0, thickness + 0.012, 0];
  positions.push(...centreTop);
  for (const p of top) positions.push(...(p as number[]));
  for (const p of bottom) positions.push(...(p as number[]));
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % n);
    indices.push(0, b, a);
    const ab = 1 + n + i;
    const bb = 1 + n + ((i + 1) % n);
    indices.push(a, b, bb, a, bb, ab);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const uv = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    uv[i * 2] = (positions[i * 3] as number) / width + 0.5;
    uv[i * 2 + 1] = (positions[i * 3 + 2] as number) / length + 0.5;
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** A flat interlocking tile with a raised roll on one side (lodge roof). */
export function flatTile(width = 0.3, length = 0.42, thickness = 0.018) {
  const body = arcTile({
    radius: 1.6,
    sweep: width / 1.6,
    length,
    thickness,
    taper: 0.97,
    concave: true,
    segments: 4,
  });
  return body;
}

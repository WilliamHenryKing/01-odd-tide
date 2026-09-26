import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Construction kit for the island's buildings, in metres. Pieces are merged per material into
// one mesh (one draw call), carry real-size UVs with the grain along each piece's length, and a
// per-piece tone so no two boards are identical. Repeated small parts are instanced.

export type Vec3 = [number, number, number];

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();
const tmpScale = new Vector3(1, 1, 1);
const tmpPos = new Vector3();

export function compose(position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  );
}

/**
 * Replaces a geometry's UVs with metric planar UVs chosen per vertex from its normal, with the
 * u axis along 'grain' where possible. 'metres' is the real size of one texture repeat.
 */
export function metricUVs(
  geometry: BufferGeometry,
  metres: number,
  grain: 0 | 1 | 2,
  offset: [number, number],
) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const face = nx > ny && nx > nz ? 0 : ny > nz ? 1 : 2;
    // The two axes spanning this face; u takes the grain axis when it lies in the face.
    const axes = [0, 1, 2].filter((a) => a !== face) as [number, number];
    const [ua, va] = axes.includes(grain) ? [grain, axes.find((a) => a !== grain) as number] : axes;
    uv[i * 2] = (p[ua] ?? 0) / metres + offset[0];
    uv[i * 2 + 1] = (p[va] ?? 0) / metres + offset[1];
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return geometry;
}

function tint(geometry: BufferGeometry, colour: Color) {
  const count = geometry.getAttribute("position").count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) data.set([colour.r, colour.g, colour.b], i * 3);
  geometry.setAttribute("color", new Float32BufferAttribute(data, 3));
  return geometry;
}

export type PieceOptions = {
  /** Edge radius in metres (0 for sharp). */
  radius?: number;
  /** Relative tone variation (0.08 = ±8%). */
  vary?: number;
  /** Fixed multiplier instead of a random tone. */
  tone?: number;
};

/** Accumulates pieces for one material, then merges them into a single shadowed mesh. */
export class Batch {
  private readonly parts: BufferGeometry[] = [];
  private readonly random: () => number;
  constructor(
    readonly name: string,
    readonly material: Material,
    readonly textureMetres = 1,
    seed = 1,
  ) {
    this.random = rng(seed);
  }
  get count() {
    return this.parts.length;
  }
  /** A rectangular piece of 'size' (x, y, z) at 'position' with Euler 'rotation'. */
  box(size: Vec3, position: Vec3, rotation: Vec3 = [0, 0, 0], options: PieceOptions = {}) {
    const radius = options.radius ?? Math.min(0.006, Math.min(...size) / 4);
    const geometry =
      radius > 0.0005
        ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, radius)
        : new BoxGeometry(...size);
    const grain = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;
    metricUVs(geometry, this.textureMetres, grain as 0 | 1 | 2, [
      this.random() * 7,
      this.random() * 7,
    ]);
    this.push(geometry, compose(position, rotation), options);
    return this;
  }
  /** A round member (post, dowel, pipe) between two points. */
  rod(from: Vec3, to: Vec3, radius: number, options: PieceOptions & { segments?: number } = {}) {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const length = a.distanceTo(b);
    const geometry = new CylinderGeometry(radius, radius, length, options.segments ?? 10, 1);
    metricUVs(geometry, this.textureMetres, 1, [this.random() * 7, this.random() * 7]);
    const matrix = new Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()),
      new Vector3(1, 1, 1),
    );
    this.push(geometry, matrix, options);
    return this;
  }
  /** Any prepared geometry (already UV-mapped), placed with a matrix. */
  add(geometry: BufferGeometry, matrix: Matrix4 = new Matrix4(), options: PieceOptions = {}) {
    this.push(geometry, matrix, options);
    return this;
  }
  private push(geometry: BufferGeometry, matrix: Matrix4, options: PieceOptions) {
    const vary = options.vary ?? 0.08;
    const tone = options.tone ?? 1 + (this.random() * 2 - 1) * vary;
    const hue = (this.random() * 2 - 1) * vary * 0.25;
    const colour = new Color(tone * (1 + hue), tone, tone * (1 - hue));
    geometry.applyMatrix4(matrix);
    const clean = geometry.index ? geometry.toNonIndexed() : geometry;
    if (clean !== geometry) geometry.dispose();
    for (const name of Object.keys(clean.attributes))
      if (!["position", "normal", "uv"].includes(name)) clean.deleteAttribute(name);
    this.parts.push(tint(clean, colour));
  }
  build(): Mesh | null {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    for (const part of this.parts) part.dispose();
    this.parts.length = 0;
    if (!merged) throw new Error(`Could not merge batch ${this.name}`);
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new Mesh(merged, this.material);
    mesh.name = this.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Instanced copies of one geometry with per-instance transforms and optional tone. */
export function instances(
  name: string,
  geometry: BufferGeometry,
  material: Material,
  placements: { position: Vec3; rotation?: Vec3; scale?: Vec3; tone?: Color }[],
) {
  const mesh = new InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  placements.forEach((placement, i) => {
    tmpPos.set(...placement.position);
    tmpEuler.set(...(placement.rotation ?? [0, 0, 0]));
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(...(placement.scale ?? [1, 1, 1]));
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    mesh.setMatrixAt(i, tmpMatrix);
    if (placement.tone) mesh.setColorAt(i, placement.tone);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A rope or cable hung between two anchors on a catenary with the given sag (metres). */
export function catenary(a: Vec3, b: Vec3, sag: number, radius: number, segments = 16) {
  const start = new Vector3(...a);
  const end = new Vector3(...b);
  const points: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = start.clone().lerp(end, t);
    // cosh-shaped dip, zero at both ends and 'sag' at the middle.
    const x = (t - 0.5) * 2;
    const c = 2.2;
    p.y -= sag * (1 - (Math.cosh(x * c) - 1) / (Math.cosh(c) - 1));
    points.push(p);
  }
  const geometry = new TubeGeometry(new CatmullRomCurve3(points), segments * 2, radius, 6, false);
  return geometry;
}

/** A small domed screw/bolt head, 1 unit = its diameter; seat it on the surface normal (+Y). */
export function fastenerGeometry(diameter = 0.009) {
  const geometry = new CylinderGeometry(diameter * 0.5, diameter * 0.55, diameter * 0.28, 8, 1);
  geometry.translate(0, diameter * 0.14, 0);
  return geometry;
}

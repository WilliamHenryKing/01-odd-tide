import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "./build/kit";
import type { PbrSet } from "./textures";

// Coastal planting from CC0 scans (Poly Haven): turf grass, tussocks, scrub and ferns, instanced
// with per-instance variation, plus a few wind-shaped stone pines whose procedural trunks carry
// flattened scrub clusters as umbrella canopies. Foliage is alpha-tested (never blended) and
// sways from a shared uniform that freezes with reduced motion.

export type Keepout = { x: number; z: number; r: number };
export type Segment = { a: [number, number]; b: [number, number]; r: number };
export type VegetationContext = {
  loader: GLTFLoader;
  ground: (x: number, z: number) => number;
  keepouts: Keepout[];
  segments: Segment[];
  bark: PbrSet;
  seed?: number;
};

type Species = { geometry: BufferGeometry; material: MeshStandardMaterial };

const windUniforms = { time: { value: 0 }, strength: { value: 1 } };

function addWind(material: MeshStandardMaterial, stiffness: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windUniforms.time;
    shader.uniforms.windStrength = windUniforms.strength;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float windTime;\nuniform float windStrength;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
        #else
          float windPhase = 0.0;
        #endif
        float windBend = max(position.y, 0.0);
        windBend *= windBend * ${stiffness.toFixed(3)};
        float gust = sin(windTime * 1.3 + windPhase) * 0.6 + sin(windTime * 2.7 + windPhase * 1.7) * 0.25;
        transformed.x += (0.5 + gust) * windBend * windStrength;
        transformed.z += (0.2 + gust * 0.5) * windBend * windStrength * 0.6;`,
      );
  };
  material.customProgramCacheKey = () => `odd-tide-wind-${stiffness}`;
}

async function loadSpecies(
  loader: GLTFLoader,
  id: string,
  alpha: Texture | null,
): Promise<Species> {
  const gltf = await loader.loadAsync(`/models/${id}.glb`);
  const geometries: BufferGeometry[] = [];
  let material: MeshStandardMaterial | null = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh) {
      // Meshopt output is quantized (normalized int attributes dequantized by the node
      // transform). Convert to float first, or baking the transform clamps positions to ±1.
      const source = object.geometry as BufferGeometry;
      const flat = source.index ? source.toNonIndexed() : source.clone();
      const geometry = new BufferGeometry();
      for (const name of ["position", "normal", "uv"]) {
        const attribute = flat.getAttribute(name);
        if (!attribute) continue;
        const data = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++)
          for (let c = 0; c < attribute.itemSize; c++)
            data[i * attribute.itemSize + c] = attribute.getComponent(i, c);
        geometry.setAttribute(name, new Float32BufferAttribute(data, attribute.itemSize));
      }
      flat.dispose();
      geometry.applyMatrix4(object.matrixWorld);
      geometries.push(geometry);
      material ??= (object.material as MeshStandardMaterial).clone();
    }
  });
  const merged = mergeGeometries(geometries, false);
  if (!merged || !material) throw new Error(`No mesh in ${id}`);
  const m = material as MeshStandardMaterial;
  m.transparent = false;
  m.depthWrite = true;
  m.side = DoubleSide;
  if (alpha) {
    m.alphaMap = alpha;
    m.alphaTest = 0.45;
  }

  return { geometry: merged, material: m };
}

function place(
  species: Species,
  name: string,
  points: { x: number; y: number; z: number; scale: number; yaw: number; tone: number }[],
  castShadow: boolean,
) {
  const mesh = new InstancedMesh(species.geometry, species.material, points.length);
  mesh.name = name;
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  points.forEach((p, i) => {
    q.setFromAxisAngle(up, p.yaw);
    m.compose(
      new Vector3(p.x, p.y, p.z),
      q,
      new Vector3(p.scale, p.scale * (0.9 + (p.tone - 1) * 1.5), p.scale),
    );
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new Color(p.tone, p.tone * (1 + (p.tone - 1) * 0.6), p.tone * 0.96));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.userData.visualFamily = `vegetation:${name}`;
  return mesh;
}

export async function buildVegetation(context: VegetationContext) {
  const { loader, ground } = context;
  const random = rng(context.seed ?? 311);
  const textures = new TextureLoader();
  const alpha = async (id: string) => {
    const texture = await textures.loadAsync(`/models/${id}_alpha_1k.png`);
    return texture;
  };
  // Scan sizes: tuft 0.10×0.16 m, tussock 0.36×0.41 m, shrub_02 2.3×2.0 m, fern 1.0×0.43 m.
  const tussockAlpha = await alpha("grass_medium_02");
  const [grass, tussock, shrub, fern] = await Promise.all([
    loadSpecies(loader, "grass_medium_02", tussockAlpha),
    loadSpecies(loader, "grass_medium_02", tussockAlpha),
    alpha("shrub_02").then((a) => loadSpecies(loader, "shrub_02", a)),
    alpha("fern_02").then((a) => loadSpecies(loader, "fern_02", a)),
  ]);
  addWind(grass.material, 0.9);
  addWind(tussock.material, 0.5);
  addWind(shrub.material, 0.04);
  addWind(fern.material, 0.25);

  const slope = (x: number, z: number) => {
    const e = 0.35;
    const dx = ground(x + e, z) - ground(x - e, z);
    const dz = ground(x, z + e) - ground(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  };
  const blocked = (x: number, z: number, margin = 0) => {
    for (const k of context.keepouts) if (Math.hypot(x - k.x, z - k.z) < k.r + margin) return true;
    for (const s of context.segments) {
      const [ax, az] = s.a;
      const [bx, bz] = s.b;
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      if (Math.hypot(x - ax - vx * t, z - az - vz * t) < s.r + margin) return true;
    }
    return false;
  };
  const scatter = (
    count: number,
    test: (x: number, y: number, z: number) => boolean,
    spread = 1,
  ) => {
    const out: { x: number; y: number; z: number; scale: number; yaw: number; tone: number }[] = [];
    let tries = 0;
    while (out.length < count && tries < count * 60) {
      tries++;
      const x = -26 + random() * 52;
      const z = -22 + random() * 40;
      const y = ground(x, z);
      if (!test(x, y, z)) continue;
      // Clumping: prefer spots near earlier ones so plants read as colonies, not a sprinkle.
      if (out.length > 4 && random() > 0.35) {
        const near = out[Math.floor(random() * out.length)];
        if (near && Math.hypot(near.x - x, near.z - z) > 5 * spread) continue;
      }
      out.push({
        x,
        y: y - 0.03,
        z,
        scale: 0.8 + random() * 0.5,
        yaw: random() * Math.PI * 2,
        tone: 0.86 + random() * 0.26,
      });
    }
    return out;
  };

  const group = new Group();
  group.name = "vegetation";
  // Turf clumps scaled to ~0.4–0.6 m so they read at the arrival distance; tussocks ~0.8 m.
  const turf = scatter(300, (x, y, z) => y > 3.3 && slope(x, z) < 0.35 && !blocked(x, z, 0.2));
  group.add(
    place(
      grass,
      "turf-grass",
      turf.map((p) => ({ ...p, scale: p.scale * 1.15 })),
      false,
    ),
  );
  const rims = scatter(
    34,
    (x, y, z) => y > 3.4 && slope(x, z) > 0.3 && slope(x, z) < 1.2 && !blocked(x, z, 0.4),
    2,
  );
  group.add(
    place(
      tussock,
      "tussocks",
      rims.map((p) => ({ ...p, scale: p.scale * 1.9 })),
      true,
    ),
  );
  // Scrub and canopies are card clusters carrying the shrub scan's own leaf texture: the
  // scan's geometry loses its leaf cards under simplification, and at full detail it costs
  // 27k triangles a bush. ~36 cards (72 triangles) per cluster, normals bent outward.
  const foliage = new MeshStandardMaterial({
    name: "foliage-cards",
    map: shrub.material.map,
    normalMap: null,
    alphaMap: shrub.material.alphaMap,
    alphaTest: 0.45,
    side: DoubleSide,
    color: new Color(0.78, 0.86, 0.66),
    roughness: 0.85,
    vertexColors: true,
  });
  addWind(foliage, 0.02);
  const scrub = scatter(18, (x, y, z) => y > 3.4 && slope(x, z) < 0.6 && !blocked(x, z, 1.8), 2.2);
  const clusters: BufferGeometry[] = [];
  for (const p of scrub)
    clusters.push(
      cardCluster(
        new Vector3(p.x, p.y + 0.45 * p.scale, p.z),
        new Vector3(1.1, 0.55, 1.1).multiplyScalar(p.scale),
        26,
        0.75 * p.scale,
        random,
        p.tone,
      ),
    );
  const ferns = scatter(
    10,
    (x, y, z) => y > 3.4 && slope(x, z) < 0.5 && !blocked(x, z, 0.9) && blocked(x, z, 3.4),
    1.2,
  );
  group.add(place(fern, "ferns", ferns, true));

  // Stone pines: tapered trunks leaning away from the prevailing sea wind, umbrella canopies.
  const barkMaterial = new MeshStandardMaterial({
    name: "bark",
    map: context.bark.colour,
    normalMap: context.bark.normal,
    roughnessMap: context.bark.arm,
    color: 0xeadfce,
    roughness: 1,
  });
  const pines: [number, number, number][] = [
    [-6.8, -3.4, 1.0],
    [0.8, -4.6, 0.85],
    [7.6, 1.2, 0.9],
    [-9.8, 1.4, 0.75],
  ];
  const trunks: BufferGeometry[] = [];
  const canopy: { x: number; y: number; z: number; scale: number; yaw: number; tone: number }[] =
    [];
  const lean = new Vector3(0.55, 0, -0.35).normalize();
  for (const [x, z, size] of pines) {
    const base = new Vector3(x, ground(x, z) - 0.1, z);
    const height = 4.6 * size;
    const points = [0, 0.3, 0.6, 0.85, 1].map((t) => {
      const bend = t * t * 1.4 * size;
      return base
        .clone()
        .add(
          new Vector3(
            lean.x * bend + Math.sin(t * 4 + x) * 0.12,
            t * height,
            lean.z * bend + Math.cos(t * 3 + z) * 0.1,
          ),
        );
    });
    trunks.push(taperedTube(points, 0.2 * size, 0.07 * size, 10));
    const top = points[points.length - 1] as Vector3;
    for (let b = 0; b < 5; b++) {
      const angle = (b / 5) * Math.PI * 2 + random();
      const start = (points[3] as Vector3).clone().lerp(top, random() * 0.6);
      const reach = (1.3 + random() * 0.9) * size;
      const end = start
        .clone()
        .add(
          new Vector3(
            Math.cos(angle) * reach + lean.x * 0.6,
            0.35 + random() * 0.5,
            Math.sin(angle) * reach + lean.z * 0.6,
          ),
        );
      const mid = start
        .clone()
        .lerp(end, 0.5)
        .add(new Vector3(0, 0.25, 0));
      trunks.push(taperedTube([start, mid, end], 0.07 * size, 0.025 * size, 7));
      canopy.push({
        x: end.x,
        y: end.y - 0.2 * size,
        z: end.z,
        scale: (0.85 + random() * 0.3) * size,
        yaw: random() * 6.3,
        tone: 0.9 + random() * 0.2,
      });
    }
    canopy.push({
      x: top.x,
      y: top.y - 0.1 * size,
      z: top.z,
      scale: 1.1 * size,
      yaw: random() * 6.3,
      tone: 1,
    });
  }
  const trunkGeometry = mergeGeometries(trunks, false);
  if (trunkGeometry) {
    const trunkMesh = new Mesh(trunkGeometry, barkMaterial);
    trunkMesh.castShadow = trunkMesh.receiveShadow = true;
    trunkMesh.userData.visualFamily = "vegetation:pine trunks";
    group.add(trunkMesh);
  }
  for (const c of canopy)
    clusters.push(
      cardCluster(
        new Vector3(c.x, c.y + 0.3, c.z),
        new Vector3(1.5, 0.55, 1.5).multiplyScalar(c.scale),
        40,
        0.95 * c.scale,
        random,
        c.tone * 0.82,
      ),
    );
  const foliageGeometry = mergeGeometries(clusters, false);
  if (foliageGeometry) {
    const foliageMesh = new Mesh(foliageGeometry, foliage);
    foliageMesh.castShadow = foliageMesh.receiveShadow = true;
    foliageMesh.userData.visualFamily = "vegetation:foliage cards (scrub and milkwood canopies)";
    group.add(foliageMesh);
  }
  const materials = new Set<Material>([
    grass.material,
    tussock.material,
    shrub.material,
    fern.material,
    barkMaterial,
    foliage,
  ]);
  return {
    group,
    counts: {
      turf: turf.length,
      tussocks: rims.length,
      scrub: scrub.length,
      ferns: ferns.length,
      pines: pines.length,
    },
    update(time: number, animated: boolean) {
      windUniforms.time.value = time;
      windUniforms.strength.value = animated ? 1 : 0;
    },
    dispose() {
      for (const material of materials) material.dispose();
      for (const species of [grass, tussock, shrub, fern]) species.geometry.dispose();
    },
  };
}

/**
 * A foliage cluster: 'count' alpha-tested cards scattered in an ellipsoid of 'radii', each
 * showing the leaf texture, with normals bent outward from the centre so the cluster shades
 * as one soft volume. Per-cluster tone goes into vertex colour.
 */
function cardCluster(
  centre: Vector3,
  radii: Vector3,
  count: number,
  size: number,
  random: () => number,
  tone: number,
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colours: number[] = [];
  const corner = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0, 1],
  ] as const;
  const order = [0, 1, 2, 0, 2, 3];
  for (let k = 0; k < count; k++) {
    // Rejection-sample a point in the unit ball, weighted toward the shell.
    let u = new Vector3();
    do u.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
    while (u.lengthSq() > 1);
    u = u.normalize().multiplyScalar(0.45 + 0.55 * Math.cbrt(random()));
    const p = new Vector3(u.x * radii.x, u.y * radii.y, u.z * radii.z).add(centre);
    const yaw = random() * Math.PI * 2;
    const tilt = (random() - 0.5) * 1.2;
    const right = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const up = new Vector3(0, Math.cos(tilt), 0).addScaledVector(
      new Vector3(-Math.sin(yaw), 0, Math.cos(yaw)),
      Math.sin(tilt),
    );
    const s = size * (0.7 + random() * 0.6);
    // Use a random quarter of the leaf atlas for variety.
    const ox = random() < 0.5 ? 0 : 0.5;
    const oy = random() < 0.5 ? 0 : 0.5;
    const outward = new Vector3().subVectors(p, centre).normalize();
    const shade = tone * (0.85 + 0.3 * (u.y * 0.5 + 0.5));
    for (const index of order) {
      const [cx, cy, tu, tv] = corner[index] as readonly [number, number, number, number];
      const v = p
        .clone()
        .addScaledVector(right, cx * s)
        .addScaledVector(up, cy * s);
      positions.push(v.x, v.y, v.z);
      const n = outward
        .clone()
        .multiplyScalar(0.75)
        .add(new Vector3(0, 0.25, 0))
        .normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(ox + tu * 0.5, oy + tv * 0.5);
      colours.push(shade, shade, shade * 0.95);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return geometry;
}

/** A tube whose radius tapers from r0 to r1 along a smooth curve through 'points'. */
function taperedTube(points: Vector3[], r0: number, r1: number, radial: number) {
  const curve = new CatmullRomCurve3(points);
  const steps = Math.max(6, points.length * 4);
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPointAt(t);
    const n = frames.normals[i] as Vector3;
    const b = frames.binormals[i] as Vector3;
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
      positions.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      normals.push(dir.x, dir.y, dir.z);
      uvs.push(j / radial, t * curve.getLength() * 0.8);
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // Counter-clockwise seen from outside, so the outward normals face the camera.
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

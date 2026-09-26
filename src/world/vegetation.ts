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
  type Object3D,
  Quaternion,
  ShaderChunk,
  SRGBColorSpace,
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

/** A scan's variants (each recentred on its own base) sharing one alpha-tested material. */
type Species = { variants: BufferGeometry[]; material: MeshStandardMaterial };
type Plant = { x: number; y: number; z: number; scale: number; yaw: number; tone: number };

const windUniforms = { time: { value: 0 }, strength: { value: 1 } };

function addWind(material: MeshStandardMaterial, stiffness: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windUniforms.time;
    shader.uniforms.windStrength = windUniforms.strength;
    // Thin cards: both faces shade with the authored normal (lifted toward up for grass, bent
    // outward for canopies). Three flips it on back faces, which turns half of every tuft
    // toward the ground and renders it in shadow.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      ShaderChunk.normal_fragment_begin.replace(
        "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;",
        "float faceDirection = 1.0;",
      ),
    );
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
  material.customProgramCacheKey = () => `odd-tide-foliage-${stiffness}`;
}

/**
 * Load a Poly Haven plant scan whose file lays several variants out side by side. Each variant
 * becomes its own geometry, recentred so its base sits at the origin.
 */
async function loadScan(loader: GLTFLoader, id: string) {
  const gltf = await loader.loadAsync(`/models/${id}.glb`);
  const parts: BufferGeometry[] = [];
  let material: MeshStandardMaterial | null = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
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
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const origin = new Vector3().setFromMatrixPosition(object.matrixWorld);
    geometry.translate(-origin.x, -(box?.min.y ?? 0), -origin.z);
    parts.push(geometry);
    material ??= (object.material as MeshStandardMaterial).clone();
  });
  if (!parts.length || !material) throw new Error(`No mesh in ${id}`);
  return { parts, material: material as MeshStandardMaterial };
}

/** Clone a scan into a species: cut-out material, wind stiffness and normals bent upward. */
function species(
  scan: Awaited<ReturnType<typeof loadScan>>,
  alpha: Texture,
  /** Blend blade normals toward up (0–1) so thin cards shade like the ground they grow from. */
  normalLift: number,
  stiffness: number,
): Species {
  const variants = scan.parts.map((part) => {
    const geometry = part.clone();
    const normal = geometry.getAttribute("normal");
    if (normal && normalLift > 0) {
      const n = new Vector3();
      for (let i = 0; i < normal.count; i++) {
        n.fromBufferAttribute(normal, i).multiplyScalar(1 - normalLift);
        n.y += normalLift;
        n.normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
    }
    return geometry;
  });
  const material = scan.material.clone();
  material.transparent = false;
  material.depthWrite = true;
  material.side = DoubleSide;
  material.alphaMap = alpha;
  material.alphaTest = 0.45;
  addWind(material, stiffness);
  return { variants, material };
}

/** Instance 'points' across the chosen variants: one InstancedMesh (draw call) per variant. */
function place(
  plant: Species,
  name: string,
  points: Plant[],
  castShadow: boolean,
  pick: number[] = plant.variants.map((_, i) => i),
) {
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  return pick.flatMap((variant, slot) => {
    const geometry = plant.variants[variant];
    const bucket = points.filter((_, i) => i % pick.length === slot);
    if (!geometry || !bucket.length) return [];
    const mesh = new InstancedMesh(geometry, plant.material, bucket.length);
    mesh.name = `${name}-${variant}`;
    bucket.forEach((p, i) => {
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
    return [mesh];
  });
}

export async function buildVegetation(context: VegetationContext) {
  const { loader, ground } = context;
  const random = rng(context.seed ?? 311);
  const textures = new TextureLoader();
  const alpha = async (id: string) => {
    const texture = await textures.loadAsync(`/models/${id}_alpha_1k.png`);
    // glTF UVs have their origin top-left; the scan's own maps load with flipY off, so the
    // separate cut-out mask must too or it lands mirrored over the wrong part of the atlas.
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  };
  // Scan variants: grass_medium_02 a–e are clumps 0.16–0.43 m tall; fern_02 a–d 0.6–1.0 m.
  const [grassScan, grassAlpha, fernScan, fernAlpha, leafColour, leafAlpha] = await Promise.all([
    loadScan(loader, "grass_medium_02"),
    alpha("grass_medium_02"),
    loadScan(loader, "fern_02"),
    alpha("fern_02"),
    textures.loadAsync("/textures/shrub_02/shrub_02_diff_1k.jpg"),
    textures.loadAsync("/textures/shrub_02/shrub_02_alpha_1k.png"),
  ]);
  leafColour.colorSpace = SRGBColorSpace;
  leafColour.anisotropy = leafAlpha.anisotropy = 4;
  // Turf tufts are built from cards below, so the turf species only needs the scan's material.
  const grass = species({ parts: [], material: grassScan.material }, grassAlpha, 0, 0.9);
  // The scan's blades are pale and partly dry; lifted normals light them like open turf, so
  // tint toward the art direction's olive or the tufts read as bleached straw.
  grass.material.color.setRGB(0.66, 0.74, 0.5);
  const tussock = species(grassScan, grassAlpha, 0.55, 0.5);
  const fern = species(fernScan, fernAlpha, 0.4, 0.25);

  const slope = (x: number, z: number) => {
    const e = 0.35;
    const dx = ground(x + e, z) - ground(x - e, z);
    const dz = ground(x, z + e) - ground(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  };
  const blocked = (x: number, z: number, margin = 0, keepScale = 1) => {
    for (const k of context.keepouts)
      if (Math.hypot(x - k.x, z - k.z) < k.r * keepScale + margin) return true;
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
    const out: Plant[] = [];
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
  /** Meadow patches: tufts crowd a patch centre and thin out with distance, like real turf. */
  const patches = (
    centres: Plant[],
    perPatch: number,
    radius: number,
    test: (x: number, y: number, z: number) => boolean,
  ) => {
    const out: Plant[] = [];
    for (const c of centres)
      for (let i = 0; i < perPatch; i++) {
        const r = radius * Math.sqrt(-2 * Math.log(1 - random() * 0.95)) * 0.5;
        const a = random() * Math.PI * 2;
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        const y = ground(x, z);
        if (!test(x, y, z)) continue;
        const falloff = 1 - Math.min(1, r / (radius * 1.4));
        out.push({
          x,
          y: y - 0.01,
          z,
          scale: (0.6 + random() * 0.45) * (0.7 + falloff * 0.5),
          yaw: random() * Math.PI * 2,
          tone: 0.86 + random() * 0.26,
        });
      }
    return out;
  };

  const group = new Group();
  group.name = "vegetation";
  // Alpha-tested cards stay out of the GTAO pre-pass: its override material cannot cut them
  // out, so each card would occlude as a full rectangle.
  const cutouts: Object3D[] = [];
  const add = (meshes: Mesh | Mesh[], cutout: boolean) => {
    for (const mesh of Array.isArray(meshes) ? meshes : [meshes]) {
      group.add(mesh);
      if (cutout) cutouts.push(mesh);
    }
  };
  // Turf: tufts of blade cards cut from the same scan's atlas (18 triangles a tuft against
  // ~1,000 for a scanned clump), five prototypes instanced over the turf, closer to buildings
  // than the larger plants. Rim tussocks use the scan's two tall variants at ~0.6–0.9 m.
  const turfable = (x: number, y: number, z: number) =>
    y > 3.3 && slope(x, z) < 0.45 && !blocked(x, z, 0.1, 0.62);
  const turf = [
    ...patches(scatter(80, turfable, 1.4), 26, 1.7, turfable),
    ...scatter(260, turfable, 1.2),
  ];
  const tufts = Array.from({ length: 5 }, () => grassTuft(random, 9, 0.42));
  add(
    place(
      { variants: tufts, material: grass.material },
      "turf-tufts",
      turf.map((p) => ({ ...p, y: p.y + 0.02 })),
      false,
    ),
    true,
  );
  const rims = scatter(
    34,
    (x, y, z) => y > 3.4 && slope(x, z) > 0.3 && slope(x, z) < 1.2 && !blocked(x, z, 0.4),
    2,
  );
  add(
    place(
      tussock,
      "tussocks",
      rims.map((p) => ({ ...p, scale: p.scale * 1.7 })),
      true,
      [3, 4],
    ),
    true,
  );
  // Scrub and canopies are card clusters carrying the shrub_02 scan's leaf texture (its
  // geometry costs 27k triangles a bush and loses its leaf cards under simplification):
  // 44-70 cards per cluster, normals bent outward.
  const foliage = new MeshStandardMaterial({
    name: "foliage-cards",
    map: leafColour,
    alphaMap: leafAlpha,
    alphaTest: 0.45,
    side: DoubleSide,
    color: new Color(0.86, 0.98, 0.64),
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
        new Vector3(1.0, 0.5, 1.0).multiplyScalar(p.scale),
        44,
        0.5 * p.scale,
        random,
        p.tone,
      ),
    );
  const ferns = scatter(
    16,
    (x, y, z) => y > 3.4 && slope(x, z) < 0.5 && !blocked(x, z, 0.9) && blocked(x, z, 3.4),
    1.2,
  );
  add(place(fern, "ferns", ferns, true), true);

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
  const canopy: Plant[] = [];
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
    add(trunkMesh, false);
  }
  for (const c of canopy)
    clusters.push(
      cardCluster(
        new Vector3(c.x, c.y + 0.3, c.z),
        new Vector3(1.4, 0.5, 1.4).multiplyScalar(c.scale),
        70,
        0.55 * c.scale,
        random,
        c.tone * 0.86,
      ),
    );
  const foliageGeometry = mergeGeometries(clusters, false);
  if (foliageGeometry) {
    const foliageMesh = new Mesh(foliageGeometry, foliage);
    foliageMesh.castShadow = foliageMesh.receiveShadow = true;
    foliageMesh.userData.visualFamily = "vegetation:foliage cards (scrub and milkwood canopies)";
    add(foliageMesh, true);
  }
  const materials = new Set<Material>([
    grass.material,
    tussock.material,
    fern.material,
    barkMaterial,
    foliage,
  ]);
  return {
    group,
    cutouts,
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
      for (const plant of [grass, tussock, fern])
        for (const geometry of plant.variants) geometry.dispose();
      for (const tuft of tufts) tuft.dispose();
      for (const part of [...grassScan.parts, ...fernScan.parts]) part.dispose();
      for (const texture of [grassAlpha, fernAlpha, leafColour, leafAlpha]) texture.dispose();
    },
  };
}

/**
 * Single blades in grass_medium_02's atlas, measured by connected components of its alpha:
 * [u0, u1, vTip, vBase, uBase] in glTF UV space (v runs down), uBase where the blade's foot is.
 */
const BLADES = [
  [0.028, 0.176, 0.012, 0.966, 0.047],
  [0.145, 0.285, 0.16, 0.974, 0.243],
  [0.355, 0.41, 0.226, 0.728, 0.369],
  [0.447, 0.615, 0.053, 0.765, 0.468],
  [0.666, 0.83, 0.166, 0.896, 0.687],
  [0.791, 0.853, 0.256, 0.62, 0.805],
  [0.853, 0.983, 0.019, 0.999, 0.952],
] as const;

/**
 * A grass tuft: 'blades' cards, each carrying one scanned blade at its true aspect, fanned
 * out from a shared foot at the local origin. Normals are lifted toward up so the tuft shades
 * like the turf it grows from. 'size' is the height of a full-length blade in metres.
 */
function grassTuft(random: () => number, blades: number, size: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (let k = 0; k < blades; k++) {
    const [u0, u1, vTip, vBase, uBase] = BLADES[Math.floor(random() * BLADES.length)] ?? BLADES[0];
    const metres = size * (0.65 + random() * 0.5);
    const height = (vBase - vTip) * metres;
    const yaw = random() * Math.PI * 2;
    const lean = 0.1 + random() * 0.45;
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const out = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const up = new Vector3(0, Math.cos(lean), 0).addScaledVector(out, Math.sin(lean));
    const foot = new Vector3((random() - 0.5) * 0.07, 0, (random() - 0.5) * 0.07);
    const normal = out
      .clone()
      .multiplyScalar(0.35)
      .add(new Vector3(0, 1, 0))
      .normalize();
    const x0 = (u0 - uBase) * metres;
    const x1 = (u1 - uBase) * metres;
    const corners: [number, number, number, number][] = [
      [x0, 0, u0, vBase],
      [x1, 0, u1, vBase],
      [x1, height, u1, vTip],
      [x0, height, u0, vTip],
    ];
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const [x, h, u, v] = corners[index] as [number, number, number, number];
      const p = foot.clone().addScaledVector(right, x).addScaledVector(up, h);
      positions.push(p.x, p.y, p.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, v);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return geometry;
}

/** U range of shrub_02's atlas that holds leaves (the left fifth is bark). */
const LEAF_REGION: [number, number] = [0.22, 1];
const LEAF_ASPECT = LEAF_REGION[1] - LEAF_REGION[0];

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
    // Roll each card in its own plane so the scan's upright leaves point every which way.
    const roll = (random() - 0.5) * Math.PI;
    const rolledRight = right
      .clone()
      .multiplyScalar(Math.cos(roll))
      .addScaledVector(up, Math.sin(roll));
    const rolledUp = up
      .clone()
      .multiplyScalar(Math.cos(roll))
      .addScaledVector(right, -Math.sin(roll));
    const s = size * (0.7 + random() * 0.6);
    // The scan's atlas holds bark in its left fifth and nine leaves elsewhere: every card
    // shows only the leaf region (a spray of leaves), mirrored at random for variety.
    const mirror = random() < 0.5;
    const outward = new Vector3().subVectors(p, centre).normalize();
    const shade = tone * (0.85 + 0.3 * (u.y * 0.5 + 0.5));
    for (const index of order) {
      const [cx, cy, tu, tv] = corner[index] as readonly [number, number, number, number];
      const v = p
        .clone()
        .addScaledVector(rolledRight, cx * s * LEAF_ASPECT)
        .addScaledVector(rolledUp, cy * s);
      positions.push(v.x, v.y, v.z);
      const n = outward
        .clone()
        .multiplyScalar(0.75)
        .add(new Vector3(0, 0.25, 0))
        .normalize();
      normals.push(n.x, n.y, n.z);
      const lu = mirror ? 1 - tu : tu;
      uvs.push(LEAF_REGION[0] + lu * (LEAF_REGION[1] - LEAF_REGION[0]), 0.02 + tv * 0.96);
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

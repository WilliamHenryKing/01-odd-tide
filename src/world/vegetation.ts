import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CustomBlending,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  type Object3D,
  OneFactor,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  ShaderChunk,
  SRGBColorSpace,
  SrcColorFactor,
  type Texture,
  TextureLoader,
  Vector3,
  ZeroFactor,
} from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "./build/kit";
import type { PbrSet } from "./textures";

// Coastal planting from CC0 scans (Poly Haven): turf grass, tussocks, scrub and ferns, instanced
// with per-instance variation, plus a few wind-shaped trees whose procedural trunks carry card
// clusters as canopies. Foliage is alpha-tested with alpha-to-coverage (never blended), shades
// as a volume with light transmitted through leaves lit from behind, sits on darkened ground,
// and sways from a shared uniform that freezes with reduced motion.

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

type FoliageOptions = {
  /** Wind bend per metre² of height above the plant's own origin (instanced plants). */
  stiffness?: number;
  /** Sway from a per-vertex [amplitude m, phase] attribute (merged world-space clusters). */
  swayAttribute?: boolean;
  /** Dissolve instanced plants between these camera distances (metres), then drop them. */
  fade?: [number, number];
  /** Share of the key light passed through leaves lit from behind (0–1). */
  translucency?: number;
};

/**
 * Foliage shading on three's standard material. Both faces of a card shade with its authored
 * normal (three flips normals on back faces, which turned half of every tuft toward the ground
 * and into shadow). The cut-out uses alpha-to-coverage on the 4× MSAA target, with alpha raised
 * by mip level so distant cards keep their coverage instead of thinning to nothing.
 */
function prepareFoliage(material: MeshStandardMaterial, options: FoliageOptions) {
  material.alphaToCoverage = true;
  const defines: Record<string, string> = {};
  if (options.swayAttribute) defines.FOLIAGE_SWAY = "";
  if (options.fade) {
    defines.FOLIAGE_FADE = "";
    defines.FADE_NEAR = options.fade[0].toFixed(2);
    defines.FADE_FAR = options.fade[1].toFixed(2);
  }
  if (options.translucency) defines.FOLIAGE_TRANSLUCENCY = options.translucency.toFixed(3);
  defines.FOLIAGE_STIFFNESS = (options.stiffness ?? 0).toFixed(3);
  material.defines = { ...material.defines, ...defines };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windUniforms.time;
    shader.uniforms.windStrength = windUniforms.strength;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float windTime;
        uniform float windStrength;
        #ifdef FOLIAGE_SWAY
          attribute vec2 sway;
        #endif
        #ifdef FOLIAGE_FADE
          varying float vPlantFade;
        #endif`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 plantBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float windPhase = plantBase.x * 0.37 + plantBase.z * 0.29;
        #else
          float windPhase = 0.0;
        #endif
        #ifdef FOLIAGE_SWAY
          float windBend = sway.x;
          windPhase = sway.y;
        #else
          float windBend = max(position.y, 0.0);
          windBend *= windBend * FOLIAGE_STIFFNESS;
        #endif
        float gust = sin(windTime * 1.3 + windPhase) * 0.6 + sin(windTime * 2.7 + windPhase * 1.7) * 0.25;
        transformed.x += (0.2 + gust) * windBend * windStrength;
        transformed.z += (0.1 + gust * 0.5) * windBend * windStrength * 0.6;
        #ifdef FOLIAGE_FADE
          #ifdef USE_INSTANCING
            vPlantFade = 1.0 - smoothstep(FADE_NEAR, FADE_FAR, distance(plantBase, cameraPosition));
          #else
            vPlantFade = 1.0;
          #endif
          // Fully faded plants collapse to a point and cost no fragments.
          transformed *= step(0.001, vPlantFade);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        #ifdef FOLIAGE_FADE
          varying float vPlantFade;
        #endif`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
        #ifdef FOLIAGE_FADE
          // Coverage fade: with alpha-to-coverage the MSAA samples thin out smoothly.
          diffuseColor.a *= vPlantFade;
          if (diffuseColor.a <= 0.0) discard;
        #endif`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        ShaderChunk.normal_fragment_begin.replace(
          "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;",
          "float faceDirection = 1.0;",
        ),
      )
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
        #ifdef USE_ALPHAMAP
          // Mip-aware coverage (after Ben Golus): mips average the mask toward grey, so scale
          // alpha back up with the mip level the card is sampled at.
          vec2 alphaTexel = vAlphaMapUv * 1024.0;
          vec2 alphaDx = dFdx(alphaTexel);
          vec2 alphaDy = dFdy(alphaTexel);
          float alphaMip = max(0.0, 0.5 * log2(max(dot(alphaDx, alphaDx), dot(alphaDy, alphaDy))));
          diffuseColor.a *= 1.0 + alphaMip * 0.25;
        #endif`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        #if defined( FOLIAGE_TRANSLUCENCY ) && NUM_DIR_LIGHTS > 0
        {
          // Leaves lit from behind pass some of the key light through, tinted by the leaf.
          float keyShadow = 1.0;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            DirectionalLightShadow keyShadowInfo = directionalLightShadows[ 0 ];
            keyShadow = receiveShadow ? getShadow( directionalShadowMap[ 0 ], keyShadowInfo.shadowMapSize, keyShadowInfo.shadowIntensity, keyShadowInfo.shadowBias, keyShadowInfo.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
          #endif
          float behind = saturate(dot(-normal, directionalLights[ 0 ].direction));
          reflectedLight.directDiffuse += directionalLights[ 0 ].color * keyShadow * behind * diffuseColor.rgb * (FOLIAGE_TRANSLUCENCY * RECIPROCAL_PI);
        }
        #endif`,
      );
  };
  material.customProgramCacheKey = () =>
    `odd-tide-foliage-${Object.entries(defines)
      .map(([k, v]) => `${k}=${v}`)
      .join(",")}`;
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

/** Clone a scan into a species: cut-out material, foliage shading and normals bent upward. */
function species(
  scan: Awaited<ReturnType<typeof loadScan>>,
  alpha: Texture,
  /** Blend blade normals toward up (0–1) so thin cards shade like the ground they grow from. */
  normalLift: number,
  foliage: FoliageOptions,
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
  prepareFoliage(material, foliage);
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
  // Tufts dissolve into the turf texture between 14 and 26 m, where single blades would only
  // alias into one-pixel stubble.
  const grass = species({ parts: [], material: grassScan.material }, grassAlpha, 0, {
    stiffness: 0.9,
    fade: [14, 26],
  });
  // The scanned blades are lit flat and read far paler than living grass: bring their albedo
  // down to the turf's olive so they read as its blades, not as straw laid on it.
  grass.material.color.setRGB(0.44, 0.5, 0.3);
  const tussock = species(grassScan, grassAlpha, 0.55, { stiffness: 0.5 });
  const fern = species(fernScan, fernAlpha, 0.4, { stiffness: 0.25, translucency: 0.5 });
  // The fern scan is a saturated spring green; pull it toward the island's olive.
  fern.material.color.setRGB(0.92, 0.8, 0.86);

  const slope = (x: number, z: number) => {
    const e = 0.35;
    const dx = ground(x + e, z) - ground(x - e, z);
    const dz = ground(x, z + e) - ground(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  };
  /** True when the ground within 'r' metres stays within 'drop' of the centre (no lip). */
  const flatAround = (x: number, z: number, r: number, drop: number) => {
    const y = ground(x, z);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (Math.abs(ground(x + Math.cos(a) * r, z + Math.sin(a) * r) - y) > drop) return false;
    }
    return true;
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
  // Alpha-tested cards and ground decals stay out of the GTAO pre-pass: its override material
  // cannot cut them out, so each would occlude as a full rectangle.
  const cutouts: Object3D[] = [];
  const add = (meshes: Mesh | Mesh[], cutout: boolean) => {
    for (const mesh of Array.isArray(meshes) ? meshes : [meshes]) {
      group.add(mesh);
      if (cutout) cutouts.push(mesh);
    }
  };
  /** Contact darkening under plants: [x, z, radius] with the strength of its decal family. */
  const shade = {
    strong: [] as [number, number, number][],
    soft: [] as [number, number, number][],
  };

  // Turf: tufts of blade cards cut from the same scan's atlas (18 triangles a tuft against
  // ~1,000 for a scanned clump), five prototypes instanced over the turf in overlapping meadow
  // patches plus an even scatter, closer to buildings than the larger plants.
  const turfable = (x: number, y: number, z: number) =>
    y > 3.3 && slope(x, z) < 0.45 && !blocked(x, z, 0.1, 0.62);
  const turf = [
    ...patches(scatter(110, turfable, 1.4), 24, 2.1, turfable),
    ...scatter(700, turfable, 3),
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
  // Rim tussocks: the scan's two tall variants at ~0.6–0.9 m on the turf's shoulders.
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
  for (const p of rims) shade.soft.push([p.x, p.z, 0.42 * p.scale * 1.7]);

  // Scrub and canopies are card clusters carrying the shrub_02 scan's leaf texture (its
  // geometry costs 27k triangles a bush and loses its leaf cards under simplification).
  const foliage = new MeshStandardMaterial({
    name: "foliage-cards",
    map: leafColour,
    alphaMap: leafAlpha,
    alphaTest: 0.45,
    side: DoubleSide,
    // Scanned under flat light, the leaves read pale; living foliage albedo is ~0.1–0.2.
    color: new Color(0.6, 0.68, 0.44),
    roughness: 0.85,
    vertexColors: true,
  });
  prepareFoliage(foliage, { swayAttribute: true, translucency: 0.6 });
  // Scrub: low mounds of small leaves on woody stems, on level turf only (never on a lip).
  const scrub = scatter(
    18,
    (x, y, z) =>
      y > 3.4 && slope(x, z) < 0.35 && !blocked(x, z, 1.8) && flatAround(x, z, 1.3, 0.35),
    2.2,
  );
  const clusters: BufferGeometry[] = [];
  const stems: BufferGeometry[] = [];
  for (const p of scrub) {
    const centre = new Vector3(p.x, p.y + 0.5 * p.scale, p.z);
    clusters.push(
      cardCluster(
        centre,
        new Vector3(0.95, 0.55, 0.95).multiplyScalar(p.scale),
        72,
        0.3 * p.scale,
        random,
        p.tone * 0.8,
      ),
    );
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + random();
      const foot = new Vector3(
        p.x + Math.cos(a) * 0.08,
        ground(p.x, p.z) - 0.05,
        p.z + Math.sin(a) * 0.08,
      );
      const tip = centre
        .clone()
        .add(
          new Vector3(Math.cos(a) * 0.45 * p.scale, 0.1 * p.scale, Math.sin(a) * 0.45 * p.scale),
        );
      const mid = foot
        .clone()
        .lerp(tip, 0.5)
        .add(new Vector3(0, 0.08, 0));
      stems.push(taperedTube([foot, mid, tip], 0.035 * p.scale, 0.012 * p.scale, 5));
    }
    shade.strong.push([p.x, p.z, 1.15 * p.scale]);
  }
  const ferns = scatter(
    16,
    (x, y, z) =>
      y > 3.4 &&
      slope(x, z) < 0.5 &&
      !blocked(x, z, 0.9) &&
      blocked(x, z, 3.4) &&
      flatAround(x, z, 0.6, 0.3),
    1.2,
  );
  add(place(fern, "ferns", ferns, true), true);
  for (const p of ferns) shade.soft.push([p.x, p.z, 0.55 * p.scale]);

  // Wind-shaped trees: flared, tapered trunks leaning away from the prevailing sea wind, with
  // branches that keep their canopies clear of the buildings.
  const barkMaterial = new MeshStandardMaterial({
    name: "bark",
    map: context.bark.colour,
    normalMap: context.bark.normal,
    roughnessMap: context.bark.arm,
    color: 0xeadfce,
    roughness: 1,
  });
  const pines: [number, number, number][] = [
    [-8.2, -4.6, 1.0],
    [0.8, -4.6, 0.85],
    [7.6, 1.2, 0.9],
    [-9.8, 1.4, 0.75],
  ];
  /** Distance a canopy centre must keep from a keep-out's edge, in metres. */
  const canopyClear = (x: number, z: number, margin: number) =>
    context.keepouts.every((k) => Math.hypot(x - k.x, z - k.z) >= k.r + margin);
  const trunks: BufferGeometry[] = [...stems];
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
    trunks.push(taperedTube(points, 0.2 * size, 0.07 * size, 10, 0.75));
    shade.strong.push([x, z, 1.5 * size]);
    const top = points[points.length - 1] as Vector3;
    for (let b = 0; b < 5; b++) {
      let angle = (b / 5) * Math.PI * 2 + random();
      const start = (points[3] as Vector3).clone().lerp(top, random() * 0.6);
      let reach = (1.3 + random() * 0.9) * size;
      const endAt = () =>
        start
          .clone()
          .add(
            new Vector3(
              Math.cos(angle) * reach + lean.x * 0.6,
              0.35 + random() * 0.5,
              Math.sin(angle) * reach + lean.z * 0.6,
            ),
          );
      let end = endAt();
      // A branch whose canopy would reach over a building turns away from it, then shortens.
      if (!canopyClear(end.x, end.z, 1.4 * size)) {
        angle += Math.PI;
        end = endAt();
      }
      for (let tries = 0; tries < 3 && !canopyClear(end.x, end.z, 1.4 * size); tries++) {
        reach *= 0.6;
        end = endAt();
      }
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
    trunkMesh.userData.visualFamily = "vegetation:tree trunks and scrub stems";
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
    foliageMesh.userData.visualFamily = "vegetation:foliage cards (scrub and tree canopies)";
    add(foliageMesh, true);
  }

  // Contact darkening where plants meet the turf (the cut-outs get no ambient occlusion).
  const decals = [
    contactShade("strong", shade.strong, 0.55, ground),
    contactShade("soft", shade.soft, 0.4, ground),
  ];
  for (const decal of decals) add(decal.mesh, true);

  const materials = new Set<Material>([
    grass.material,
    tussock.material,
    fern.material,
    barkMaterial,
    foliage,
    ...decals.map((d) => d.mesh.material as Material),
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
      for (const decal of decals) {
        decal.mesh.geometry.dispose();
        decal.texture.dispose();
      }
      for (const texture of [grassAlpha, fernAlpha, leafColour, leafAlpha]) texture.dispose();
    },
  };
}

/**
 * Instanced ground decals that multiply the turf toward 1 − strength at their centre, fading
 * to nothing at the rim, each tilted to the local ground slope.
 */
function contactShade(
  name: string,
  spots: [number, number, number][],
  strength: number,
  ground: (x: number, z: number) => number,
) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const falloff = Math.max(0, 1 - r) ** 1.6;
      const value = Math.round(255 * (1 - strength * falloff));
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  const material = new MeshBasicMaterial({
    name: `contact-shade-${name}`,
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  // dst × src: a pure darkening, independent of exposure and of the light that reaches it.
  material.blending = CustomBlending;
  material.blendSrc = ZeroFactor;
  material.blendDst = SrcColorFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  const geometry = new PlaneGeometry(2, 2);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new InstancedMesh(geometry, material, Math.max(1, spots.length));
  mesh.count = spots.length;
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const normal = new Vector3();
  spots.forEach(([x, z, radius], i) => {
    const e = 0.3;
    normal
      .set(ground(x - e, z) - ground(x + e, z), 2 * e, ground(x, z - e) - ground(x, z + e))
      .normalize();
    q.setFromUnitVectors(up, normal);
    m.compose(new Vector3(x, ground(x, z) + 0.02, z), q, new Vector3(radius, 1, radius));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.renderOrder = 1;
  mesh.userData.visualFamily = `vegetation:contact shade (${name})`;
  return { mesh, texture };
}

/**
 * Single blades in grass_medium_02's atlas, measured by connected components of its alpha:
 * [u0, u1, vTip, vBase, uBase] in glTF UV space (v runs down), uBase where the blade's foot is.
 * Blades 3 and 5 are dry straw; the rest are green.
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
const GREEN_BLADES = [0, 1, 2, 4, 6];
const DRY_BLADES = [3, 5];

/**
 * A grass tuft: 'blades' cards, each carrying one scanned blade at its true aspect, fanned
 * out from a shared foot at the local origin, about one blade in eight dry. Normals are lifted
 * toward up so the tuft shades like the turf it grows from. 'size' is the height of a
 * full-length blade in metres.
 */
function grassTuft(random: () => number, blades: number, size: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (let k = 0; k < blades; k++) {
    const family = random() < 0.12 ? DRY_BLADES : GREEN_BLADES;
    const index = family[Math.floor(random() * family.length)] ?? 0;
    const [u0, u1, vTip, vBase, uBase] = BLADES[index] ?? BLADES[0];
    const metres = size * (0.65 + random() * 0.5);
    const height = (vBase - vTip) * metres;
    const yaw = random() * Math.PI * 2;
    const lean = 0.1 + random() * 0.45;
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const out = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const up = new Vector3(0, Math.cos(lean), 0).addScaledVector(out, Math.sin(lean));
    const foot = new Vector3((random() - 0.5) * 0.07, 0, (random() - 0.5) * 0.07);
    // Nearly the turf's own normal: sideways normals made low sun light the blades ten times
    // brighter than the ground they stand in.
    const normal = out
      .clone()
      .multiplyScalar(0.15)
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
    for (const corner of [0, 1, 2, 0, 2, 3]) {
      const [x, h, u, v] = corners[corner] as [number, number, number, number];
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
 * as one soft volume. Per-cluster tone goes into vertex colour; a 'sway' attribute carries
 * each vertex's wind amplitude (more at the cluster's top) and the cluster's wind phase.
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
  const sways: number[] = [];
  const phase = centre.x * 0.37 + centre.z * 0.29;
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
    const amplitude = 0.03 + 0.05 * (u.y * 0.5 + 0.5);
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
      sways.push(amplitude, phase);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.setAttribute("sway", new Float32BufferAttribute(sways, 2));
  return geometry;
}

/**
 * A tube whose radius tapers from r0 to r1 along a smooth curve through 'points'; 'flare'
 * widens the first ~30 cm into a root flare (0 = none).
 */
function taperedTube(points: Vector3[], r0: number, r1: number, radial: number, flare = 0) {
  const curve = new CatmullRomCurve3(points);
  const steps = Math.max(6, points.length * 4) + (flare > 0 ? 4 : 0);
  const length = curve.getLength();
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // With a flare, sample more densely near the base, where the radius changes fastest.
    const t = flare > 0 ? (i / steps) ** 1.6 : i / steps;
    const p = curve.getPointAt(t);
    const frame = Math.min(steps, Math.round(t * steps));
    const n = frames.normals[frame] as Vector3;
    const b = frames.binormals[frame] as Vector3;
    const r = (r0 + (r1 - r0) * t) * (1 + flare * Math.exp((-t * length) / 0.3));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
      positions.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      normals.push(dir.x, dir.y, dir.z);
      uvs.push(j / radial, t * length * 0.8);
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

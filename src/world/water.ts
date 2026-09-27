import {
  BufferGeometry,
  Color,
  CustomBlending,
  DataTexture,
  DataUtils,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RedFormat,
  Vector3,
} from "three";
import { FAR_SEABED } from "./layout";
import { createOceanNormals } from "./render/ocean-normals";

// The sea: one physical surface at the domain tide level, carrying a Gerstner swell on a radial
// grid and wind ripples from an FFT slope map. Reflections, sun glints and shadows come from
// the shared rig; the seabed seen through it is absorbed in the terrain shader, and this
// surface adds only what the water itself contributes (Fresnel reflection, in-scattered light,
// light through crests, foam). Blending: result = water + background × (1 − Fresnel).

export type Heightmap = {
  texture: DataTexture;
  size: number;
  min: [number, number];
  max: [number, number];
  heights: Float32Array;
  /** Rock/sand surface height at a world x/z (nearest texel; for placement). */
  sample(x: number, z: number): number;
};

export async function loadHeightmap(): Promise<Heightmap> {
  const [meta, buffer] = await Promise.all([
    fetch("/models/island-height.json").then(
      (r) => r.json() as Promise<{ size: number; min: [number, number]; max: [number, number] }>,
    ),
    fetch("/models/island-height.bin").then((r) => r.arrayBuffer()),
  ]);
  const heights = new Float32Array(buffer);
  const half = new Uint16Array(heights.length);
  for (let i = 0; i < heights.length; i++) half[i] = DataUtils.toHalfFloat(heights[i] ?? -7);
  const texture = new DataTexture(half, meta.size, meta.size, RedFormat, HalfFloatType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  texture.name = "island-height";
  const sample = (x: number, z: number) => {
    const u = (x - meta.min[0]) / (meta.max[0] - meta.min[0]);
    const v = (z - meta.min[1]) / (meta.max[1] - meta.min[1]);
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return FAR_SEABED;
    const col = Math.min(meta.size - 1, Math.floor(u * meta.size));
    const row = Math.min(meta.size - 1, Math.floor(v * meta.size));
    return heights[row * meta.size + col] ?? -7;
  };
  return { texture, size: meta.size, min: meta.min, max: meta.max, heights, sample };
}

/** A uniform seabed, for scenes without a baked coast (legacy geometry, look-dev). */
export function flatHeightmap(height: number): Heightmap {
  const size = 4;
  const heights = new Float32Array(size * size).fill(height);
  const half = new Uint16Array(size * size).fill(DataUtils.toHalfFloat(height));
  const texture = new DataTexture(half, size, size, RedFormat, HalfFloatType);
  texture.needsUpdate = true;
  return { texture, size, min: [-1e5, -1e5], max: [1e5, 1e5], heights, sample: () => height };
}

export type WaterUniforms = { time: { value: number }; level: { value: number } };

export type SeaSun = { direction: { value: Vector3 }; irradiance: { value: Color } };

/** Swell components (Gerstner): wavelength m, direction rad (toward), amplitude m. */
const SWELL: [number, number, number][] = [
  [21, 0.45, 0.1],
  [14.7, 0.62, 0.07],
  [10.3, 0.3, 0.05],
  [7.2, 0.85, 0.035],
  [5.0, 0.15, 0.025],
  [3.5, 1.05, 0.018],
];
const SWELL_GLSL = `
const int SWELL_COUNT = ${SWELL.length};
const vec3 SWELL[SWELL_COUNT] = vec3[](${SWELL.map(([l, d, a]) => `vec3(${l.toFixed(2)}, ${d.toFixed(3)}, ${a.toFixed(3)})`).join(", ")});
`;

/**
 * A radial grid centred on the island: 0.4 m rings near the centre growing geometrically to
 * 19 km (inside the 20 km sky dome), so the swell is resolved where the cameras look and the
 * far sea stays cheap. The last rings rise by up to 60 m (at most 0.2° of view): a flat sea
 * ending short of the horizon left a sliver of the sky dome's own lower hemisphere as a line.
 */
function seaGeometry() {
  const radial = 256;
  const rings = 191;
  const positions: number[] = [0, 0, 0];
  for (let i = 1; i <= rings; i++) {
    const r = 0.4 * (1.058 ** i - 1);
    const t = Math.min(1, Math.max(0, (r - 6000) / 13000));
    const lift = 60 * t * t * (3 - 2 * t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * r, lift, Math.sin(a) * r);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < radial; j++) indices.push(0, 1 + ((j + 1) % radial), 1 + j);
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < radial; j++) {
      const a = 1 + i * radial + j;
      const b = 1 + i * radial + ((j + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      indices.push(a, b, d, a, d, c);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    "normal",
    new Float32BufferAttribute(
      Array.from({ length: positions.length / 3 }, () => [0, 1, 0]).flat(),
      3,
    ),
  );
  geometry.setIndex(indices);
  return geometry;
}

export function createWater(heightmap: Heightmap, shared: WaterUniforms, sun?: SeaSun) {
  const slopes = createOceanNormals();
  const material = new MeshPhysicalMaterial({
    name: "sea",
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0,
    ior: 1.333,
    specularIntensity: 1,
    transparent: true,
    depthWrite: false,
  });
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.premultipliedAlpha = false;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      seaTime: shared.time,
      seaLevel: shared.level,
      heightTex: { value: heightmap.texture },
      heightMin: { value: heightmap.min },
      heightMax: { value: heightmap.max },
      seaSunDirection: sun?.direction ?? { value: new Vector3(0, 1, 0) },
      seaSunIrradiance: sun?.irradiance ?? { value: new Color(0, 0, 0) },
      oceanSlopes: { value: slopes.texture },
      oceanSlopeRms: { value: slopes.rms },
    });
    const common = `
      uniform float seaTime;
      uniform float seaLevel;
      uniform sampler2D heightTex;
      uniform vec2 heightMin;
      uniform vec2 heightMax;
      ${SWELL_GLSL}
      float seaGround(vec2 xz) {
        vec2 uv = (xz - heightMin) / (heightMax - heightMin);
        return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? ${FAR_SEABED.toFixed(2)} : texture2D(heightTex, uv).r;
      }`;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${common}
        varying vec3 vSeaWorld;
        varying float vSeaSwell;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          // Gerstner swell, shrinking as it runs into the shallows so it never climbs the rocks.
          vec2 p = (modelMatrix * vec4(position, 1.0)).xz;
          float depth = max(seaLevel - seaGround(p), 0.0);
          float shoal = smoothstep(0.25, 3.0, depth);
          // Out where the rings are wider than the swell, displacement would alias into spokes.
          shoal *= 1.0 - smoothstep(80.0, 220.0, length(p));
          vec3 offset = vec3(0.0);
          for (int i = 0; i < SWELL_COUNT; i++) {
            vec3 w = SWELL[i];
            float k = 6.2831853 / w.x;
            vec2 dir = vec2(cos(w.y), sin(w.y));
            float omega = sqrt(9.81 * k);
            float phase = k * dot(dir, p) - omega * seaTime + float(i) * 2.39;
            float a = w.z * shoal;
            offset.xz += dir * (0.45 * a * cos(phase));
            offset.y += a * sin(phase);
          }
          // The sea mesh is authored flat in world orientation and only translated.
          transformed += offset;
          vSeaSwell = offset.y;
        }`,
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${common}
        varying vec3 vSeaWorld;
        varying float vSeaSwell;
        uniform vec3 seaSunDirection;
        uniform vec3 seaSunIrradiance;
        uniform sampler2D oceanSlopes;
        uniform float oceanSlopeRms;
        float sHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float sNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + 1.0), f.x), f.y);
        }
        // One scrolled, rotated layer of the FFT slope map. Returns the world-space slope in xy
        // and its hidden variance (from the mip-averaged squared slopes) in z.
        vec3 oceanLayer(vec2 p, float scale, float angle, vec2 drift, float targetRms, float footprint) {
          float c = cos(angle), s = sin(angle);
          vec2 q = mat2(c, s, -s, c) * p / scale + drift * seaTime;
          vec4 t = texture2D(oceanSlopes, q);
          vec2 mean = t.rg * 2.0 - 1.0;
          // Past ~1/12 of the tile per pixel even anisotropic filtering leaves grazing streaks:
          // the layer fades out there and only its hidden variance remains.
          float keep = 1.0 - smoothstep(scale / 24.0, scale / 8.0, footprint);
          float variance = max(t.b + t.a - dot(mean, mean) * keep * keep, 0.0);
          vec2 slope = mat2(c, -s, s, c) * mean * keep;
          float k = targetRms / oceanSlopeRms;
          return vec3(slope * k, variance * k * k);
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `float ground = seaGround(vSeaWorld.xz);
        float seaDepth = max(seaLevel - ground, 0.0);
        float footprint = length(fwidth(vSeaWorld.xz));
        float shoal = smoothstep(0.25, 3.0, seaDepth);
        // Swell slope, resolved per pixel; waves shorter than ~4 pixels fade and hand their
        // slope energy to roughness instead of aliasing into stripes.
        vec2 slope = vec2(0.0);
        float hidden = 0.0;
        for (int i = 0; i < SWELL_COUNT; i++) {
          vec3 w = SWELL[i];
          float k = 6.2831853 / w.x;
          vec2 dir = vec2(cos(w.y), sin(w.y));
          float omega = sqrt(9.81 * k);
          float phase = k * dot(dir, vSeaWorld.xz) - omega * seaTime + float(i) * 2.39;
          float a = w.z * shoal;
          float keep = smoothstep(2.5 * footprint, 6.0 * footprint, w.x);
          slope += dir * (a * k * cos(phase)) * keep;
          hidden += 0.5 * (a * k) * (a * k) * (1.0 - keep);
        }
        // Wind ripples: two FFT layers at different scales, angles and drifts, calmer in the
        // shallows (fading them to flat drew the depth contour as an edge).
        float ripple = mix(0.45, 1.0, smoothstep(0.0, 2.5, seaDepth));
        // A sheltered bay in a light breeze: RMS slopes of ~0.05 per layer (~0.08 with the
        // swell), enough for a low sun to lay a glitter path, not enough to break the sky.
        vec3 layerA = oceanLayer(vSeaWorld.xz, 17.0, 0.35, vec2(0.011, 0.006), 0.05 * ripple, footprint);
        vec3 layerB = oceanLayer(vSeaWorld.xz, 6.5, -0.9, vec2(-0.019, 0.027), 0.045 * ripple, footprint);
        slope += layerA.xy + layerB.xy;
        hidden += layerA.z + layerB.z;
        vec3 seaN = normalize(vec3(-slope.x, 1.0, -slope.y));
        // Shoreline foam: a thin band where the water shoals, broken by drifting noise.
        float shore = 1.0 - smoothstep(0.0, 0.32, seaDepth);
        float lap = 0.5 + 0.5 * sin(seaTime * 1.1 - seaDepth * 18.0 + sNoise(vSeaWorld.xz * 0.7) * 6.0);
        float foamNoise = sNoise(vSeaWorld.xz * 3.1 + seaTime * 0.3) * 0.6 + sNoise(vSeaWorld.xz * 9.0 - seaTime * 0.2) * 0.4;
        float foam = shore * smoothstep(0.35, 0.75, foamNoise * (0.6 + 0.6 * lap));
        foam *= step(0.005, seaDepth);
        // Light scattered back by the water column grows with depth (teal-blue); swell crests
        // are thin enough for the sun to show through them as a brighter green-teal.
        vec3 inscatterAlbedo = vec3(0.012, 0.092, 0.1) * (1.0 - exp(-seaDepth * 0.55));
        diffuseColor.rgb = mix(inscatterAlbedo * 0.3, vec3(0.78, 0.8, 0.8), foam);
        vec3 seaView = normalize(cameraPosition - vSeaWorld);
        float crest = smoothstep(0.0, 0.22, vSeaSwell) * shoal;
        float through = pow(saturate(dot(seaView, -seaSunDirection) * 0.5 + 0.5), 4.0);
        vec3 seaVolumeLight = (inscatterAlbedo * 0.7 + vec3(0.02, 0.09, 0.07) * crest * through)
          * (1.0 - foam) * seaSunIrradiance * max(seaSunDirection.y, 0.05) * RECIPROCAL_PI;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `// Slope variance the pixel cannot resolve widens the glint (GGX alpha² + 2σ²).
        float seaAlpha2 = pow(roughness, 4.0) + hidden;
        float roughnessFactor = mix(sqrt(sqrt(seaAlpha2)), 0.6, foam);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += seaVolumeLight;",
      )
      .replace(
        "#include <normal_fragment_maps>",
        "normal = normalize((viewMatrix * vec4(seaN, 0.0)).xyz);",
      )
      .replace(
        "#include <opaque_fragment>",
        `float seaCos = saturate(dot(normal, normalize(vViewPosition)));
        float seaFresnel = 0.02 + 0.98 * pow(1.0 - seaCos, 5.0);
        float seaAlphaOut = clamp(max(seaFresnel, foam * 0.92), 0.0, 1.0);
        gl_FragColor = vec4(outgoingLight, seaAlphaOut);`,
      );
  };
  material.customProgramCacheKey = () => "odd-tide-sea-v2";
  const mesh = new Mesh(seaGeometry(), material);
  mesh.receiveShadow = true;
  mesh.name = "sea";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return { mesh, material, slopes };
}

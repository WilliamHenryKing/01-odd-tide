import {
  CircleGeometry,
  CustomBlending,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RedFormat,
} from "three";

// The sea: one physical surface at the domain tide level. Reflections, sun glints and shadows
// come from the shared rig; the seabed seen through it is absorbed in the terrain shader, and
// this surface adds only what the water itself contributes (Fresnel reflection, in-scattered
// light, foam). Blending: result = water + background × (1 − Fresnel).

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
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return -7;
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

export function createWater(heightmap: Heightmap, shared: WaterUniforms) {
  const material = new MeshPhysicalMaterial({
    name: "sea",
    color: 0xffffff,
    roughness: 0.045,
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
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeaWorld;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vSeaWorld;
        uniform float seaTime;
        uniform float seaLevel;
        uniform sampler2D heightTex;
        uniform vec2 heightMin;
        uniform vec2 heightMax;
        float sHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float sNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + 1.0), f.x), f.y);
        }
        // Sum of deep-water waves (omega² = g·k): returns the surface slope (dh/dx, dh/dz).
        vec2 seaSlope(vec2 p, float t, float footprint) {
          vec2 slope = vec2(0.0);
          const int COUNT = 9;
          for (int i = 0; i < COUNT; i++) {
            float fi = float(i);
            float wavelength = 11.0 * pow(0.68, fi);
            float k = 6.2831853 / wavelength;
            // Wind from one quarter with a broad spread; golden-angle steps avoid parallel crests.
            float angle = 0.5 + (fract(fi * 0.618034) - 0.5) * 2.6;
            vec2 dir = vec2(cos(angle), sin(angle));
            float amplitude = wavelength * 0.0065;
            float omega = sqrt(9.81 * k);
            float phase = k * dot(dir, p) - omega * t + fi * 2.39;
            // Resolve only waves at least ~4 pixels long; shorter ones would alias into streaks.
            float fade = smoothstep(2.5 * footprint, 6.0 * footprint, wavelength);
            slope += dir * (amplitude * k * cos(phase)) * fade;
          }
          vec2 q = p * 1.3 + vec2(t * 0.31, t * 0.17);
          float fine = smoothstep(1.2, 0.25, footprint);
          slope += (vec2(sNoise(q) - 0.5, sNoise(q.yx + 17.3) - 0.5)) * 0.07 * fine;
          return slope;
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `vec2 seaUv = (vSeaWorld.xz - heightMin) / (heightMax - heightMin);
        float ground = (seaUv.x < 0.0 || seaUv.y < 0.0 || seaUv.x > 1.0 || seaUv.y > 1.0) ? -7.0 : texture2D(heightTex, seaUv).r;
        float seaDepth = max(seaLevel - ground, 0.0);
        float footprint = length(fwidth(vSeaWorld.xz));
        vec2 slope = seaSlope(vSeaWorld.xz, seaTime, footprint) * smoothstep(0.0, 0.6, seaDepth);
        vec3 seaN = normalize(vec3(-slope.x, 1.0, -slope.y));
        // Shoreline foam: a thin band where the water shoals, broken by drifting noise.
        float shore = 1.0 - smoothstep(0.0, 0.32, seaDepth);
        float lap = 0.5 + 0.5 * sin(seaTime * 1.1 - seaDepth * 18.0 + sNoise(vSeaWorld.xz * 0.7) * 6.0);
        float foamNoise = sNoise(vSeaWorld.xz * 3.1 + seaTime * 0.3) * 0.6 + sNoise(vSeaWorld.xz * 9.0 - seaTime * 0.2) * 0.4;
        float foam = shore * smoothstep(0.35, 0.75, foamNoise * (0.6 + 0.6 * lap));
        foam *= step(0.005, seaDepth);
        // Light scattered back by the water column itself grows with depth (teal-blue).
        vec3 inscatterAlbedo = vec3(0.012, 0.092, 0.1) * (1.0 - exp(-seaDepth * 0.55));
        diffuseColor.rgb = mix(inscatterAlbedo, vec3(0.78, 0.8, 0.8), foam);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor = mix(roughness, 0.6, foam);",
      )
      .replace(
        "#include <normal_fragment_maps>",
        "normal = normalize((viewMatrix * vec4(seaN, 0.0)).xyz);",
      )
      .replace(
        "#include <opaque_fragment>",
        `float seaCos = saturate(dot(normal, normalize(vViewPosition)));
        float seaFresnel = 0.02 + 0.98 * pow(1.0 - seaCos, 5.0);
        float seaAlpha = clamp(max(seaFresnel, foam * 0.92) + (1.0 - exp(-seaDepth * 0.02)) * 0.0, 0.0, 1.0);
        gl_FragColor = vec4(outgoingLight, seaAlpha);`,
      );
  };
  material.customProgramCacheKey = () => "odd-tide-sea-v1";
  const mesh = new Mesh(new CircleGeometry(12_000, 96), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "sea";
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return { mesh, material };
}

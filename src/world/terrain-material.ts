import { MeshStandardMaterial, type Texture } from "three";
import { HIGH_WATER } from "./layout";
import type { PbrSet } from "./textures";

// Terrain shading on top of three's physical material (so shadows, IBL and fog stay exact):
// triplanar sandstone with bedding tint, top-projected sand and turf from baked weights, baked
// ambient occlusion on indirect light only, intertidal zonation driven by the live tide, and
// Beer–Lambert absorption plus sun caustics under water.

export type TerrainUniforms = {
  waterLevel: { value: number };
  time: { value: number };
};

/** Development only: window.__TERRAIN_DEBUG__ = normal|weights|albedo|ao replaces shading. */
const DEBUG_MODES: Record<string, number> = { normal: 1, weights: 2, albedo: 3, ao: 4 };
const debugMode = import.meta.env.DEV
  ? (DEBUG_MODES[String((globalThis as { __TERRAIN_DEBUG__?: string }).__TERRAIN_DEBUG__ ?? "")] ??
    0)
  : 0;

export type TerrainSets = { rock: PbrSet; rockAlt: PbrSet; sand: PbrSet; turf: PbrSet };

export function createTerrainMaterial(sets: TerrainSets, shared: TerrainUniforms) {
  const material = new MeshStandardMaterial({
    name: "terrain",
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
  const maps: Record<string, { value: Texture }> = {
    rockColour: { value: sets.rock.colour },
    rockNormal: { value: sets.rock.normal },
    rockArm: { value: sets.rock.arm },
    rockAltColour: { value: sets.rockAlt.colour },
    rockAltNormal: { value: sets.rockAlt.normal },
    rockAltArm: { value: sets.rockAlt.arm },
    sandColour: { value: sets.sand.colour },
    sandNormal: { value: sets.sand.normal },
    sandArm: { value: sets.sand.arm },
    turfColour: { value: sets.turf.colour },
    turfNormal: { value: sets.turf.normal },
    turfArm: { value: sets.turf.arm },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, maps, {
      waterLevel: shared.waterLevel,
      terrainTime: shared.time,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTerrainWorld;
        varying vec3 vTerrainNormal;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        // World normal via the normal matrix: quantized meshes carry a non-uniform node scale,
        // so mat3(modelMatrix) would skew normals. View space back to world is the transpose.
        vTerrainNormal = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTerrainWorld;
        varying vec3 vTerrainNormal;
        uniform sampler2D rockColour, rockNormal, rockArm;
        uniform sampler2D rockAltColour, rockAltNormal, rockAltArm;
        uniform sampler2D sandColour, sandNormal, sandArm;
        uniform sampler2D turfColour, turfNormal, turfArm;
        uniform float waterLevel;
        uniform float terrainTime;
        const float HIGH_WATER = ${HIGH_WATER.toFixed(3)};

        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + 1.0), f.x), f.y);
        }
        vec3 triWeights(vec3 n) {
          vec3 w = pow(abs(n), vec3(5.0));
          return w / (w.x + w.y + w.z);
        }
        vec4 tri(sampler2D t, vec3 p, vec3 w, float s) {
          return texture2D(t, p.zy * s) * w.x + texture2D(t, p.xz * s) * w.y + texture2D(t, p.xy * s) * w.z;
        }
        // Whiteout-blended triplanar normal (OpenGL-convention maps), after Ben Golus.
        vec3 triNormal(sampler2D t, vec3 p, vec3 n, vec3 w, float s) {
          vec3 nx = texture2D(t, p.zy * s).xyz * 2.0 - 1.0;
          vec3 ny = texture2D(t, p.xz * s).xyz * 2.0 - 1.0;
          vec3 nz = texture2D(t, p.xy * s).xyz * 2.0 - 1.0;
          nx = vec3(nx.xy + n.zy, abs(nx.z) * n.x);
          ny = vec3(ny.xy + n.xz, abs(ny.z) * n.y);
          nz = vec3(nz.xy + n.xy, abs(nz.z) * n.z);
          return normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);
        }
        vec3 topNormal(sampler2D t, vec2 uv, vec3 n) {
          vec3 m = texture2D(t, uv).xyz * 2.0 - 1.0;
          m = vec3(m.xy + n.xz, abs(m.z) * n.y);
          return normalize(m.xzy);
        }
        float caustic(vec2 p, float time) {
          vec2 q = p * 1.6;
          float c = 0.0;
          for (int i = 0; i < 3; i++) {
            q += vec2(sin(q.y * 1.3 + time * 0.9), cos(q.x * 1.1 - time * 0.8)) * 0.45;
            c += abs(sin(q.x * 2.3 + q.y * 1.7 + time * 0.6));
          }
          return pow(1.0 - c / 3.0, 5.0) * 4.0;
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `vec3 P = vTerrainWorld;
        vec3 N = normalize(vTerrainNormal);
        vec3 W = triWeights(N);
        float macro = tNoise(P.xz * 0.045) * 0.6 + tNoise(P.xz * 0.19) * 0.4;
        float sandWeight = vColor.g;
        float turfWeight = vColor.b;
        float bakedAo = vColor.r;
        float variation = vColor.a;

        // Sandstone: two scans blended by a slow macro field; bedding bands tint by height.
        vec4 rockA = tri(rockColour, P, W, 0.33);
        vec4 rockB = tri(rockAltColour, P, W, 0.29);
        float altMix = smoothstep(0.35, 0.75, macro);
        vec3 rockAlbedo = mix(rockA.rgb, rockB.rgb, altMix);
        vec3 rockArmV = mix(tri(rockArm, P, W, 0.33).rgb, tri(rockAltArm, P, W, 0.29).rgb, altMix);
        float band = sin(P.y * 7.1 + tNoise(P.xz * 0.3) * 3.0) * 0.5 + 0.5;
        float band2 = sin(P.y * 2.3 + 1.7) * 0.5 + 0.5;
        vec3 strata = mix(vec3(1.07, 0.99, 0.88), vec3(0.9, 0.86, 0.83), band * 0.55 + band2 * 0.45);
        // Re-grade the scans toward the art direction's warm tan sandstone (less red, a touch
        // lighter), keeping their own structure and bedding contrast.
        float rockLuma = dot(rockAlbedo, vec3(0.2126, 0.7152, 0.0722));
        rockAlbedo = mix(vec3(rockLuma), rockAlbedo, 0.62) * vec3(1.16, 1.05, 0.86);
        rockAlbedo *= strata * mix(0.9, 1.08, variation);

        vec2 topUv = P.xz;
        vec3 sandAlbedo = texture2D(sandColour, topUv * 0.42).rgb;
        vec3 sandArmV = texture2D(sandArm, topUv * 0.42).rgb;
        vec3 turfAlbedo = texture2D(turfColour, topUv * 0.36).rgb * mix(0.85, 1.1, macro);
        vec3 turfArmV = texture2D(turfArm, topUv * 0.36).rgb;

        // Height-aware blending: sand fills rock hollows first, turf thins over rock highs.
        float rockHeight = dot(rockAlbedo, vec3(0.33));
        float sandMask = smoothstep(0.1, 0.55, sandWeight * 1.5 - rockHeight * 0.5);
        float turfMask = smoothstep(0.15, 0.6, turfWeight * 1.4 - rockHeight * 0.35 + (macro - 0.5) * 0.3);
        vec3 albedo = mix(rockAlbedo, sandAlbedo, sandMask);
        albedo = mix(albedo, turfAlbedo, turfMask);
        vec3 arm = mix(rockArmV, sandArmV, sandMask);
        arm = mix(arm, turfArmV, turfMask);

        vec3 terrainN = triNormal(rockNormal, P, N, W, 0.33);
        terrainN = normalize(mix(terrainN, topNormal(sandNormal, topUv * 0.42, N), sandMask));
        terrainN = normalize(mix(terrainN, topNormal(turfNormal, topUv * 0.36, N), turfMask));

        // Intertidal zone: rock below the high-water mark is darker, algae-stained in hollows.
        float intertidal = 1.0 - smoothstep(HIGH_WATER - 0.25, HIGH_WATER + 0.3, P.y + (macro - 0.5) * 0.35);
        float algae = intertidal * (1.0 - sandMask) * smoothstep(0.35, 0.8, (1.0 - bakedAo) * 1.2 + tNoise(P.xz * 1.7 + P.y) * 0.6);
        albedo *= mix(1.0, 0.64, intertidal * (1.0 - sandMask * 0.4));
        albedo = mix(albedo, vec3(0.075, 0.085, 0.045), algae * 0.55);
        // Wet film just above the water line; sand stays damp for a little longer.
        float above = P.y - waterLevel;
        float film = (1.0 - smoothstep(0.0, 0.5 + sandMask * 0.5, above)) * step(0.0, above);
        albedo *= mix(1.0, 0.72, film);
        float terrainRoughness = mix(arm.g, 0.3, film);
        terrainRoughness = mix(terrainRoughness, min(terrainRoughness, 0.8), intertidal * 0.5);
        float terrainAo = arm.r;
        diffuseColor.rgb = albedo;`,
      )
      .replace("#include <color_fragment>", "")
      .replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor = clamp(terrainRoughness, 0.04, 1.0);",
      )
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = 0.0;")
      .replace(
        "#include <normal_fragment_maps>",
        "normal = normalize((viewMatrix * vec4(terrainN, 0.0)).xyz);",
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        float underwater = waterLevel - P.y;
        if (underwater > 0.0) {
          float c = caustic(P.xz, terrainTime);
          reflectedLight.directDiffuse *= mix(1.0, 0.45 + c, smoothstep(0.0, 0.35, underwater) * exp(-underwater * 0.3));
        }`,
      )
      .replace(
        "#include <aomap_fragment>",
        `float ambientOcclusion = mix(1.0, bakedAo, 0.92) * mix(1.0, terrainAo, 0.8);
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        #if defined( USE_ENVMAP ) && defined( STANDARD )
          float dotNVao = saturate(dot(geometryNormal, geometryViewDir));
          reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNVao, ambientOcclusion, material.roughness);
        #endif`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#if ${debugMode} > 0
          vec3 debugColour = ${debugMode} == 1 ? terrainN * 0.5 + 0.5 : ${debugMode} == 2 ? vColor.rgb : ${debugMode} == 3 ? albedo : vec3(ambientOcclusion);
          outgoingLight = debugColour * 0.25;
        #endif
        if (underwater > 0.0) {
          // Two-way path through clear coastal water: red goes first, then green.
          vec3 sigma = vec3(0.36, 0.075, 0.058);
          outgoingLight *= exp(-sigma * underwater * 2.2);
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "odd-tide-terrain-v1";
  return material;
}

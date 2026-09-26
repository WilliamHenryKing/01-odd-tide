import {
  Color,
  DirectionalLight,
  FogExp2,
  type Material,
  type MeshStandardMaterial,
  type PerspectiveCamera,
  type PointLight,
  type Scene,
  ShaderChunk,
  type SpotLight,
  type Texture,
  Vector3,
  type WebGLRenderer,
} from "three";
import { EnvironmentBaker, hazeRadiance, type SkyAmbient, SkyDome, skyAmbient } from "./sky";
import { type Celestial, celestial, type Vec3 } from "./sky-model";

// Aerial perspective: physical exponential extinction over true view distance, tinted with the
// sky's own horizon radiance. Patched once, globally, before any material compiles.
let fogPatched = false;
function patchFog() {
  if (fogPatched) return;
  fogPatched = true;
  ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = length( mvPosition.xyz );
#endif`;
  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

type Practical = {
  light: PointLight | SpotLight;
  /** Luminous intensity in candela when fully on. */
  candela: number;
  on: number;
};
type Emissive = {
  material: MeshStandardMaterial;
  /** Surface luminance in cd/m² when fully on. */
  luminance: number;
  on: number;
};

export type RigOptions = {
  /** Centre and radius of everything that casts or receives sun shadows, metres. */
  shadowCentre: Vector3;
  shadowRadius: number;
  shadowMapSize?: number;
  /** Meteorological visibility, metres: sets the aerial-perspective extinction. */
  visibility?: number;
  cloudCoverage?: number;
};

export class LightingRig {
  readonly key: DirectionalLight;
  readonly sky: SkyDome;
  readonly fog: FogExp2;
  sky_state: Celestial;
  private readonly baker: EnvironmentBaker;
  private readonly practicals: Practical[] = [];
  private readonly emissives: Emissive[] = [];
  private environment: Texture | null = null;
  private bakedHour = Number.NaN;
  private ambientHour = Number.NaN;
  private ambient: SkyAmbient = { skyIlluminance: [0, 0, 0], seaRadiance: [0, 0, 0] };
  private lastBake = 0;
  private readonly forward = new Vector3();

  constructor(
    renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly options: RigOptions,
  ) {
    patchFog();
    this.baker = new EnvironmentBaker(renderer);
    this.sky = new SkyDome({ cloudCoverage: options.cloudCoverage ?? 0.28 });
    scene.add(this.sky.mesh);
    this.fog = new FogExp2(new Color(0.5, 0.6, 0.7), 3.912 / (options.visibility ?? 15_000));
    scene.fog = this.fog;

    this.key = new DirectionalLight(0xffffff, 1);
    this.key.name = "celestial-key";
    this.key.castShadow = true;
    const size = options.shadowMapSize ?? 2048;
    this.key.shadow.mapSize.set(size, size);
    const r = options.shadowRadius;
    const camera = this.key.shadow.camera;
    camera.left = -r;
    camera.right = r;
    camera.top = r;
    camera.bottom = -r;
    camera.near = 0.5;
    camera.far = r * 4;
    camera.updateProjectionMatrix();
    // Offsets in world units against ~2r/size metres per texel.
    const texel = (2 * r) / size;
    this.key.shadow.normalBias = texel * 0.9;
    this.key.shadow.bias = -0.00012;
    this.key.shadow.radius = 1;
    this.key.target.position.copy(options.shadowCentre);
    scene.add(this.key, this.key.target);
    this.sky_state = celestial(9);
  }

  registerPractical(light: PointLight | SpotLight, candela: number) {
    light.decay = 2;
    light.distance = 0;
    const practical = { light, candela, on: 0 };
    this.practicals.push(practical);
    return practical;
  }
  registerEmissive(material: MeshStandardMaterial, luminance: number) {
    const emissive = { material, luminance, on: 1 };
    this.emissives.push(emissive);
    return emissive;
  }

  /** Brings sky, key light, environment, haze and practicals to the given hour. */
  apply(hour: number, time: number, camera: PerspectiveCamera, forceBake = false): Celestial {
    const sky = celestial(hour);
    this.sky_state = sky;
    const p = sky.preExposure;
    if (forceBake || Math.abs(hour - this.ambientHour) > 0.004) {
      this.ambient = skyAmbient(sky);
      this.ambientHour = hour;
    }
    this.sky.apply(sky, time, this.ambient);

    // The key is whichever of sun or moon delivers more direct light (never both).
    const sunUp = sky.sunLux >= sky.moonLux;
    const body = sunUp ? sky.sun : sky.moon;
    const lux = sunUp ? sky.sunLux : sky.moonLux;
    const colour: Vec3 = sunUp ? sky.sunColour : [1.03, 0.98, 0.91];
    const r = this.options.shadowRadius;
    this.key.position
      .set(...body.direction)
      .multiplyScalar(r * 2)
      .add(this.options.shadowCentre);
    this.key.color.setRGB(...colour);
    this.key.intensity = lux * p;
    this.key.castShadow = lux * p > 0.0015;

    for (const practical of this.practicals)
      practical.light.intensity = practical.candela * practical.on * p;
    for (const emissive of this.emissives)
      emissive.material.emissiveIntensity = emissive.luminance * emissive.on * p;

    camera.getWorldDirection(this.forward);
    const flat = Math.hypot(this.forward.x, this.forward.z) || 1;
    const haze = hazeRadiance(sky, [this.forward.x / flat, this.forward.z / flat]);
    this.fog.color.setRGB(haze[0] * p, haze[1] * p, haze[2] * p);

    const now = performance.now();
    if (
      forceBake ||
      !this.environment ||
      (Math.abs(hour - this.bakedHour) > 0.004 && now - this.lastBake > 110)
    ) {
      this.environment = this.baker.bake(sky, time, this.ambient);
      this.scene.environment = this.environment;
      this.bakedHour = hour;
      this.lastBake = now;
    }
    return sky;
  }

  dispose(materials: Set<Material> = new Set()) {
    this.baker.dispose();
    this.sky.dispose();
    this.key.shadow.dispose();
    for (const m of materials) m.dispose();
  }
}

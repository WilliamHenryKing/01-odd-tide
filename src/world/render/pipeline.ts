import {
  AgXToneMapping,
  type Camera,
  HalfFloatType,
  type Object3D,
  PCFShadowMap,
  type Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// One renderer setup for the island, the look-dev route and captures. Scene values arrive
// pre-exposed (see sky-model.ts); tone mapping and the sRGB transfer happen once, in OutputPass.

/** Linear-light grade: mesopic/scotopic shift at night, and a restrained vignette. */
const GradeShader = {
  name: "OddTideGrade",
  uniforms: {
    tDiffuse: { value: null },
    night: { value: 0 },
    vignette: { value: 0.14 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float night;
    uniform float vignette;
    uniform float aspect;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;
      // Rod vision: dim regions lose hue and shift toward blue-green; lamplit regions stay
      // photopic. The weights approximate the scotopic luminous efficiency curve.
      float photopic = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float scotopic = dot(c, vec3(0.03, 0.62, 0.52));
      float rods = night * (1.0 - smoothstep(0.02, 0.6, photopic));
      c = mix(c, vec3(0.55, 0.78, 1.18) * scotopic * 0.8, rods * 0.85);
      vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
      c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(p));
      gl_FragColor = vec4(c, texel.a);
    }
  `,
};

type VisibilityPatched = {
  _overrideVisibility(): void;
  _visibilityCache: Object3D[];
};

export type PipelineOptions = {
  /** Objects the ambient-occlusion G-buffer must ignore (sky, water, effects). */
  aoHidden: () => Object3D[];
  maxPixelRatio?: number;
};

export class Pipeline {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly ao: GTAOPass;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  private readonly size = new Vector2(1, 1);
  private pixelRatio = 1;
  private readonly maxPixelRatio: number;

  constructor(
    readonly scene: Scene,
    readonly camera: Camera,
    options: PipelineOptions,
  ) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
      stencil: false,
    });
    this.maxPixelRatio = options.maxPixelRatio ?? 1.6;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = AgXToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    // Count every pass of a frame (scene, shadows, AO G-buffer, post), not just the last one.
    this.renderer.info.autoReset = false;

    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    target.texture.name = "OddTide.hdr";
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    this.ao = new GTAOPass(scene, camera, 1, 1);
    this.ao.blendIntensity = 0.85;
    this.ao.updateGtaoMaterial({
      radius: 0.6,
      distanceExponent: 1.4,
      thickness: 1.2,
      scale: 1,
      samples: 12,
    });
    this.ao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 6,
      rings: 2,
      samples: 12,
    });
    const patched = this.ao as unknown as VisibilityPatched;
    const original = patched._overrideVisibility.bind(this.ao);
    patched._overrideVisibility = () => {
      original();
      for (const object of options.aoHidden())
        if (object.visible) {
          object.visible = false;
          patched._visibilityCache.push(object);
        }
    };
    this.composer.addPass(this.ao);

    // Bloom models lens glare: only energy above the threshold contributes, clamped so a
    // physically bright lamp (thousands of cd/m² at night exposure) cannot flood the frame.
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.14, 0, 1.4);
    const highPass = this.bloom.materialHighPassFilter;
    highPass.fragmentShader = highPass.fragmentShader.replace(
      "gl_FragColor = mix( outputColor, texel, alpha );",
      `vec3 above = texel.rgb * (max(v - luminosityThreshold, 0.0) / max(v, 1e-4));
        above *= min(1.0, 10.0 / max(luminance(above), 1e-4));
        gl_FragColor = vec4(above, 1.0);`,
    );
    highPass.needsUpdate = true;
    const composite = this.bloom.compositeMaterial.uniforms as Record<string, { value: unknown }>;
    if (composite.bloomFactors) composite.bloomFactors.value = [1, 0.55, 0.3, 0.14, 0.06];
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  get domElement() {
    return this.renderer.domElement;
  }
  get drawingSize() {
    return { width: this.size.x, height: this.size.y, pixelRatio: this.pixelRatio };
  }
  setSize(width: number, height: number, pixelRatio = this.pixelRatio) {
    this.size.set(width, height);
    this.pixelRatio = Math.min(pixelRatio, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
    const uniforms = this.grade.uniforms as Record<string, { value: number }>;
    if (uniforms.aspect) uniforms.aspect.value = width / Math.max(height, 1);
  }
  setNight(night: number) {
    const uniforms = this.grade.uniforms as Record<string, { value: number }>;
    if (uniforms.night) uniforms.night.value = night;
    // Glare reads more strongly against a dark surround.
    this.bloom.strength = 0.12 + 0.1 * night;
  }
  render() {
    this.renderer.info.reset();
    this.composer.render();
  }
  dispose() {
    this.ao.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

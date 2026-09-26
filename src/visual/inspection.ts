import {
  type Camera,
  ColorManagement,
  type Light,
  type Material,
  Mesh,
  REVISION,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";

export type VisualBookmark = { id: string; purpose: string; hero: boolean };
type Adapter = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  bookmarks: VisualBookmark[];
  apply(id: string): Promise<void>;
  freeze(): void;
  render(): void;
  lighting(state: string): Promise<void>;
  current(): unknown;
};
export type VisualTest = {
  ready: Promise<void>;
  bookmarks: VisualBookmark[];
  tiers: string[];
  setBookmark(id: string): Promise<{ bookmark: string }>;
  setTier(tier: string): { tier: string };
  setLightingState(state: string): Promise<{ lighting: string }>;
  setSeed(seed: number): { seed: number; mode: string };
  freeze(): void;
  settle(frames?: number): Promise<void>;
  info(): ReturnType<typeof inspect> & { state: unknown; seed: number; tier: string };
};
declare global {
  interface Window {
    __VISUAL_TEST__?: VisualTest;
  }
}

const mapSlots = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "bumpMap",
  "alphaMap",
  "emissiveMap",
  "envMap",
] as const;
function textureRecord(texture: Texture) {
  const source = texture.image as { width?: number; height?: number } | undefined;
  return {
    name: texture.name || texture.uuid,
    colorSpace: texture.colorSpace,
    width: source?.width ?? null,
    height: source?.height ?? null,
    type: texture.type,
    format: texture.format,
    mipmaps: texture.generateMipmaps,
  };
}
function materialRecord(material: Material) {
  const data = material as Material & {
    color?: { getHexString(): string };
    roughness?: number;
    metalness?: number;
    emissiveIntensity?: number;
  } & Partial<Record<(typeof mapSlots)[number], Texture | null>>;
  return {
    name: data.name || data.uuid,
    type: data.type,
    colorSRGB: data.color?.getHexString(),
    roughness: data.roughness,
    metalness: data.metalness,
    emissiveIntensity: data.emissiveIntensity,
    transparent: data.transparent,
    opacity: data.opacity,
    alphaTest: data.alphaTest,
    toneMapped: data.toneMapped,
    maps: Object.fromEntries(
      mapSlots.flatMap((slot) => (data[slot] ? [[slot, textureRecord(data[slot])]] : [])),
    ),
  };
}
function inspect({ renderer, scene, camera }: Adapter) {
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = debug
    ? (gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string)
    : (gl.getParameter(gl.RENDERER) as string);
  const lights: unknown[] = [],
    meshes: unknown[] = [];
  const materials = new Map<string, ReturnType<typeof materialRecord>>();
  const textures = new Map<string, ReturnType<typeof textureRecord>>();
  scene.traverse((object) => {
    if ("isLight" in object && object.isLight) {
      const light = object as Light & {
        distance?: number;
        decay?: number;
        shadow?: {
          mapSize: { toArray(): number[] };
          bias: number;
          normalBias: number;
          radius: number;
          camera: Camera;
        };
      };
      lights.push({
        name: light.name || light.uuid,
        type: light.type,
        colorSRGB: light.color.getHexString(),
        intensity: light.intensity,
        units: /Point|Spot/.test(light.type)
          ? "candela"
          : /Directional/.test(light.type)
            ? "lux-style directional intensity"
            : "hemisphere intensity multiplier",
        position: light.position.toArray(),
        castShadow: light.castShadow,
        distance: light.distance,
        decay: light.decay,
        shadow: light.shadow
          ? {
              size: light.shadow.mapSize.toArray(),
              bias: light.shadow.bias,
              normalBias: light.shadow.normalBias,
              radius: light.shadow.radius,
              camera: light.shadow.camera.toJSON().object,
            }
          : null,
      });
    }
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const count = geometry.index?.count ?? geometry.getAttribute("position")?.count ?? 0;
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    const ancestry: string[] = [];
    for (let current = object.parent; current && current !== scene; current = current.parent)
      ancestry.unshift(current.name || current.type);
    meshes.push({
      name: object.name || object.uuid,
      ancestry,
      family: object.userData.visualFamily ?? "unclassified",
      geometry: geometry.type,
      triangles: count / 3,
      instances:
        "isInstancedMesh" in object && object.isInstancedMesh
          ? (object as { count: number }).count
          : 1,
      visible: object.visible,
      materials: mats.map((m) => m.name || m.uuid),
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
    });
    for (const material of mats) {
      materials.set(material.uuid, materialRecord(material));
      for (const value of Object.values(material))
        if (value && typeof value === "object" && "isTexture" in value && value.isTexture)
          textures.set((value as Texture).uuid, textureRecord(value as Texture));
    }
  });
  if (scene.environment) textures.set(scene.environment.uuid, textureRecord(scene.environment));
  return {
    backend: "WebGL2",
    gpu,
    softwareRenderer: /swiftshader|llvmpipe|software|warp/i.test(gpu),
    three: REVISION,
    colorManagementEnabled: ColorManagement.enabled,
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    environmentIntensity: scene.environmentIntensity,
    environment: scene.environment ? textureRecord(scene.environment) : null,
    drawingBuffer: { width: renderer.domElement.width, height: renderer.domElement.height },
    pixelRatio: renderer.getPixelRatio(),
    contextAttributes: gl.getContextAttributes(),
    renderInfo: { ...renderer.info.render },
    memory: { ...renderer.info.memory },
    camera: {
      type: camera.type,
      position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(),
      projection: camera.projectionMatrix.toArray(),
    },
    lights,
    meshes,
    materials: [...materials.values()],
    textures: [...textures.values()],
    assetBytes: performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        url: resource.name,
        transferSize: resource.transferSize,
        decodedBodySize: resource.decodedBodySize,
      };
    }),
    notes:
      "renderer.info is actual draw/resource counts, not GPU bytes or timing. On-disk asset inventory is recorded by the capture runner. Mesh triangle inventory is not the renderer's frustum/shadow-pass count.",
  };
}
export function installInspection(adapter: Adapter): () => void {
  let bookmark = "unselected";
  const api: VisualTest = {
    ready: Promise.all([
      document.fonts.ready,
      adapter.renderer.compileAsync(adapter.scene, adapter.camera),
    ]).then(() => undefined),
    bookmarks: adapter.bookmarks.map(({ id, purpose, hero }) => ({ id, purpose, hero })),
    tiers: ["existing"],
    async setBookmark(id) {
      if (!adapter.bookmarks.some((item) => item.id === id))
        throw new Error(`Unknown bookmark: ${id}`);
      await adapter.apply(id);
      bookmark = id;
      return { bookmark };
    },
    setTier(tier) {
      if (tier !== "existing") throw new Error(`Unimplemented tier: ${tier}`);
      return { tier };
    },
    async setLightingState(state) {
      await adapter.lighting(state);
      return { lighting: state };
    },
    setSeed(seed) {
      if (seed !== 870)
        throw new Error(
          "The baseline scene has fixed authored seeds; only baseline seed 870 is supported.",
        );
      return { seed, mode: "fixed authored seeds; animation time reset by freeze" };
    },
    freeze: adapter.freeze,
    async settle(frames = 30) {
      if (!Number.isInteger(frames) || frames < 1 || frames > 120)
        throw new Error("Settle frames must be 1–120");
      for (let i = 0; i < frames; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        adapter.render();
      }
    },
    info: () => ({
      ...inspect(adapter),
      state: { bookmark, value: adapter.current() },
      seed: 870,
      tier: "existing",
    }),
  };
  window.__VISUAL_TEST__ = api;
  return () => {
    if (window.__VISUAL_TEST__ === api) delete window.__VISUAL_TEST__;
  };
}

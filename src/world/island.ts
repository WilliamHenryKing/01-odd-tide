import { gsap } from "gsap";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DefaultLoadingManager,
  Group,
  type Material,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { type LensId, lensReady, type StayId, waterHeight } from "../domain";
import { reportLoading, worldFailed, worldReady } from "../loader";
import { buildBath } from "./build/bath";
import { buildGull } from "./build/gull";
import { buildLodge } from "./build/lodge";
import { buildObservatory } from "./build/observatory";
import {
  buildBoardwalk,
  buildBuoy,
  buildLanterns,
  buildLensFragment,
  buildLighthouse,
  buildPontoon,
  buildStairs,
} from "./build/props";
import { type Building, buildWeatherHouse } from "./build/weather-house";
import {
  BATH_SITE,
  CAUSEWAY,
  CAUSEWAY_STONE_TOP,
  FAR_SEABED,
  LIGHTHOUSE_SITE,
  PATHS,
  PORTRAIT_PULLBACK,
  STAY_CAMERAS,
  STAY_SITES,
  TIDE_SCALE,
} from "./layout";
import { createMaterials, disposeMaterials } from "./materials";
import { cabin as legacyCabin, tree as legacyTree, materialKit, random } from "./objects";
import { Pipeline } from "./render/pipeline";
import { detectQuality, FrameGovernor, tierSettings } from "./render/quality";
import { LightingRig } from "./render/rig";
import { createTerrainMaterial, type TerrainUniforms } from "./terrain-material";
import { disposeTextureCache, loadPbrSet } from "./textures";
import { buildVegetation } from "./vegetation";
import { createWater, loadHeightmap, type SeaSun } from "./water";

export interface IslandState {
  hour: number;
  selected: StayId | null;
  opened: boolean;
  paused: boolean;
  reduced: boolean;
  found: LensId[];
  discover: boolean;
}
export interface Island {
  update(state: IslandState): void;
  capture(): string;
  dispose(): void;
}

/**
 * Visual reset stages. Each concern lands (and is reviewed) as its own change:
 * C2 coast & tide, C3 architecture, C4 vegetation. Legacy pieces fill in until replaced.
 */
const STAGE = { architecture: true, vegetation: true };
/** Floor level above the rock for each rebuilt stay (piers and posts make up the difference). */
const FLOOR_LIFT: Record<StayId, number> = {
  "weather-house": 0.55,
  "nap-observatory": 0.5,
  "lantern-lodge": 0.7,
};
/** Legacy models were built at one third of a metre per unit. */
const LEGACY = 3;

// Desktop arrival: 58 m out at 18° so the archipelago fills the right two-thirds beside the
// headline, with the horizon just inside the top edge (art direction, composition).
const ARRIVAL = {
  desktop: { position: new Vector3(22.51, 19.12, 51.01), target: new Vector3(-9.42, 1.2, 6.05) },
  portrait: { position: new Vector3(44.8, 54, 79.9), target: new Vector3(-1.1, 1.2, 1.9) },
};

// The island's code has arrived: the arrival loader's first stage.
reportLoading("module", 1);

export function createIsland(
  host: HTMLElement,
  onSelect: (id: StayId) => void,
  onLost: () => void,
  onReady: () => void,
  onCollect: (id: LensId) => void,
  initialState: IslandState,
): Island {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.3, 30_000);
  const target = ARRIVAL.desktop.target.clone();
  camera.position.copy(ARRIVAL.desktop.position);
  const aoHidden: Object3D[] = [];
  // Quality for this machine (full fidelity on a capable GPU); the governor keeps it smooth.
  const quality = detectQuality();
  const tier = tierSettings(quality);
  const pipeline: Pipeline = new Pipeline(scene, camera, { aoHidden: () => aoHidden, tier });
  const governor = new FrameGovernor(
    1 / 50,
    (s) => pipeline.setScale(s),
    () => pipeline.renderScale,
    () => {
      if (!pipeline.ao.enabled) return false;
      pipeline.ao.enabled = false;
      return true;
    },
  );
  document.documentElement.dataset.quality = quality;
  const renderer = pipeline.renderer;
  renderer.domElement.setAttribute("aria-label", "Interactive miniature of the Odd Tide island");
  renderer.domElement.style.touchAction = "pan-y";
  host.append(renderer.domElement);
  const rig: LightingRig = new LightingRig(renderer, scene, {
    shadowCentre: new Vector3(-1, 0, -1),
    shadowRadius: 30,
    shadowMapSize: tier.shadow,
  });
  aoHidden.push(rig.sky.mesh);

  // One interior practical carries a short-range cube shadow; it follows the selected cabin's
  // main lamp so light stays inside rooms without recompiling shaders on selection.
  const interiorShadow = new PointLight(0xffb46b, 0);
  interiorShadow.castShadow = true;
  interiorShadow.shadow.mapSize.set(512, 512);
  interiorShadow.shadow.camera.near = 0.05;
  interiorShadow.shadow.camera.far = 7;
  interiorShadow.shadow.bias = -0.002;
  // Six faces a frame is the costliest shadow in the scene; the frame loop redraws it only
  // while the lamp is lit and something that shapes it has changed. It must still render once:
  // an unallocated shadow map leaves shadow samplers bound to the wrong texture type and the
  // draws that sample it fail.
  interiorShadow.shadow.autoUpdate = false;
  interiorShadow.shadow.needsUpdate = true;
  scene.add(interiorShadow);
  const interiorPractical = rig.registerPractical(interiorShadow, 0);

  let state: IslandState = initialState;
  const values = { hour: initialState.hour, open: initialState.opened ? 1 : 0 };
  let width = 1;
  let height = 1;
  let visible = true;
  let disposed = false;
  let dirty = true;
  let frame = 0;
  let last = performance.now();
  let elapsed = 0;
  let perfActive = false;
  let introTween: gsap.core.Tween | null = null;
  let ready = false;
  let lastSelected: StayId | null | undefined;
  let lastOpened = false;
  let detachInspection: (() => void) | undefined;
  let detachPerf: (() => void) | undefined;
  let world: World | null = null;

  const wake = () => {
    dirty = true;
    if (perfActive || !ready) return;
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw);
  };

  // Portrait layouts give the island a window row and let the canvas overhang the copy above
  // and the instrument below (negative margins): frame for the window, not the whole canvas.
  const windowShare = () => {
    const style = getComputedStyle(host);
    const overhang = -(Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom));
    return height / Math.max(120, height - Math.max(0, overhang || 0));
  };

  const pose = (instant: boolean) => {
    const portrait = width <= 1100;
    const tall = portrait ? windowShare() : 1;
    let destination: Vector3;
    let aim: Vector3;
    if (state.selected) {
      const site = STAY_SITES[state.selected];
      const shot = STAY_CAMERAS[state.selected][state.opened ? "open" : "closed"];
      const base = new Vector3(...site.position);
      // Portrait frames are taller than wide: pull back with that ratio so the building sits
      // inside the window between the title and the time instrument.
      const pull = portrait ? Math.max(PORTRAIT_PULLBACK, (height / width) * 1.4, tall * 0.93) : 1;
      destination = base.clone().add(new Vector3(...shot.offset).multiplyScalar(pull));
      aim = base.clone().add(new Vector3(...(portrait ? shot.aimPortrait : shot.aim)));
    } else {
      const arrival = portrait ? ARRIVAL.portrait : ARRIVAL.desktop;
      // Portrait: pull back with the frame's height-to-width ratio, so the whole island keeps
      // about 88 % of the width, and far enough that it stays inside a short, wide window.
      const fit = portrait
        ? Math.max(0.8, Math.min(2.4, Math.max((height / width) * 0.86, tall * 0.55)))
        : 1;
      destination = arrival.target.clone().lerp(arrival.position, fit);
      aim = arrival.target.clone();
    }
    gsap.to(camera.position, {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      duration: instant ? 0 : 1.5,
      ease: "power2.inOut",
      overwrite: true,
      onUpdate: wake,
    });
    gsap.to(target, {
      x: aim.x,
      y: aim.y,
      z: aim.z,
      duration: instant ? 0 : 1.5,
      ease: "power2.inOut",
      overwrite: true,
      onUpdate: wake,
    });
  };

  function draw(now: number, captureFrame = false) {
    if (perfActive && !captureFrame) return;
    // Exactly one frame may be pending. This call is the frame, however it was reached (the
    // animation frame, a resize, a settle, a capture), so any other pending one is dropped; a
    // wake() during the draw below then schedules the next, and the end of the draw does not
    // schedule a second. (Two such chains once ran side by side, drawing the island four times
    // a frame.)
    cancelAnimationFrame(frame);
    frame = 0;
    if (disposed || !world || (!captureFrame && (!visible || document.hidden))) return;
    const raw = (now - last) / 1000;
    const delta = Math.min(raw, 0.05);
    last = now;
    // Frames after a rest arrive late; the governor ignores gaps of more than a quarter second.
    if (!captureFrame) governor.sample(raw);
    const animated = !state.paused && !state.reduced;
    if (animated && !perfActive) elapsed += delta;
    const visualHour = captureFrame ? state.hour : values.hour;
    world.frame(visualHour, elapsed, animated);
    const sky = rig.apply(visualHour, elapsed, camera, captureFrame);
    pipeline.setNight(sky.night);
    world.afterLighting();
    camera.lookAt(target);
    pipeline.render();
    dirty = false;
    if (animated && !perfActive && visible && !document.hidden && !frame)
      frame = requestAnimationFrame(draw);
  }

  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    pipeline.setSize(width, height, window.devicePixelRatio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Let the establishing move finish; it already ends on this framing.
    if (!introTween?.isActive()) pose(true);
    if (ready && !disposed) {
      // Resizing clears the canvas: draw into the new buffer at once rather than show a blank.
      cancelAnimationFrame(frame);
      frame = 0;
      draw(performance.now());
    }
    wake();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (!visible) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      last = performance.now();
      wake();
    }
  });
  intersection.observe(host);
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      last = performance.now();
      wake();
    }
  };
  document.addEventListener("visibilitychange", visibility);
  const lost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    worldFailed();
    onLost();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let pressed: { x: number; y: number } | null = null;
  const down = (event: PointerEvent) => {
    pressed = { x: event.clientX, y: event.clientY };
  };
  const up = (event: PointerEvent) => {
    if (
      !world ||
      !pressed ||
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 8
    ) {
      pressed = null;
      return;
    }
    pressed = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const lens = raycaster.intersectObjects(world.lensTargets(), true)[0];
    if (lens?.object.userData.lens) {
      onCollect(lens.object.userData.lens as LensId);
      return;
    }
    const hit = raycaster.intersectObjects(world.stayTargets(), true)[0];
    if (hit?.object.userData.stay) onSelect(hit.object.userData.stay as StayId);
  };
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointerup", up);
  resize();

  // Every model, texture and file loaded through three's default manager feeds the arrival
  // loader's asset stage.
  DefaultLoadingManager.onProgress = (_url, loaded, total) =>
    reportLoading("assets", total ? loaded / total : 0);
  void buildWorld({
    scene,
    rig,
    interiorPractical,
    interiorShadow,
    aoHidden,
    getState: () => state,
    getOpen: () => values.open,
  })
    .then(async (built) => {
      if (disposed) {
        built.dispose();
        return;
      }
      world = built;
      reportLoading("assets", 1);
      // Compile every shader in parallel before the first frame, against the render target the
      // frames really draw into: a shader's variant depends on it (tone mapping and output
      // colour space happen in the output pass, not in each material), so compiling for the
      // screen left every program to be compiled again, one at a time and blocking, at the
      // first real frame (about 12 s on this machine).
      // Light the scene as the first frame will (the sky is baked into the environment map there,
      // which changes every material's shader), so the programs compiled now are the ones used.
      built.frame(values.hour, elapsed, false);
      pipeline.setNight(rig.apply(values.hour, elapsed, camera, true).night);
      built.afterLighting();
      renderer.setRenderTarget(pipeline.composer.readBuffer);
      const compiling = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(null);
      await compiling;
      if (disposed) return;
      reportLoading("compile", 1);
      ready = true;
      last = performance.now();
      draw(performance.now(), true);
      onReady();
      installHooks();
      introduce();
      // Three settled frames (environment baked, shadows drawn, textures uploaded) before the
      // loader reveals the island.
      let settled = 0;
      const settle = () => {
        if (disposed) return;
        draw(performance.now(), true);
        if (++settled < 3) requestAnimationFrame(settle);
        else worldReady();
      };
      requestAnimationFrame(settle);
    })
    .catch((error) => {
      console.error(error);
      worldFailed();
      if (!disposed) onLost();
    });
  /** A slow establishing dolly into the arrival view as the loader lifts (not with gentle motion). */
  function introduce() {
    if (state.selected || state.reduced || perfActive) return;
    const end = camera.position.clone();
    const start = target
      .clone()
      .add(end.clone().sub(target).multiplyScalar(1.14))
      .add(new Vector3(0, 3.5, 0));
    camera.position.copy(start);
    introTween = gsap.to(camera.position, {
      x: end.x,
      y: end.y,
      z: end.z,
      duration: 3.6,
      ease: "power2.out",
      overwrite: true,
      onUpdate: wake,
    });
  }

  function installHooks() {
    if (
      import.meta.env.MODE === "performance" &&
      document.documentElement.dataset.perf === "true"
    ) {
      void Promise.all([import("../visual/perf"), import("../visual/bookmarks")]).then(
        ([{ installPerf }, { BOOKMARKS }]) => {
          if (disposed) return;
          let savedState = state;
          let savedElapsed = elapsed;
          const savedPosition = new Vector3();
          const savedTarget = new Vector3();
          const poses: { position: Vector3; target: Vector3 }[] = [];
          detachPerf = installPerf({
            renderer,
            scene,
            camera,
            begin() {
              savedState = state;
              savedElapsed = elapsed;
              savedPosition.copy(camera.position);
              savedTarget.copy(target);
              perfActive = true;
              cancelAnimationFrame(frame);
              frame = 0;
              gsap.killTweensOf(values);
              gsap.killTweensOf(camera.position);
              gsap.killTweensOf(target);
              poses.length = 0;
              for (const bookmark of BOOKMARKS) {
                state = { ...bookmark.state, paused: false, reduced: false };
                pose(true);
                if (bookmark.camera) {
                  camera.position.set(...bookmark.camera.position);
                  target.set(...bookmark.camera.target);
                }
                poses.push({ position: camera.position.clone(), target: target.clone() });
              }
            },
            frame(seconds) {
              seconds = Math.max(0, seconds);
              const phase = (seconds % 60) / (60 / BOOKMARKS.length);
              const index = Math.floor(phase);
              const next = (index + 1) % BOOKMARKS.length;
              const bookmark = BOOKMARKS[index];
              const from = poses[index];
              const to = poses[next];
              if (!bookmark || !from || !to) throw new Error("Missing benchmark pose");
              state = { ...bookmark.state, paused: false, reduced: false };
              values.hour = state.hour;
              values.open = state.opened ? 1 : 0;
              const u = Math.max(0, ((phase % 1) - 2 / 3) * 3);
              const smooth = u * u * (3 - 2 * u);
              camera.position.lerpVectors(from.position, to.position, smooth);
              target.lerpVectors(from.target, to.target, smooth);
              elapsed = seconds;
              draw(performance.now(), true);
              return `${bookmark.id}${u > 0 ? ":transition" : ":hold"}`;
            },
            end() {
              state = savedState;
              values.hour = state.hour;
              values.open = state.opened ? 1 : 0;
              elapsed = savedElapsed;
              camera.position.copy(savedPosition);
              target.copy(savedTarget);
              perfActive = false;
              last = performance.now();
              wake();
            },
          });
        },
      );
    }
    if (import.meta.env.DEV || import.meta.env.MODE === "visual-test") {
      void Promise.all([
        import("../visual/inspection"),
        import("../visual/bookmarks"),
        import("../visual/plates"),
      ]).then(([{ installInspection }, { BOOKMARKS }, { PLATES }]) => {
        if (disposed || !world) return;
        world.labelFamilies();
        let currentBookmark = BOOKMARKS[0];
        const freeze = () => {
          state = { ...state, paused: true, reduced: true };
          elapsed = 0;
          gsap.killTweensOf(values);
          gsap.killTweensOf(camera.position);
          gsap.killTweensOf(target);
          values.hour = state.hour;
          values.open = state.opened ? 1 : 0;
          cancelAnimationFrame(frame);
          frame = 0;
        };
        const apply = async (id: string) => {
          const item = BOOKMARKS.find((bookmark) => bookmark.id === id);
          if (!item) throw new Error(`Unknown bookmark: ${id}`);
          currentBookmark = item;
          window.dispatchEvent(new CustomEvent("odd-tide-visual-state", { detail: item.state }));
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          state = { ...item.state };
          freeze();
          pose(true);
          if (item.camera) {
            gsap.killTweensOf(camera.position);
            gsap.killTweensOf(target);
            camera.position.set(...item.camera.position);
            target.set(...item.camera.target);
          }
          draw(performance.now(), true);
        };
        /** Render one still offscreen at width × height, then restore the live view. */
        const shot = async (
          spec: {
            state: unknown;
            time?: number;
            camera: {
              position: [number, number, number];
              target: [number, number, number];
              fov?: number;
            };
          },
          shotWidth: number,
          shotHeight: number,
        ) => {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          state = { ...(spec.state as IslandState) };
          freeze();
          if (typeof spec.time === "number") elapsed = spec.time;
          pose(true);
          gsap.killTweensOf(camera.position);
          gsap.killTweensOf(target);
          camera.position.set(...spec.camera.position);
          target.set(...spec.camera.target);
          const previousSize = renderer.getSize(new Vector2());
          const previousRatio = renderer.getPixelRatio();
          const previousAspect = camera.aspect;
          const previousFov = camera.fov;
          try {
            pipeline.setSize(shotWidth, shotHeight, 1);
            camera.aspect = shotWidth / shotHeight;
            if (spec.camera.fov) camera.fov = spec.camera.fov;
            camera.updateProjectionMatrix();
            // Several frames so the environment bake, shadows and AO history are settled.
            for (let i = 0; i < 6; i++) draw(performance.now(), true);
            return renderer.domElement.toDataURL("image/png");
          } finally {
            pipeline.setSize(previousSize.x, previousSize.y, previousRatio);
            camera.aspect = previousAspect;
            camera.fov = previousFov;
            camera.updateProjectionMatrix();
            draw(performance.now(), true);
          }
        };
        detachInspection = installInspection({
          renderer,
          scene,
          camera,
          bookmarks: BOOKMARKS,
          plates: PLATES,
          shot,
          apply,
          freeze,
          render: () => draw(performance.now(), true),
          current: () => ({ ...state, elapsed, inspectionCamera: !!currentBookmark?.camera }),
          lighting: async (name) => {
            const hour = { day: 9, dusk: 18.5, night: 21 }[name];
            if (hour === undefined) throw new Error(`Unknown lighting state: ${name}`);
            state = { ...state, hour };
            freeze();
            draw(performance.now(), true);
            window.dispatchEvent(new CustomEvent("odd-tide-visual-state", { detail: state }));
          },
        });
      });
    }
  }

  return {
    update(next) {
      if (perfActive) return;
      const previous = state;
      state = next;
      if (
        next.hour !== previous.hour ||
        next.opened !== previous.opened ||
        next.reduced !== previous.reduced
      )
        gsap.to(values, {
          hour: next.hour,
          open: next.opened ? 1 : 0,
          duration: next.reduced ? 0 : 0.9,
          ease: "power2.inOut",
          overwrite: true,
          onUpdate: wake,
        });
      if (lastSelected !== next.selected || lastOpened !== next.opened) pose(next.reduced);
      lastSelected = next.selected;
      lastOpened = next.opened;
      wake();
    },
    capture() {
      if (dirty && ready) {
        cancelAnimationFrame(frame);
        frame = 0;
        draw(performance.now(), true);
      }
      const previousPosition = camera.position.clone();
      const previousRotation = camera.quaternion.clone();
      const previousAspect = camera.aspect;
      const previousRatio = renderer.getPixelRatio();
      const previousSize = renderer.getSize(new Vector2());
      try {
        pipeline.setSize(1600, 800, 1);
        camera.aspect = 2;
        if (state.selected) {
          const site = new Vector3(...STAY_SITES[state.selected].position);
          const shot = STAY_CAMERAS[state.selected].closed;
          camera.position.copy(site).add(new Vector3(...shot.offset));
          camera.lookAt(site.clone().add(new Vector3(...shot.aimPortrait)));
        } else {
          camera.position.copy(ARRIVAL.desktop.position);
          camera.lookAt(ARRIVAL.desktop.target);
        }
        camera.updateProjectionMatrix();
        pipeline.render();
        return renderer.domElement.toDataURL("image/png");
      } finally {
        pipeline.setSize(previousSize.x, previousSize.y, previousRatio);
        camera.position.copy(previousPosition);
        camera.quaternion.copy(previousRotation);
        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        if (ready) pipeline.render();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      detachPerf?.();
      detachInspection?.();
      cancelAnimationFrame(frame);
      gsap.killTweensOf(values);
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(target);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      world?.dispose();
      const materials = new Set<Material>();
      const textures = new Set<Texture>();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          for (const m of Array.isArray(object.material) ? object.material : [object.material])
            materials.add(m);
        }
      });
      for (const m of materials) {
        for (const value of Object.values(m))
          if (value && typeof value === "object" && "isTexture" in value)
            textures.add(value as Texture);
        m.dispose();
      }
      for (const t of textures) t.dispose();
      disposeTextureCache();
      interiorShadow.shadow.dispose();
      rig.dispose();
      renderer.forceContextLoss();
      pipeline.dispose();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}

// ---------------------------------------------------------------------------------------------

type World = {
  frame(hour: number, time: number, animated: boolean): void;
  afterLighting(): void;
  stayTargets(): Object3D[];
  lensTargets(): Object3D[];
  labelFamilies(): void;
  dispose(): void;
};

type WorldContext = {
  scene: Scene;
  rig: LightingRig;
  interiorPractical: ReturnType<LightingRig["registerPractical"]>;
  interiorShadow: PointLight;
  aoHidden: Object3D[];
  getState(): IslandState;
  getOpen(): number;
};

const TERRAIN_TEXTURES = {
  rock: "cliff_side",
  rockAlt: "rock_face_03",
  sand: "damp_sand",
  turf: "grass_ground",
};

async function buildWorld(context: WorldContext): Promise<World> {
  const { scene, rig, aoHidden } = context;
  const root = new Group();
  root.name = "island";
  scene.add(root);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [materials, heightmap, terrainGltf, rock, rockAlt, sand, turf] = await Promise.all([
    createMaterials(),
    loadHeightmap(),
    loader.loadAsync("/models/island-terrain.glb"),
    loadPbrSet(TERRAIN_TEXTURES.rock, "2k"),
    loadPbrSet(TERRAIN_TEXTURES.rockAlt, "2k"),
    loadPbrSet(TERRAIN_TEXTURES.sand, "1k"),
    loadPbrSet(TERRAIN_TEXTURES.turf, "1k"),
  ]);
  const ground = (x: number, z: number) => heightmap.sample(x, z);

  // ---- coast: terrain, far seabed, sea, causeway stones
  const terrainUniforms: TerrainUniforms = { waterLevel: { value: 0.5 }, time: { value: 0 } };
  const terrainMaterial = createTerrainMaterial({ rock, rockAlt, sand, turf }, terrainUniforms);
  terrainGltf.scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.material = terrainMaterial;
      object.castShadow = true;
      object.receiveShadow = true;
      object.userData.visualFamily = "terrain (sandstone SDF bake)";
    }
  });
  root.add(terrainGltf.scene);
  root.add(
    farSeabed(
      createTerrainMaterial({ rock, rockAlt, sand, turf }, terrainUniforms, { flatSand: true }),
    ),
  );
  const seaUniforms = { time: { value: 0 }, level: { value: 0.5 } };
  const seaSun: SeaSun = {
    direction: { value: new Vector3(0, 1, 0) },
    irradiance: { value: new Color() },
  };
  const { mesh: sea } = createWater(heightmap, seaUniforms, seaSun);
  sea.userData.visualFamily = "sea";
  scene.add(sea);
  aoHidden.push(sea);
  root.add(causewayStones(terrainMaterial));

  // ---- paths: bridges, steps, pontoon (their heights follow the real rock)
  for (const path of PATHS) {
    const points = path.points.map(
      ([x, y, z]) => [x, y ?? ground(x, z) + 0.05, z] as [number, number, number],
    );
    const options = { width: path.width, rails: path.rails, seed: path.seed };
    root.add(
      path.kind === "stairs"
        ? buildStairs(
            materials,
            path.id,
            points[0] as [number, number, number],
            points[1] as [number, number, number],
            ground,
            options,
          )
        : buildBoardwalk(materials, path.id, points, ground, options),
    );
  }
  const pontoon = buildPontoon(materials);
  pontoon.group.position.set(1.2, 0, 13.2);
  pontoon.group.rotation.y = 0.12;
  root.add(pontoon.group);
  const buoy = buildBuoy(materials);
  buoy.position.set(-5, 0, 15);
  root.add(buoy);

  // ---- architecture: rebuilt stays (C3) or the legacy models, re-sited in metres (C2)
  const kit = materialKit();
  // Legacy lamp globes (until C3) take their brightness from exposure like every other emitter.
  const legacyGlow = rig.registerEmissive(kit.glow, 400);
  const stays: Record<StayId, Building> = STAGE.architecture
    ? {
        "weather-house": buildWeatherHouse(materials),
        "nap-observatory": buildObservatory(materials, 19, openFacing("nap-observatory")),
        "lantern-lodge": buildLodge(materials),
      }
    : legacyStays(kit);
  for (const id of Object.keys(stays) as StayId[]) {
    const building = stays[id];
    const site = STAY_SITES[id];
    building.group.position.set(...site.position);
    if (STAGE.architecture) building.group.position.y += FLOOR_LIFT[id];
    building.group.rotation.y = site.rotation;
    building.group.traverse((object) => {
      object.userData.stay = id;
    });
    root.add(building.group);
  }
  const stayLights = (Object.keys(stays) as StayId[]).map((id) => ({
    id,
    lights: stays[id].lights.map(({ light, candela }) => ({
      light,
      practical: rig.registerPractical(light, candela, 5),
    })),
    glows: stays[id].emissive.map(({ material, luminance }) =>
      rig.registerEmissive(material, luminance),
    ),
  }));
  const bath = STAGE.architecture ? buildBath(materials) : legacyBath(kit);
  bath.group.position.set(...BATH_SITE);
  if (STAGE.architecture) bath.group.position.y += 0.12;
  bath.group.rotation.y = 0.4;
  root.add(bath.group);
  const bathLights = bath.lights.map(({ light, candela }) =>
    rig.registerPractical(light, candela, 7),
  );
  const bathGlows = bath.emissive.map(({ material, luminance }) =>
    rig.registerEmissive(material, luminance),
  );

  // ---- lanterns along the Lantern Walk (switch on in order at dusk)
  const lanternSpots = PATHS.flatMap((path) => path.lanterns ?? []).map(([x, z, order]) => ({
    position: [x, ground(x, z) + 0.02, z] as [number, number, number],
    order,
  }));
  const lanterns = buildLanterns(materials, lanternSpots);
  root.add(lanterns.group);
  const lanternPracticals = lanterns.practicals.map((p) => ({
    order: p.order,
    state: rig.registerPractical(p.light, p.candela, 8),
  }));
  const lanternGlows = lanterns.glows.map((g) => ({
    order: g.order,
    state: rig.registerEmissive(g.material, g.luminance),
  }));

  // ---- discovery: lighthouse and three lens fragments
  const lighthouse = buildLighthouse(materials);
  lighthouse.group.position.set(...LIGHTHOUSE_SITE);
  root.add(lighthouse.group);
  // The beams are light in the air, not surfaces: keep them out of the AO pre-pass.
  aoHidden.push(...(lighthouse.group.getObjectByName("lighthouse-rotor")?.children ?? []));
  const beacon = rig.registerPractical(lighthouse.light, 150, 40);
  const beaconGlow = rig.registerEmissive(lighthouse.lensMaterial, 3000);
  const weather = STAY_SITES["weather-house"].position;
  const nap = STAY_SITES["nap-observatory"].position;
  const fragments = (
    [
      ["bath", [BATH_SITE[0] + 1.2, BATH_SITE[1] + 1.6, BATH_SITE[2] + 1.0]],
      ["weather", [weather[0] + 0.4, 11.4, weather[2] + 2.2]],
      ["stars", [nap[0] + 0.6, 13.6, nap[2] + 0.4]],
    ] as [LensId, [number, number, number]][]
  ).map(([id, position]) => {
    const fragment = buildLensFragment(materials);
    fragment.group.position.set(...position);
    fragment.group.traverse((object) => {
      object.userData.lens = id;
    });
    root.add(fragment.group);
    return {
      id,
      ...fragment,
      base: position[1],
      glow: rig.registerEmissive(fragment.gemMaterial, 30_000),
    };
  });

  // ---- vegetation: CC0 coastal planting (C4), kept off buildings, paths and the causeway
  const vegetation = new Group();
  vegetation.name = "vegetation";
  let plants: Awaited<ReturnType<typeof buildVegetation>> | null = null;
  if (STAGE.vegetation) {
    const bark = await loadPbrSet("bark_brown_02", "1k");
    plants = await buildVegetation({
      loader,
      ground,
      bark,
      keepouts: [
        ...(Object.keys(STAY_SITES) as StayId[]).map((id) => ({
          x: STAY_SITES[id].position[0],
          z: STAY_SITES[id].position[2],
          r: id === "lantern-lodge" ? 5.6 : 4.2,
        })),
        { x: BATH_SITE[0], z: BATH_SITE[2], r: 2.8 },
        { x: LIGHTHOUSE_SITE[0], z: LIGHTHOUSE_SITE[2], r: 1.4 },
      ],
      segments: [
        ...PATHS.flatMap((path) =>
          path.points.slice(0, -1).map((point, i) => {
            const next = path.points[i + 1] ?? point;
            return {
              a: [point[0], point[2]] as [number, number],
              b: [next[0], next[2]] as [number, number],
              r: path.width * 0.8,
            };
          }),
        ),
        ...CAUSEWAY.slice(0, -1).map((point, i) => ({
          a: point,
          b: CAUSEWAY[i + 1] ?? point,
          r: 1.2,
        })),
      ],
    });
    vegetation.add(plants.group);
    aoHidden.push(...plants.cutouts);
  } else {
    const noise = random(870);
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399;
      const r = 3 + noise() * 8;
      const x = -1.5 + Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.75;
      const y = ground(x, z);
      if (y < 3.4) continue;
      if (Math.hypot(x - weather[0], z - weather[2]) < 5) continue;
      legacyTree(vegetation, kit, x / LEGACY, y / LEGACY, z / LEGACY, 0.32 + noise() * 0.5);
    }
    vegetation.scale.setScalar(LEGACY);
  }
  root.add(vegetation);
  // A herring gull at true size circling over the home islet.
  const gull = buildGull();
  const bird = gull.group;
  root.add(bird);

  const tmp = new Vector3();
  let interiorShadowKey = "";
  let beaconTime = 0;
  let beaconAnimated = false;
  return {
    frame(hour, time, animated) {
      const state = context.getState();
      const level = waterHeight(hour) * TIDE_SCALE;
      sea.position.y = level;
      seaUniforms.level.value = level;
      seaUniforms.time.value = time;
      terrainUniforms.waterLevel.value = level;
      terrainUniforms.time.value = time;
      pontoon.setLevel(level, time, animated);
      buoy.position.y = level + (animated ? Math.sin(time * 1.3) * 0.05 : 0);
      buoy.rotation.z = animated ? Math.sin(time) * 0.08 : 0;
      // Practicals: interiors from 17:45, lanterns in order from 18:00, all by 18:40.
      const interior = clamp01((hour - 17.75) / 0.5);
      const walkOn = (order: number) => clamp01((hour - 18 - order * 0.05) / 0.25);
      const open = context.getOpen();
      let interiorKey = "off";
      for (const id of Object.keys(stays) as StayId[])
        stays[id].setOpen(id === state.selected ? open : 0);
      for (const stay of stayLights) {
        const selected = stay.id === (state.selected ?? "weather-house");
        stay.lights.forEach(({ light, practical }, index) => {
          // The selected cabin's main lamp is rendered by the shadow-casting interior light.
          const main = index === 0 && selected;
          practical.on = main ? 0 : interior;
          if (main) {
            light.getWorldPosition(tmp);
            context.interiorShadow.position.copy(tmp);
            context.interiorPractical.candela = stays[stay.id].lights[0]?.candela ?? 20;
            context.interiorPractical.on = interior;
            if (interior > 0)
              interiorKey = `${stay.id}|${open.toFixed(3)}|${tmp.x.toFixed(3)},${tmp.y.toFixed(3)},${tmp.z.toFixed(3)}`;
          }
        });
        for (const glow of stay.glows) glow.on = 0.02 + interior;
      }
      if (interiorKey !== interiorShadowKey) {
        if (interiorKey !== "off") context.interiorShadow.shadow.needsUpdate = true;
        interiorShadowKey = interiorKey;
      }
      legacyGlow.on = 0.03 + interior;
      bath.update?.(time);
      for (const light of bathLights) light.on = interior;
      for (const glow of bathGlows) glow.on = 0.02 + interior;
      for (const lantern of lanternPracticals) lantern.state.on = walkOn(lantern.order);
      for (const lantern of lanternGlows) lantern.state.on = 0.02 + walkOn(lantern.order);
      const found = state.found.length === 3;
      beacon.on = found ? 1 : 0;
      beaconAnimated = animated;
      beaconTime = time;
      // Unlit until the lens is whole: even a faint glow read as a working lamp at twilight.
      beaconGlow.on = found ? 1 : 0;
      for (const fragment of fragments) {
        fragment.group.visible =
          state.discover &&
          !state.found.includes(fragment.id) &&
          lensReady(fragment.id, state.hour);
        fragment.group.position.y = fragment.base + (animated ? Math.sin(time * 1.2) * 0.12 : 0);
        fragment.gem.rotation.y = time * 0.4;
      }
      for (const stay of Object.values(stays)) stay.update?.(time);
      plants?.update(time, animated);
      bird.position.set(
        -5.7 + Math.sin(time * 0.22) * 4,
        14 + Math.sin(time * 0.5) * 0.4,
        -0.6 + Math.cos(time * 0.22) * 2.2,
      );
      // Head along the path (forward is +Z), banked into the turn.
      bird.rotation.y = Math.atan2(Math.cos(time * 0.22) * 4, -Math.sin(time * 0.22) * 2.2);
      bird.rotation.z = -0.15;
      gull.update(time, animated);
    },
    afterLighting() {
      lighthouse.updateBeam(beacon.on, rig.sky_state.preExposure, beaconTime, beaconAnimated);
      seaSun.direction.value.copy(rig.key.position).sub(rig.key.target.position).normalize();
      seaSun.irradiance.value.copy(rig.key.color).multiplyScalar(rig.key.intensity);
    },
    stayTargets: () => Object.values(stays).map((stay) => stay.group),
    lensTargets: () => fragments.filter((f) => f.group.visible).map((f) => f.group),
    labelFamilies() {
      root.traverse((object) => {
        if (!object.userData.visualFamily) object.userData.visualFamily = "island props";
      });
      for (const [id, stay] of Object.entries(stays))
        stay.group.traverse((object) => {
          object.userData.visualFamily = `stay:${id}${STAGE.architecture ? "" : " (legacy)"}`;
        });
      bath.group.traverse((object) => {
        object.userData.visualFamily = STAGE.architecture
          ? "borrowed bath"
          : "borrowed bath (legacy)";
      });
      if (!STAGE.vegetation)
        vegetation.traverse((object) => {
          object.userData.visualFamily = "legacy foliage";
        });
    },
    dispose() {
      plants?.dispose();
      disposeMaterials(materials);
      terrainMaterial.dispose();
      heightmap.texture.dispose();
      for (const t of kit.textures) t.dispose();
    },
  };
}

/** Local yaw that turns a stay's +X axis toward its open-state camera. */
function openFacing(id: StayId) {
  const [dx, , dz] = STAY_CAMERAS[id].open.offset;
  return Math.atan2(-dz, dx) - STAY_SITES[id].rotation;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Flat seabed ring beyond the baked terrain, shaded as sand by the terrain material's flat variant. */
function farSeabed(material: Material) {
  // Starts well inside the baked rectangle (which ends 22 m out toward the camera) and sits
  // just under its edge depth, so the two seabeds overlap instead of leaving a gap.
  const geometry = new RingGeometry(19, 3000, 96, 1);
  geometry.rotateX(-Math.PI / 2);
  const count = geometry.getAttribute("position").count;
  const colours = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) colours.set([235, 255, 0, 128], i * 4);
  geometry.setAttribute("color", new BufferAttribute(colours, 4, true));
  const mesh = new Mesh(geometry, material);
  mesh.position.y = FAR_SEABED - 0.02;
  // Under 7 m of water the sun's shadow on the far seabed is invisible, and receiving it
  // printed the shadow frustum's edge as a dark arc on the sea.
  mesh.receiveShadow = false;
  mesh.name = "far-seabed";
  return mesh;
}

/** Stepping stones for the tidal causeway: flattened, weathered sandstone blocks. */
function causewayStones(material: Material) {
  const group = new Group();
  group.name = "causeway";
  const rnd = random(4410);
  for (const [x, z] of CAUSEWAY) {
    const stone = new Mesh(
      sandstoneBlock(0.55 + rnd() * 0.18, 0.5 + rnd() * 0.15, 1.9, rnd),
      material,
    );
    stone.position.set(
      x + (rnd() - 0.5) * 0.2,
      CAUSEWAY_STONE_TOP + (rnd() - 0.5) * 0.08 - 1.9,
      z + (rnd() - 0.5) * 0.2,
    );
    stone.rotation.y = rnd() * Math.PI;
    stone.castShadow = stone.receiveShadow = true;
    stone.userData.visualFamily = "causeway stones";
    group.add(stone);
  }
  return group;
}

/** A rounded, slightly irregular block with a flat top, carrying terrain vertex weights. */
function sandstoneBlock(rx: number, rz: number, height: number, rnd: () => number) {
  const segments = 28;
  const rings = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = height * t;
    const bulge = 1 - 0.12 * (1 - t) ** 2 - (t > 0.9 ? (t - 0.9) * 2.5 : 0);
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const wobble = 1 + 0.08 * Math.sin(a * 3 + rnd() * 0.3) + (rnd() - 0.5) * 0.05;
      positions.push(Math.cos(a) * rx * bulge * wobble, y, Math.sin(a) * rz * bulge * wobble);
    }
  }
  const top = positions.length / 3;
  positions.push(0, height, 0);
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < segments; s++) {
      const a = r * segments + s;
      const b = r * segments + ((s + 1) % segments);
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  for (let s = 0; s < segments; s++)
    indices.push(top, rings * segments + ((s + 1) % segments), rings * segments + s);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const count = positions.length / 3;
  const colours = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) colours.set([220, 0, 0, Math.floor(rnd() * 255)], i * 4);
  geometry.setAttribute("color", new BufferAttribute(colours, 4, true));
  return geometry;
}

/** The legacy stay models (one third of a metre per unit), wrapped as Buildings. */
function legacyStays(kit: ReturnType<typeof materialKit>): Record<StayId, Building> {
  const make = (kind: "a" | "round" | "lodge"): Building => {
    const built = legacyCabin(kit, kind);
    const outer = new Group();
    built.group.scale.setScalar(LEGACY);
    outer.add(built.group);
    const lamp = new PointLight(0xffc277, 0);
    lamp.position.set(0, 0.9 * LEGACY, 0.1 * LEGACY);
    outer.add(lamp);
    return {
      group: outer,
      setOpen(amount) {
        if (built.kind === "round") {
          built.roof.rotation.y = 2.7 + amount * 0.35;
          (built.roof.userData.shutter as Group).rotation.y = -amount * 1.65;
        } else built.roof.rotation.z = amount * 1.85;
      },
      lights: [{ light: lamp, candela: 20 }],
      emissive: [],
      focus: new Vector3(0, 1.5, 0),
    };
  };
  return {
    "weather-house": make("a"),
    "nap-observatory": make("round"),
    "lantern-lodge": make("lodge"),
  };
}

/** The legacy bath (torus and disc), kept only until the rebuilt bath lands in C3. */
function legacyBath(kit: ReturnType<typeof materialKit>): Building {
  const group = new Group();
  const inner = new Group();
  inner.scale.setScalar(LEGACY);
  group.add(inner);
  const add = (mesh: Mesh) => {
    mesh.castShadow = mesh.receiveShadow = true;
    inner.add(mesh);
    return mesh;
  };
  const tub = add(
    new Mesh(
      new SphereGeometry(0.59, 32, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
      kit.cream,
    ),
  );
  tub.scale.y = 0.6;
  tub.position.y = 0.2;
  const rim = add(new Mesh(new TorusGeometry(0.58, 0.045, 10, 36), kit.cream));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.25;
  const water = add(new Mesh(new SphereGeometry(0.51, 24, 12), kit.blue));
  water.scale.y = 0.04;
  water.position.y = 0.22;
  return { group, setOpen() {}, lights: [], emissive: [], focus: new Vector3() };
}

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  type Texture,
  Vector3,
} from "three";
import { Pipeline } from "./render/pipeline";
import { LightingRig } from "./render/rig";
import { celestial } from "./render/sky-model";

// Development-only look-dev harness (directive §3.3). It uses the island's exact renderer,
// lighting rig and post chain so materials are judged under the real conditions.

/** Published sRGB values of the 24 ColorChecker Classic patches (X-Rite / BabelColor). */
export const COLOR_CHECKER: [string, [number, number, number]][] = [
  ["dark skin", [115, 82, 68]],
  ["light skin", [194, 150, 130]],
  ["blue sky", [98, 122, 157]],
  ["foliage", [87, 108, 67]],
  ["blue flower", [133, 128, 177]],
  ["bluish green", [103, 189, 170]],
  ["orange", [214, 126, 44]],
  ["purplish blue", [80, 91, 166]],
  ["moderate red", [193, 90, 99]],
  ["purple", [94, 60, 108]],
  ["yellow green", [157, 188, 64]],
  ["orange yellow", [224, 163, 46]],
  ["blue", [56, 61, 150]],
  ["green", [70, 148, 73]],
  ["red", [175, 54, 60]],
  ["yellow", [231, 199, 31]],
  ["magenta", [187, 86, 149]],
  ["cyan", [8, 133, 161]],
  ["white 9.5", [243, 243, 242]],
  ["neutral 8", [200, 200, 200]],
  ["neutral 6.5", [160, 160, 160]],
  ["neutral 5", [122, 122, 121]],
  ["neutral 3.5", [85, 85, 85]],
  ["black 2", [52, 52, 52]],
];

export const LOOKDEV_STATES: { id: string; hour: number; label: string }[] = [
  { id: "dawn", hour: 6.5, label: "06:30 dawn" },
  { id: "day", hour: 9, label: "09:00 arrival" },
  { id: "noon", hour: 12.3, label: "12:18 solar noon" },
  { id: "afternoon", hour: 15, label: "15:00 high water" },
  { id: "dusk", hour: 18.5, label: "18:30 dusk" },
  { id: "twilight", hour: 19.25, label: "19:15 twilight" },
  { id: "night", hour: 21, label: "21:00 night" },
];

const VIEWS: Record<
  string,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  overview: { position: [0.2, 2.1, 7.4], target: [0.2, 0.75, 0] },
  materials: { position: [0.9, 1.35, 3.6], target: [0.9, 0.55, 0] },
  grazing: { position: [4.6, 0.55, 2.2], target: [0.4, 0.35, -0.2] },
};

export type LookdevSample = { name: string; build(): Group | Mesh };

export type LookdevApi = {
  ready: Promise<void>;
  states: typeof LOOKDEV_STATES;
  views: string[];
  setState(id: string): Promise<void>;
  setView(id: string): void;
  settle(frames?: number): Promise<void>;
  info(): unknown;
};
declare global {
  interface Window {
    __LOOKDEV__?: LookdevApi;
  }
}

export function mountLookdev(host: HTMLElement, samples: LookdevSample[] = []): () => void {
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.05, 40_000);
  const aoHidden: Object3D[] = [];
  const pipeline: Pipeline = new Pipeline(scene, camera, { aoHidden: () => aoHidden });
  host.append(pipeline.domElement);
  const rig: LightingRig = new LightingRig(pipeline.renderer, scene, {
    shadowCentre: new Vector3(0, 0, 0),
    shadowRadius: 6,
    shadowMapSize: 2048,
  });
  aoHidden.push(rig.sky.mesh);

  const disposable = new Set<Material>();
  const standard = (parameters: ConstructorParameters<typeof MeshStandardMaterial>[0]) => {
    const material = new MeshStandardMaterial(parameters);
    disposable.add(material);
    return material;
  };
  const add = (mesh: Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  // Neutral ground: 18% reflectance so it reads like a grey card in the frame.
  const ground = add(
    new Mesh(new CircleGeometry(60, 64), standard({ color: gray(0.18), roughness: 0.95 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;

  const greySphere = add(
    new Mesh(new SphereGeometry(0.3, 64, 32), standard({ color: gray(0.18), roughness: 0.92 })),
  );
  greySphere.position.set(-2.1, 0.3, 0.2);
  greySphere.name = "grey-18";
  const mirror = add(
    new Mesh(
      new SphereGeometry(0.3, 64, 32),
      standard({ color: 0xffffff, metalness: 1, roughness: 0.02 }),
    ),
  );
  mirror.position.set(-1.35, 0.3, 0.2);
  mirror.name = "mirror";

  // ColorChecker on a matte black board, 6 × 4, standing slightly tilted back.
  const chart = new Group();
  chart.name = "colour-checker";
  const board = new Mesh(
    new BoxGeometry(1.62, 1.1, 0.02),
    standard({ color: gray(0.035), roughness: 0.9 }),
  );
  board.castShadow = board.receiveShadow = true;
  chart.add(board);
  const patch = new BoxGeometry(0.235, 0.235, 0.006);
  COLOR_CHECKER.forEach(([name, [r, g, b]], index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const colour = new Color().setRGB(r / 255, g / 255, b / 255, "srgb");
    const mesh = new Mesh(patch, standard({ color: colour, roughness: 0.96 }));
    mesh.name = `patch:${name}`;
    mesh.position.set(-0.66 + column * 0.264, 0.4 - row * 0.264, 0.013);
    mesh.receiveShadow = true;
    chart.add(mesh);
  });
  chart.position.set(-1.72, 0.95, -1.1);
  chart.rotation.set(-0.12, 0.28, 0);
  scene.add(chart);
  for (const x of [-0.6, 0.6]) {
    const leg = add(
      new Mesh(
        new CylinderGeometry(0.018, 0.018, 1.0, 12),
        standard({ color: gray(0.05), roughness: 0.6 }),
      ),
    );
    leg.position.set(
      chart.position.x + x * Math.cos(0.28),
      0.5,
      chart.position.z - x * Math.sin(0.28) - 0.08,
    );
  }

  // A practical lamp at real scale: 2.7 m post, 25 cd bulb in a frosted globe.
  const lampGlobe = standard({ color: 0xfff4e0, emissive: 0xffc98a, roughness: 0.35 });
  const lamp = add(new Mesh(new SphereGeometry(0.07, 24, 16), lampGlobe));
  lamp.position.set(2.9, 2.35, -0.8);
  lamp.castShadow = false;
  const post = add(
    new Mesh(
      new CylinderGeometry(0.03, 0.035, 2.3, 12),
      standard({ color: gray(0.06), roughness: 0.5, metalness: 0.6 }),
    ),
  );
  post.position.set(2.9, 1.15, -0.8);
  const bulb = new PointLight(0xffb86b, 1);
  bulb.position.copy(lamp.position);
  scene.add(bulb);
  const lampState = rig.registerPractical(bulb, 25);
  const globeState = rig.registerEmissive(lampGlobe, 6000);

  // Material families (added as they are sourced), on a row of plinths.
  samples.forEach((sample, index) => {
    const object = sample.build();
    object.name = `sample:${sample.name}`;
    object.position.x += -0.3 + index * 0.72;
    object.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = child.receiveShadow = true;
        if (child.userData.water) aoHidden.push(child);
      }
    });
    scene.add(object);
  });

  let hour = 9;
  let view = "overview";
  let frame = 0;
  let disposed = false;
  const time = 0;
  const setView = (id: string) => {
    const pose = VIEWS[id];
    if (!pose) throw new Error(`Unknown look-dev view: ${id}`);
    view = id;
    camera.position.set(...pose.position);
    camera.lookAt(new Vector3(...pose.target));
  };
  const render = (force = false) => {
    const lampsOn = celestial(hour).sun.elevation < 0.05 ? 1 : 0;
    lampState.on = lampsOn;
    globeState.on = 0.02 + lampsOn;
    const sky = rig.apply(hour, time, camera, force);
    pipeline.setNight(sky.night);
    pipeline.render();
    readout.textContent = [
      `${LOOKDEV_STATES.find((s) => s.hour === hour)?.label ?? hour.toFixed(2)}`,
      `sun ${((sky.sun.elevation * 180) / Math.PI).toFixed(1)}° · ${Math.round(sky.sunLux)} lx`,
      `moon ${((sky.moon.elevation * 180) / Math.PI).toFixed(1)}° · ${sky.moonLux.toFixed(3)} lx · phase ${sky.moonPhase.toFixed(2)}`,
      `EV100 ${sky.ev100.toFixed(2)} · pre-exposure ${sky.preExposure.toExponential(2)}`,
      `calls ${pipeline.renderer.info.render.calls} · tris ${pipeline.renderer.info.render.triangles}`,
    ].join("\n");
  };
  const loop = () => {
    frame = 0;
    if (disposed) return;
    render();
  };
  const resize = () => {
    const rect = host.getBoundingClientRect();
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
    pipeline.setSize(rect.width, rect.height, window.devicePixelRatio);
    if (!frame) frame = requestAnimationFrame(loop);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const panel = document.createElement("div");
  panel.className = "lookdev-panel";
  panel.style.cssText =
    "position:fixed;left:12px;top:12px;z-index:5;display:flex;flex-direction:column;gap:6px;font:12px/1.35 ui-monospace,monospace;color:#f4f1e8";
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;max-width:520px";
  for (const state of LOOKDEV_STATES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = state.label;
    button.style.cssText =
      "padding:4px 8px;border-radius:4px;border:0;background:#1d2b2a;color:#f4f1e8;cursor:pointer";
    button.onclick = () => void api.setState(state.id);
    buttons.append(button);
  }
  for (const id of Object.keys(VIEWS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `view: ${id}`;
    button.style.cssText =
      "padding:4px 8px;border-radius:4px;border:0;background:#3b2d22;color:#f4f1e8;cursor:pointer";
    button.onclick = () => {
      setView(id);
      render();
    };
    buttons.append(button);
  }
  const readout = document.createElement("pre");
  readout.style.cssText =
    "margin:0;padding:6px 8px;background:rgba(10,16,16,.72);border-radius:4px;white-space:pre";
  panel.append(buttons, readout);
  document.body.append(panel);

  const api: LookdevApi = {
    ready: Promise.all([document.fonts.ready, pipeline.renderer.compileAsync(scene, camera)]).then(
      () => undefined,
    ),
    states: LOOKDEV_STATES,
    views: Object.keys(VIEWS),
    async setState(id) {
      const state = LOOKDEV_STATES.find((item) => item.id === id);
      if (!state) throw new Error(`Unknown lighting state: ${id}`);
      hour = state.hour;
      render(true);
    },
    setView(id) {
      setView(id);
      render(true);
    },
    async settle(frames = 20) {
      for (let i = 0; i < frames; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        render(i === 0);
      }
    },
    info() {
      const gl = pipeline.renderer.getContext();
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        hour,
        view,
        sky: rig.sky_state,
        drawingBuffer: { width: pipeline.domElement.width, height: pipeline.domElement.height },
        renderInfo: { ...pipeline.renderer.info.render },
        memory: { ...pipeline.renderer.info.memory },
        samples: samples.map((sample) => sample.name),
      };
    },
  };
  window.__LOOKDEV__ = api;
  setView("overview");

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    panel.remove();
    const textures = new Set<Texture>();
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const value of Object.values(material))
            if (value && typeof value === "object" && "isTexture" in value)
              textures.add(value as Texture);
          disposable.add(material);
        }
      }
    });
    for (const texture of textures) texture.dispose();
    rig.dispose(disposable);
    pipeline.dispose();
    pipeline.domElement.remove();
    if (window.__LOOKDEV__ === api) delete window.__LOOKDEV__;
  };
}

function gray(reflectance: number) {
  return new Color(reflectance, reflectance, reflectance);
}

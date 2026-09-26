import { gsap } from "gsap";
import {
  Group,
  IcosahedronGeometry,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { type LensId, lensReady, type StayId, waterHeight } from "../domain";
import { box, cabin, gull, islet, materialKit, random, rod, tree } from "./objects";
import { Pipeline } from "./render/pipeline";
import { LightingRig } from "./render/rig";
import { createWater, flatHeightmap } from "./water";

/** The legacy scene was modelled at one third of a metre per unit; the rig works in metres. */
const S = 3;

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
const LOCATIONS: Record<StayId, [number, number, number]> = {
  "weather-house": [-0.8, 1.74, 0.25],
  "nap-observatory": [4.4, 2.34, -2.9],
  "lantern-lodge": [3.5, 1.44, 2.7],
};

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
  const target = new Vector3(0.8, 0.2, 0).multiplyScalar(S);
  camera.position.set(15, 13.5, 22).multiplyScalar(S);
  const aoHidden: Object3D[] = [];
  const pipeline: Pipeline = new Pipeline(scene, camera, { aoHidden: () => aoHidden });
  const renderer = pipeline.renderer;
  renderer.domElement.setAttribute("aria-label", "Interactive miniature of the Odd Tide island");
  renderer.domElement.style.touchAction = "pan-y";
  host.append(renderer.domElement);
  const root = new Group();
  root.scale.setScalar(S);
  scene.add(root);
  const kit = materialKit();
  const rig: LightingRig = new LightingRig(renderer, scene, {
    shadowCentre: new Vector3(1.5, 0, 0.5),
    shadowRadius: 27,
    shadowMapSize: 2048,
  });
  aoHidden.push(rig.sky.mesh);
  // Lamp globes, beacon lens and bridge bulbs: emissive luminance, pre-exposed by the rig.
  const glow = rig.registerEmissive(kit.glow, 3500);
  islet(root, kit, 0, 0, 3.05, 2.5, 1.8, 45);
  islet(root, kit, 4.4, -2.9, 2.0, 1.9, 2.4, 92);
  islet(root, kit, 3.5, 2.7, 2.3, 1.75, 1.5, 217);
  islet(root, kit, -5.0, 2.2, 1.15, 1.3, 1.3, 76);
  const buildings = {
    "weather-house": cabin(kit, "a"),
    "nap-observatory": cabin(kit, "round"),
    "lantern-lodge": cabin(kit, "lodge"),
  };
  const roomLights: ReturnType<LightingRig["registerPractical"]>[] = [];
  for (const id of Object.keys(buildings) as StayId[]) {
    const item = buildings[id];
    item.group.position.set(...LOCATIONS[id]);
    item.group.rotation.y = id === "weather-house" ? -0.3 : id === "lantern-lodge" ? 0.15 : 0.35;
    item.group.userData.stay = id;
    item.group.traverse((object) => {
      object.userData.stay = id;
    });
    root.add(item.group);
    const lamp = new PointLight("#ffc277", 0);
    lamp.position.set(0, 0.9, 0.1);
    item.group.add(lamp);
    roomLights.push(rig.registerPractical(lamp, 60));
  }
  const bath = new Group();
  bath.position.set(-5.0, 1.2, 2.2);
  root.add(bath);
  const tub = new Mesh(
    new SphereGeometry(0.59, 32, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    kit.cream,
  );
  tub.scale.y = 0.6;
  bath.add(tub);
  const bathRim = new Mesh(new TorusGeometry(0.58, 0.045, 10, 36), kit.cream);
  bathRim.rotation.x = Math.PI / 2;
  bathRim.position.y = 0.05;
  bath.add(bathRim);
  const bathWater = new Mesh(new SphereGeometry(0.51, 24, 12), kit.blue);
  bathWater.scale.y = 0.04;
  bathWater.position.y = 0.02;
  bath.add(bathWater);
  for (let i = 0; i < 9; i++) box(bath, kit.board, [1.5, 0.06, 0.14], [0, -0.17, -0.6 + i * 0.15]);
  const bathAwning = box(bath, kit.tile, [1.55, 0.09, 0.6], [0, 1.14, -0.47]);
  bathAwning.rotation.x = -0.14;
  for (const x of [-0.66, 0.66])
    rod(bath, kit.dark, new Vector3(x, -0.2, -0.55), new Vector3(x, 1.1, -0.55));
  const stones: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const stone = new Mesh(new IcosahedronGeometry(0.29, 1), kit.sand);
    stone.scale.set(1, 0.28, 0.9);
    stone.position.set(-2.1 - t * 1.94, 0.45, 1.4 + t * 0.63);
    stone.rotation.y = i * 0.3;
    stone.castShadow = true;
    stone.receiveShadow = true;
    root.add(stone);
    stones.push(stone);
  }
  const lamps: { bulb: Mesh; state: ReturnType<LightingRig["registerEmissive"]> }[] = [];
  const bridge = (from: Vector3, to: Vector3) => {
    const direction = to.clone().sub(from);
    const length = direction.length();
    const count = Math.ceil(length / 0.14);
    for (let i = 0; i <= count; i++) {
      const pos = from.clone().lerp(to, i / count);
      const plank = box(root, kit.board, [0.76, 0.06, 0.11], [pos.x, pos.y, pos.z]);
      plank.rotation.y = Math.atan2(direction.x, direction.z);
      if (i % 7 === 0) {
        rod(
          root,
          kit.dark,
          pos.clone().add(new Vector3(0.34, -0.7, 0)),
          pos.clone().add(new Vector3(0.34, 0.5, 0)),
          0.032,
        );
        const bulbMat = kit.glow.clone();
        const bulb = new Mesh(new SphereGeometry(0.075, 12, 10), bulbMat);
        bulb.position.copy(pos).add(new Vector3(0.34, 0.56, 0));
        root.add(bulb);
        lamps.push({ bulb, state: rig.registerEmissive(bulbMat as MeshStandardMaterial, 3500) });
      }
    }
  };
  bridge(new Vector3(1.6, 1.75, -1.25), new Vector3(3.4, 2.15, -2.25));
  bridge(new Vector3(1.3, 1.65, 1.4), new Vector3(2.8, 1.4, 2.1));
  const floatDeck = new Group();
  floatDeck.position.set(-1.1, 0.3, 3.5);
  root.add(floatDeck);
  for (let i = 0; i < 10; i++) box(floatDeck, kit.board, [1.4, 0.08, 0.14], [0, 0, i * 0.15]);
  for (const x of [-0.8, 0.8])
    rod(root, kit.dark, new Vector3(-1.1 + x, -0.3, 4), new Vector3(-1.1 + x, 1.5, 4), 0.045);
  const noise = random(870);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399;
    const r = 1.5 + noise() * 1.0;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x + 0.8) < 1.35 && Math.abs(z - 0.25) < 1.25) continue;
    if (z > 0.2 && x < 1.0) continue;
    tree(root, kit, x, 1.68, z, 0.32 + noise() * 0.55);
  }
  for (let i = 0; i < 7; i++)
    tree(root, kit, 4.4 + Math.cos(i) * 1.4, 2.28, -2.9 + Math.sin(i) * 1.2, 0.4 + noise() * 0.2);
  for (let i = 0; i < 34; i++) {
    const a = noise() * Math.PI * 2;
    const r = 3.2 + noise() * 0.5;
    const rock = new Mesh(
      new IcosahedronGeometry(0.3 + noise() * 0.3, 1),
      i % 2 ? kit.rock : kit.sand,
    );
    rock.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r * 0.8);
    rock.scale.y = 0.6 + noise();
    rock.rotation.set(noise(), noise(), noise());
    rock.castShadow = true;
    root.add(rock);
  }
  const weatherVane = new Group();
  weatherVane.position.set(-2.2, 1.7, -0.25);
  root.add(weatherVane);
  rod(weatherVane, kit.brass, new Vector3(), new Vector3(0, 2.2, 0), 0.024);
  const vane = box(weatherVane, kit.brass, [0.7, 0.04, 0.04], [0, 2.2, 0]);
  const bird = gull(kit);
  bird.position.set(-1.9, 4.7, -0.2);
  root.add(bird);
  const buoy = new Mesh(new SphereGeometry(0.19, 16, 12), kit.tile);
  buoy.scale.set(0.7, 1, 0.7);
  buoy.position.set(-4, 0.3, 4.5);
  root.add(buoy);
  const lighthouse = new Group();
  lighthouse.position.set(5.35, 2.3, -3.65);
  root.add(lighthouse);
  box(lighthouse, kit.cream, [0.25, 0.75, 0.25], [0, 0.35, 0]);
  const lens = new Mesh(new SphereGeometry(0.13, 16, 12), kit.glow);
  lens.position.y = 0.85;
  lighthouse.add(lens);
  const beaconLight = new PointLight("#ffc979", 0);
  beaconLight.position.copy(lighthouse.position).add(new Vector3(0, 0.85, 0));
  root.add(beaconLight);
  const beacon = rig.registerPractical(beaconLight, 400);
  // Discovery markers must read by day too: a brighter emissive of their own.
  const gemMaterial = kit.glow.clone() as MeshStandardMaterial;
  rig.registerEmissive(gemMaterial, 40_000);
  const fragments: { id: LensId; group: Group; gem: Mesh; base: number }[] = [];
  const fragmentPositions: [LensId, number, number, number][] = [
    ["bath", -4.7, 1.5, 2.55],
    ["weather", -2.2, 4.1, -0.25],
    ["stars", 4.65, 4.5, -2.75],
  ];
  for (const [id, x, y, z] of fragmentPositions) {
    const group = new Group();
    group.position.set(x, y, z);
    const gem = new Mesh(new OctahedronGeometry(0.17), gemMaterial);
    const ring = new Mesh(new TorusGeometry(0.28, 0.012, 8, 32), kit.brass);
    group.add(gem, ring);
    group.traverse((object) => {
      object.userData.lens = id;
    });
    root.add(group);
    fragments.push({ id, group, gem, base: y });
  }
  const seaUniforms = { time: { value: 0 }, level: { value: waterHeight(initialState.hour) * S } };
  // Change 1 keeps the legacy islets, so the sea sees a uniform 4 m depth until the new coast.
  const { mesh: sea } = createWater(flatHeightmap(-4), seaUniforms);
  scene.add(sea);
  aoHidden.push(sea);
  let state: IslandState = initialState;
  const values = { hour: initialState.hour, open: initialState.opened ? 1 : 0 };
  let width = 1,
    height = 1,
    visible = true,
    disposed = false,
    dirty = true,
    frame = 0,
    last = performance.now(),
    elapsed = 0;
  let perfActive = false;
  let lastSelected: StayId | null | undefined;
  let lastOpened = false;
  const wake = () => {
    dirty = true;
    if (perfActive) return;
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw);
  };
  const pose = (instant: boolean) => {
    const portrait = width <= 1100;
    const point = state.selected
      ? new Vector3(...LOCATIONS[state.selected])
      : new Vector3(1, 0.4, 0);
    const destination = state.selected
      ? point
          .clone()
          .add(
            new Vector3(
              state.selected === "weather-house" ? -4 : 5,
              state.opened ? 5.8 : 4.2,
              state.opened ? 8.5 : 7,
            ),
          )
      : portrait
        ? new Vector3(16, 18, 26).multiplyScalar(Math.max(0.58, (height / 515) * (390 / width)))
        : new Vector3(15, 13.5, 22);
    const screenRight = new Vector3(
      destination.z - point.z,
      0,
      point.x - destination.x,
    ).normalize();
    const aim = state.selected
      ? point
          .clone()
          .add(new Vector3(0, state.opened ? 1.05 : 0.7, 0))
          .addScaledVector(screenRight, portrait ? 0 : -2.5)
      : new Vector3(portrait ? 0.7 : -0.65, 0.4, 0);
    destination.multiplyScalar(S);
    aim.multiplyScalar(S);
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
    frame = 0;
    if (disposed || (!captureFrame && (!visible || document.hidden))) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    const animated = !state.paused && !state.reduced;
    if (animated && !perfActive) elapsed += delta;
    const visualHour = captureFrame ? state.hour : values.hour;
    const level = waterHeight(visualHour);
    sea.position.y = level * S;
    seaUniforms.level.value = level * S;
    seaUniforms.time.value = elapsed;
    floatDeck.position.y = level + 0.13;
    buoy.position.y = level + 0.08 + (animated ? Math.sin(elapsed * 1.3) * 0.025 : 0);
    buoy.rotation.z = Math.sin(elapsed) * 0.08;
    for (const stone of stones) stone.visible = level < 0.74;
    // Practicals switch on as the day falls; their brightness comes only from exposure.
    const lampsOn = Math.min(1, Math.max(0, (visualHour - 17.6) / 0.8));
    for (const light of roomLights) light.on = lampsOn;
    glow.on = 0.04 + 0.96 * lampsOn;
    lamps.forEach((lamp, i) => {
      lamp.state.on = Math.min(1, Math.max(0.03, lampsOn * 1.4 - i * 0.05));
    });
    beacon.on = state.found.length === 3 ? 1 : 0;
    const sky = rig.apply(visualHour, elapsed, camera, captureFrame);
    pipeline.setNight(sky.night);
    for (const id of Object.keys(buildings) as StayId[]) {
      const b = buildings[id],
        amount = id === state.selected ? values.open : 0;
      if (b.kind === "round") {
        b.roof.rotation.y = 2.7 + amount * 0.35;
        (b.roof.userData.shutter as Group).rotation.y = -amount * 1.65;
      } else b.roof.rotation.z = amount * 1.85;
    }
    vane.rotation.y = Math.sin(elapsed * 0.4) * 0.4;
    bird.position.x = -1.9 + Math.sin(elapsed * 0.22) * 1.3;
    bird.position.z = -0.2 + Math.cos(elapsed * 0.22) * 0.7;
    bird.rotation.y = -elapsed * 0.22;
    for (const fragment of fragments) {
      fragment.group.visible =
        state.discover && !state.found.includes(fragment.id) && lensReady(fragment.id, state.hour);
      fragment.group.position.y = fragment.base + Math.sin(elapsed * 1.2) * 0.06;
      fragment.group.lookAt(camera.position);
      fragment.gem.rotation.y = elapsed * 0.4;
    }
    camera.lookAt(target);
    pipeline.render();
    dirty = false;
    if (animated && !perfActive && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    pipeline.setSize(width, height, window.devicePixelRatio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pose(true);
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
    if (!pressed || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 8) {
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
    const lensHit = raycaster.intersectObjects(
      fragments.filter((item) => item.group.visible).map((item) => item.group),
      true,
    )[0];
    if (lensHit?.object.userData.lens) {
      onCollect(lensHit.object.userData.lens as LensId);
      return;
    }
    const hit = raycaster.intersectObjects(
      Object.values(buildings).map((item) => item.group),
      true,
    )[0];
    if (hit?.object.userData.stay) onSelect(hit.object.userData.stay as StayId);
  };
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointerup", up);
  resize();
  cancelAnimationFrame(frame);
  frame = 0;
  draw(performance.now());
  onReady();
  let detachInspection: (() => void) | undefined;
  let detachPerf: (() => void) | undefined;
  if (import.meta.env.MODE === "performance" && document.documentElement.dataset.perf === "true") {
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
                camera.position.set(...bookmark.camera.position).multiplyScalar(S);
                target.set(...bookmark.camera.target).multiplyScalar(S);
              }
              poses.push({ position: camera.position.clone(), target: target.clone() });
            }
          },
          frame(seconds) {
            // A first rAF timestamp can precede setup's performance.now within the same frame.
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
            // Hold each bookmark for 4 seconds, then travel for 2. Same path on every run.
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
    void Promise.all([import("../visual/inspection"), import("../visual/bookmarks")]).then(
      ([{ installInspection }, { BOOKMARKS }]) => {
        if (disposed) return;
        root.traverse((object) => {
          object.userData.visualFamily = "site fixtures and decoration";
        });
        for (const child of root.children) {
          if (
            child instanceof Group &&
            child.children.some(
              (object) => object instanceof Mesh && object.geometry.type === "ExtrudeGeometry",
            )
          )
            child.traverse((object) => {
              object.userData.visualFamily = "terrain strata and rock fragments";
            });
          if (
            child instanceof Group &&
            child.children.some(
              (object) =>
                object instanceof Mesh &&
                (object.material === kit.leaf || object.material === kit.leafLight),
            )
          )
            child.traverse((object) => {
              object.userData.visualFamily = "foliage";
            });
        }
        for (const [id, building] of Object.entries(buildings))
          building.group.traverse((object) => {
            object.userData.visualFamily = `cabin:${id}`;
          });
        bath.traverse((object) => {
          object.userData.visualFamily = "borrowed bath";
        });
        sea.userData.visualFamily = "shader water";
        for (const fragment of fragments)
          fragment.group.traverse((object) => {
            object.userData.visualFamily = "discovery markers";
          });
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
            camera.position.set(...item.camera.position).multiplyScalar(S);
            target.set(...item.camera.target).multiplyScalar(S);
          }
          draw(performance.now(), true);
        };
        detachInspection = installInspection({
          renderer,
          scene,
          camera,
          bookmarks: BOOKMARKS,
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
      },
    );
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
      if (dirty) {
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
        const point = state.selected
          ? new Vector3(...LOCATIONS[state.selected])
          : new Vector3(0.7, 0.3, 0);
        camera.position
          .copy(point)
          .add(
            state.selected
              ? new Vector3(state.selected === "weather-house" ? -4 : 5, 4.8, 8)
              : new Vector3(15, 13.5, 22),
          )
          .multiplyScalar(S);
        camera.lookAt(
          point
            .clone()
            .add(new Vector3(0, 0.5, 0))
            .multiplyScalar(S),
        );
        camera.updateProjectionMatrix();
        pipeline.render();
        return renderer.domElement.toDataURL("image/png");
      } finally {
        pipeline.setSize(previousSize.x, previousSize.y, previousRatio);
        camera.position.copy(previousPosition);
        camera.quaternion.copy(previousRotation);
        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        pipeline.render();
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
      const materials = new Set<Material>(),
        textures = new Set<Texture>();
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
      for (const t of kit.textures) if (!textures.has(t)) t.dispose();
      rig.dispose();
      renderer.forceContextLoss();
      pipeline.dispose();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}

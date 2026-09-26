import { gsap } from "gsap";
import {
  AgXToneMapping,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  OctahedronGeometry,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { type LensId, lensReady, type StayId, waterHeight } from "../domain";
import { box, cabin, gull, islet, materialKit, random, rod, tree } from "./objects";

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
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute("aria-label", "Interactive miniature of the Odd Tide island");
  renderer.domElement.style.touchAction = "pan-y";
  host.append(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color("#b5d4c8");
  scene.fog = new Fog("#b5d4c8", 30, 90);
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const target = new Vector3(0.8, 0.2, 0);
  camera.position.set(15, 13.5, 22);
  const root = new Group();
  scene.add(root);
  const kit = materialKit();
  const environment = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment, 0.06);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.42;
  environment.dispose();
  pmrem.dispose();
  const hemi = new HemisphereLight("#d7edea", "#324b40", 1.6);
  scene.add(hemi);
  const sun = new DirectionalLight("#ffe4b8", 4.1);
  sun.position.set(-7, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  islet(root, kit, 0, 0, 3.05, 2.5, 1.8, 45);
  islet(root, kit, 4.4, -2.9, 2.0, 1.9, 2.4, 92);
  islet(root, kit, 3.5, 2.7, 2.3, 1.75, 1.5, 217);
  islet(root, kit, -5.0, 2.2, 1.15, 1.3, 1.3, 76);
  const buildings = {
    "weather-house": cabin(kit, "a"),
    "nap-observatory": cabin(kit, "round"),
    "lantern-lodge": cabin(kit, "lodge"),
  };
  const roomLights: PointLight[] = [];
  for (const id of Object.keys(buildings) as StayId[]) {
    const item = buildings[id];
    item.group.position.set(...LOCATIONS[id]);
    item.group.rotation.y = id === "weather-house" ? -0.3 : id === "lantern-lodge" ? 0.15 : 0.35;
    item.group.userData.stay = id;
    item.group.traverse((object) => {
      object.userData.stay = id;
    });
    root.add(item.group);
    const lamp = new PointLight("#ffc277", 0, 3.5, 2);
    lamp.position.set(0, 0.9, 0.1);
    item.group.add(lamp);
    roomLights.push(lamp);
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
  const lamps: { bulb: Mesh; material: MeshStandardMaterial }[] = [];
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
        lamps.push({ bulb, material: bulbMat });
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
  const beacon = new PointLight("#ffc979", 0, 8, 2);
  beacon.position.copy(lighthouse.position).add(new Vector3(0, 0.85, 0));
  root.add(beacon);
  const fragments: { id: LensId; group: Group; gem: Mesh; base: number }[] = [];
  const fragmentPositions: [LensId, number, number, number][] = [
    ["bath", -4.7, 1.5, 2.55],
    ["weather", -2.2, 4.1, -0.25],
    ["stars", 4.65, 4.5, -2.75],
  ];
  for (const [id, x, y, z] of fragmentPositions) {
    const group = new Group();
    group.position.set(x, y, z);
    const gem = new Mesh(new OctahedronGeometry(0.17), kit.glow);
    const ring = new Mesh(new TorusGeometry(0.28, 0.012, 8, 32), kit.brass);
    group.add(gem, ring);
    group.traverse((object) => {
      object.userData.lens = id;
    });
    root.add(group);
    fragments.push({ id, group, gem, base: y });
  }
  const waterUniforms = {
    time: { value: 0 },
    dusk: { value: 0 },
    colour: { value: new Color("#479f91") },
    sky: { value: new Color("#b5d4c8") },
  };
  const waterMaterial = new ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec3 vWorld; void main(){ vec4 p=modelMatrix*vec4(position,1.0); vWorld=p.xyz; gl_Position=projectionMatrix*viewMatrix*p; }`,
    fragmentShader: `uniform float time; uniform float dusk; uniform vec3 colour; uniform vec3 sky; varying vec3 vWorld;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    float shelf(vec2 p,vec2 centre,vec2 size){return 1.-smoothstep(.8,1.4,length((p-centre)/size));}
    void main(){
      vec2 p=vWorld.xz;
      float broad=noise(p*.23+time*.018);
      float swell=sin(p.y*2.8+p.x*.8+noise(p*.6)*5.-time*.45);
      float crests=smoothstep(.91,.998,swell)*smoothstep(.42,.76,noise(p*vec2(.65,2.1)+time*.03));
      float shallow=max(shelf(p,vec2(0.),vec2(3.6,3.1)),max(shelf(p,vec2(4.4,-2.9),vec2(2.5,2.4)),max(shelf(p,vec2(3.5,2.7),vec2(2.7,2.2)),shelf(p,vec2(-5.,2.2),vec2(1.5,1.6)))));
      vec3 c=mix(colour,vec3(.35,.62,.49),shallow*.45);
      c+=(broad-.5)*.055+crests*.042;
      c=mix(c,c*vec3(.3,.46,.62),dusk*.8);
      c=mix(c,sky,smoothstep(28.,95.,distance(vWorld,cameraPosition)));
      gl_FragColor=vec4(c,.96);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const sea = new Mesh(new PlaneGeometry(500, 500), waterMaterial);
  sea.rotation.x = -Math.PI / 2;
  root.add(sea);
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
  let lastSelected: StayId | null | undefined;
  let lastOpened = false;
  const wake = () => {
    dirty = true;
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
    frame = 0;
    if (disposed || (!captureFrame && (!visible || document.hidden))) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    const animated = !state.paused && !state.reduced;
    if (animated) elapsed += delta;
    const visualHour = captureFrame ? state.hour : values.hour;
    const level = waterHeight(visualHour);
    const dusk = Math.max(0, Math.min(1, (visualHour - 16.5) / 4));
    sea.position.y = level;
    waterUniforms.time.value = elapsed;
    waterUniforms.dusk.value = dusk;
    floatDeck.position.y = level + 0.13;
    buoy.position.y = level + 0.08 + (animated ? Math.sin(elapsed * 1.3) * 0.025 : 0);
    buoy.rotation.z = Math.sin(elapsed) * 0.08;
    for (const stone of stones) stone.visible = level < 0.74;
    scene.background = new Color("#b5d4c8").lerp(new Color("#5b7883"), dusk);
    if (scene.fog instanceof Fog) scene.fog.color.copy(scene.background);
    waterUniforms.sky.value.copy(scene.background);
    sun.color.set("#ffe4b8").lerp(new Color("#e69373"), dusk);
    sun.intensity = 4.1 - dusk * 3.95;
    sun.position.set(-7 - dusk * 3, 12 - dusk * 9, 9);
    hemi.intensity = 1.6 - dusk * 1.35;
    scene.environmentIntensity = 0.42 - dusk * 0.3;
    roomLights.forEach((light) => {
      light.intensity = dusk * 3;
    });
    kit.glow.emissiveIntensity = 0.3 + dusk * 2.6;
    lamps.forEach((lamp, i) => {
      lamp.material.emissiveIntensity = Math.max(0.1, dusk * 4 - i * 0.06);
    });
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
    beacon.intensity = state.found.length === 3 ? 12 : 0;
    for (const fragment of fragments) {
      fragment.group.visible =
        state.discover && !state.found.includes(fragment.id) && lensReady(fragment.id, state.hour);
      fragment.group.position.y = fragment.base + Math.sin(elapsed * 1.2) * 0.06;
      fragment.group.lookAt(camera.position);
      fragment.gem.rotation.y = elapsed * 0.4;
    }
    camera.lookAt(target);
    renderer.render(scene, camera);
    dirty = false;
    if (animated && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    renderer.setSize(width, height);
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
  return {
    update(next) {
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
        renderer.setPixelRatio(1);
        renderer.setSize(1600, 800, false);
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
          );
        camera.lookAt(point.clone().add(new Vector3(0, 0.5, 0)));
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL("image/png");
      } finally {
        renderer.setPixelRatio(previousRatio);
        renderer.setSize(previousSize.x, previousSize.y, false);
        camera.position.copy(previousPosition);
        camera.quaternion.copy(previousRotation);
        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
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
      env.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}

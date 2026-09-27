import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  type MeshStandardMaterial,
  OctahedronGeometry,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import type { Materials } from "../materials";
import {
  Batch,
  catenary,
  compose,
  fastenerGeometry,
  instances,
  metricUVs,
  rng,
  type Vec3,
} from "./kit";

// Island props at real scale: boardwalks and bridges that follow authored paths and stand on
// the actual rock or seabed, lantern posts for the Lantern Walk, a floating pontoon, the
// lighthouse beacon for the discovery ending, lens fragments and a mooring buoy.

export type GroundSampler = (x: number, z: number) => number;
export type Practical = { light: PointLight; candela: number; order: number };
export type Glow = { material: MeshStandardMaterial; luminance: number; order: number };

/** A walkway along 'points' (x, deck height, z), width in metres, posts down to the ground. */
export function buildBoardwalk(
  mats: Materials,
  name: string,
  points: Vec3[],
  ground: GroundSampler,
  options: { width?: number; rails?: boolean; seed?: number } = {},
) {
  const width = options.width ?? 1.2;
  const random = rng(options.seed ?? 5);
  const group = new Group();
  group.name = name;
  const deck = new Batch(`${name}-deck`, mats.deck, 1.4, (options.seed ?? 5) + 1);
  const structure = new Batch(`${name}-structure`, mats.structural, 1.4, (options.seed ?? 5) + 2);
  const ropes = new Batch(`${name}-rope`, mats.rope, 0.5, (options.seed ?? 5) + 3);
  const screws: { position: Vec3; rotation?: Vec3 }[] = [];
  const postTops: { left: Vec3; right: Vec3 }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = new Vector3(...(points[i] as Vec3));
    const b = new Vector3(...(points[i + 1] as Vec3));
    const run = b.clone().sub(a);
    const length = run.length();
    const yaw = Math.atan2(run.x, run.z);
    const pitch = Math.asin(run.y / length);
    const along = run.clone().normalize();
    const side = new Vector3(along.z, 0, -along.x).normalize();
    // Boards across the walk.
    for (let d = 0.07; d < length; d += 0.146) {
      const p = a.clone().addScaledVector(along, d);
      deck.box([width, 0.028, 0.136], [p.x, p.y, p.z], [pitch, yaw, 0], {
        radius: 0.003,
        vary: 0.12,
      });
      for (const s of [-0.42, 0.42]) {
        const q = p.clone().addScaledVector(side, s * width);
        screws.push({ position: [q.x, q.y + 0.015, q.z], rotation: [pitch, yaw, 0] });
      }
    }
    // Stringers under the boards.
    for (const s of [-0.4, 0.4]) {
      const o = side.clone().multiplyScalar(s * width);
      const mid = a.clone().add(b).multiplyScalar(0.5).add(o);
      structure.box([0.06, 0.18, length], [mid.x, mid.y - 0.11, mid.z], [-pitch, yaw, 0], {
        radius: 0.004,
      });
    }
    // Posts every ~1.6 m, from the deck down into rock or seabed.
    const posts = Math.max(1, Math.round(length / 1.6));
    for (let k = i === 0 ? 0 : 1; k <= posts; k++) {
      const p = a.clone().addScaledVector(along, (k / posts) * length);
      for (const s of [-0.48, 0.48]) {
        const q = p.clone().addScaledVector(side, s * width);
        const bottom = Math.min(ground(q.x, q.z), q.y - 0.3) - 0.5;
        const top = options.rails ? q.y + 0.95 : q.y - 0.02;
        structure.box(
          [0.1, top - bottom, 0.1],
          [q.x, (top + bottom) / 2, q.z],
          [0, yaw + (random() - 0.5) * 0.04, 0],
          { radius: 0.01, vary: 0.12 },
        );
      }
      if (options.rails) {
        const l = p.clone().addScaledVector(side, -0.48 * width);
        const r = p.clone().addScaledVector(side, 0.48 * width);
        postTops.push({ left: [l.x, l.y + 0.88, l.z], right: [r.x, r.y + 0.88, r.z] });
      }
    }
  }
  for (let i = 0; i < postTops.length - 1; i++) {
    const a = postTops[i] as { left: Vec3; right: Vec3 };
    const b = postTops[i + 1] as { left: Vec3; right: Vec3 };
    ropes.add(catenary(a.left, b.left, 0.09, 0.016, 10));
    ropes.add(catenary(a.right, b.right, 0.09, 0.016, 10));
  }
  for (const batch of [deck, structure, ropes]) {
    const mesh = batch.build();
    if (mesh) group.add(mesh);
  }
  if (screws.length) group.add(instances(`${name}-screws`, fastenerGeometry(), mats.steel, screws));
  return group;
}

/** Lantern posts: merged posts/heads plus one practical and one glowing chimney each. */
export function buildLanterns(
  mats: Materials,
  spots: { position: Vec3; order: number }[],
  seed = 71,
) {
  const group = new Group();
  group.name = "lanterns";
  const posts = new Batch("lantern-posts", mats.structural, 1.2, seed);
  const metal = new Batch("lantern-metal", mats.steel, 0.4, seed + 1);
  const practicals: Practical[] = [];
  const glows: Glow[] = [];
  const chimney = new CylinderGeometry(0.045, 0.045, 0.13, 16);
  for (const { position, order } of spots) {
    const [x, y, z] = position;
    posts.box([0.09, 1.55, 0.09], [x, y + 0.775, z], [0, 0, 0], { radius: 0.012, vary: 0.12 });
    posts.box([0.28, 0.06, 0.06], [x + 0.1, y + 1.5, z], [0, 0, 0], { radius: 0.008 });
    // Hanging lantern: cap, frame, base, glass chimney with a flame-bulb.
    const hx = x + 0.2;
    const hy = y + 1.22;
    metal.add(new CylinderGeometry(0.012, 0.012, 0.18, 8), compose([hx, hy + 0.2, z]));
    metal.add(new CylinderGeometry(0.02, 0.1, 0.07, 12), compose([hx, hy + 0.12, z]));
    metal.add(new CylinderGeometry(0.085, 0.085, 0.02, 12), compose([hx, hy + 0.08, z]));
    metal.add(new CylinderGeometry(0.07, 0.07, 0.02, 12), compose([hx, hy - 0.09, z]));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      metal.rod(
        [hx + Math.cos(a) * 0.07, hy - 0.09, z + Math.sin(a) * 0.07],
        [hx + Math.cos(a) * 0.08, hy + 0.08, z + Math.sin(a) * 0.08],
        0.006,
        { segments: 6 },
      );
    }
    const glass = mats.bulb.clone();
    const flame = new Mesh(chimney, glass);
    flame.position.set(hx, hy, z);
    group.add(flame);
    const light = new PointLight(0xffb070, 1);
    light.position.set(hx, hy, z);
    group.add(light);
    practicals.push({ light, candela: 14, order });
    // A lantern's glass is the brightest thing in a dusk frame (a flame reads ~10⁴ cd/m²).
    glows.push({ material: glass, luminance: 24_000, order });
  }
  for (const batch of [posts, metal]) {
    const mesh = batch.build();
    if (mesh) group.add(mesh);
  }
  return { group, practicals, glows };
}

/** A floating pontoon on four drums, moored to two piles; 'setLevel' follows the tide. */
export function buildPontoon(mats: Materials, seed = 83) {
  const group = new Group();
  group.name = "pontoon";
  const float = new Group();
  const deck = new Batch("pontoon-deck", mats.deck, 1.4, seed);
  const structure = new Batch("pontoon-frame", mats.structural, 1.4, seed + 1);
  // Black plastic drums: pale ones read as milky blobs through the water.
  const drums = new Batch("pontoon-drums", mats.steel, 0.8, seed + 2);
  for (let x = -1.3; x <= 1.31; x += 0.146)
    deck.box([0.138, 0.03, 2.6], [x, 0.3, 0], [0, 0, 0], { radius: 0.003, vary: 0.12 });
  for (const z of [-1.2, 0, 1.2])
    structure.box([2.8, 0.14, 0.08], [0, 0.22, z], [0, 0, 0], { radius: 0.004 });
  for (const x of [-0.9, 0.9])
    for (const z of [-0.8, 0.8])
      drums.add(
        new CylinderGeometry(0.3, 0.3, 0.62, 20).rotateZ(Math.PI / 2),
        compose([x, 0.02, z]),
      );
  for (const batch of [deck, structure, drums]) {
    const mesh = batch.build();
    if (mesh) float.add(mesh);
  }
  group.add(float);
  const piles = new Batch("pontoon-piles", mats.structural, 1.4, seed + 3);
  for (const z of [-1.3, 1.3])
    piles.box([0.22, 7.5, 0.22], [1.55, -1.5, z], [0, 0.3, 0], { radius: 0.03, vary: 0.15 });
  const pileMesh = piles.build();
  if (pileMesh) group.add(pileMesh);
  return {
    group,
    setLevel(level: number, time: number, animated: boolean) {
      float.position.y = level - 0.14 + (animated ? Math.sin(time * 0.9) * 0.012 : 0);
      float.rotation.z = animated ? Math.sin(time * 0.7) * 0.008 : 0;
    },
  };
}

/** The small beacon tower that lights once all three lens fragments are found. */
export function buildLighthouse(mats: Materials, seed = 91) {
  const group = new Group();
  group.name = "lighthouse";
  const white = new Batch("lighthouse-body", mats.limewash, 1.2, seed);
  const metal = new Batch("lighthouse-metal", mats.steel, 0.5, seed + 1);
  const brass = new Batch("lighthouse-brass", mats.brass, 0.4, seed + 2);
  const profile = [
    new Vector2(0.62, 0),
    new Vector2(0.6, 0.2),
    new Vector2(0.46, 2.6),
    new Vector2(0.52, 2.64),
    new Vector2(0.52, 2.72),
    new Vector2(0.001, 2.72),
  ];
  const body = new LatheGeometry(profile, 36);
  metricUVs(body, 1.2, 1, [0, 0]);
  white.add(body);
  // Gallery rail, lantern room glazing bars and a copper-look cap.
  const rail = new TorusGeometry(0.58, 0.015, 6, 32);
  rail.rotateX(Math.PI / 2);
  metal.add(rail, compose([0, 3.05, 0]));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    metal.rod(
      [Math.cos(a) * 0.58, 2.72, Math.sin(a) * 0.58],
      [Math.cos(a) * 0.58, 3.05, Math.sin(a) * 0.58],
      0.01,
      { segments: 6 },
    );
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    metal.rod(
      [Math.cos(a) * 0.34, 2.72, Math.sin(a) * 0.34],
      [Math.cos(a) * 0.34, 3.35, Math.sin(a) * 0.34],
      0.012,
      { segments: 6 },
    );
  }
  brass.add(new CylinderGeometry(0.05, 0.42, 0.34, 24), compose([0, 3.52, 0]));
  brass.add(new SphereGeometry(0.06, 12, 8), compose([0, 3.72, 0]));
  const lensMaterial = mats.bulb.clone();
  const lens = new Mesh(new CylinderGeometry(0.2, 0.2, 0.4, 20), lensMaterial);
  lens.position.y = 3.03;
  group.add(lens);
  const light = new PointLight(0xffd08a, 1);
  light.position.y = 3.05;
  group.add(light);
  for (const batch of [white, metal, brass]) {
    const mesh = batch.build();
    if (mesh) group.add(mesh);
  }

  // Two opposed beams from the lens, turning with it: light scattered by the air along each
  // beam, bright near the lamp and through its core, soft at its edges, gone by 55 m. Radiance
  // is physical (cd/m²) and pre-exposed, so the beams vanish by day and show from twilight.
  const beamUniforms = {
    radiance: { value: 0 },
    colour: { value: new Color(1, 0.84, 0.6) },
  };
  const beamMaterial = new ShaderMaterial({
    name: "lighthouse-beam",
    uniforms: beamUniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: `
      varying float vAlong;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        // The apex sits at the lamp (the rotor's origin): vAlong runs 0 there to 1 at the end.
        vAlong = length(position) / ${BEAM_LENGTH.toFixed(1)};
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-view.xyz);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float radiance;
      uniform vec3 colour;
      varying float vAlong;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        // Seen through its middle the beam is thickest; its silhouette edges are thin.
        float core = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 2.0);
        float fall = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.7) * smoothstep(0.0, 0.03, vAlong);
        gl_FragColor = vec4(colour * radiance * core * fall, 1.0);
      }`,
  });
  const rotor = new Group();
  rotor.name = "lighthouse-rotor";
  rotor.position.y = 3.05;
  for (const side of [1, -1]) {
    const cone = new ConeGeometry(BEAM_RADIUS, BEAM_LENGTH, 32, 1, true);
    // Lay the cone on its side with its apex at the lamp, pointing out along ±x and tilted
    // 1.5° up so it clears the islets' roofs.
    cone.translate(0, -BEAM_LENGTH / 2, 0);
    cone.rotateZ(side * (Math.PI / 2 + (1.5 * Math.PI) / 180));
    const beam = new Mesh(cone, beamMaterial);
    beam.renderOrder = 4;
    beam.frustumCulled = false;
    beam.userData.visualFamily = "lighthouse beam";
    rotor.add(beam);
  }
  rotor.visible = false;
  group.add(rotor);
  return {
    group,
    light,
    lensMaterial,
    /** on: 0–1 lamp state; preExposure from the rig; the beams turn once every 7 s when animated. */
    updateBeam(on: number, preExposure: number, time: number, animated: boolean) {
      rotor.visible = on > 0.001;
      beamUniforms.radiance.value = on * BEAM_RADIANCE * preExposure;
      rotor.rotation.y = animated ? (time * Math.PI * 2) / 7 : 0.9;
    },
  };
}
/** Beam geometry (metres) and in-scattered radiance at the lamp (cd/m²). */
const BEAM_LENGTH = 55;
const BEAM_RADIUS = 3;
const BEAM_RADIANCE = 0.05;

/** A lens fragment for the optional discovery: a cut glass prism in a brass bezel. */
export function buildLensFragment(mats: Materials) {
  const group = new Group();
  const gemMaterial = mats.bulb.clone();
  const gem = new Mesh(new OctahedronGeometry(0.16, 0), gemMaterial);
  gem.scale.set(1, 1.35, 1);
  const bezel = new Mesh(new TorusGeometry(0.24, 0.018, 8, 36), mats.brass);
  group.add(gem, bezel);
  return { group, gem, gemMaterial };
}

/** A red mooring buoy with a ring. */
export function buildBuoy(mats: Materials) {
  const group = new Group();
  const body = new Mesh(new IcosahedronGeometry(0.34, 3), mats.tileCoral);
  body.scale.set(1, 0.85, 1);
  body.castShadow = body.receiveShadow = true;
  const ring = new Mesh(new TorusGeometry(0.1, 0.02, 8, 20), mats.steel);
  ring.position.y = 0.33;
  group.add(body, ring);
  return group;
}

/** A timber stair between two points (top, bottom): stringers, treads at ~180 mm rise, rails. */
export function buildStairs(
  mats: Materials,
  name: string,
  top: Vec3,
  bottom: Vec3,
  ground: GroundSampler,
  options: { width?: number; rails?: boolean; seed?: number } = {},
) {
  const width = options.width ?? 1;
  const seed = options.seed ?? 7;
  const group = new Group();
  group.name = name;
  const treads = new Batch(`${name}-treads`, mats.deck, 1.4, seed);
  const structure = new Batch(`${name}-structure`, mats.structural, 1.4, seed + 1);
  const ropes = new Batch(`${name}-rope`, mats.rope, 0.5, seed + 2);
  const a = new Vector3(...top);
  const b = new Vector3(...bottom);
  const drop = a.y - b.y;
  const steps = Math.max(2, Math.round(drop / 0.18));
  const run = new Vector3(b.x - a.x, 0, b.z - a.z);
  const going = run.length() / steps;
  const along = run.clone().normalize();
  const yaw = Math.atan2(along.x, along.z);
  const side = new Vector3(along.z, 0, -along.x);
  const pitch = Math.atan2(drop, run.length());
  const length = Math.hypot(drop, run.length());
  for (let i = 0; i < steps; i++) {
    const p = a.clone().addScaledVector(along, (i + 0.5) * going);
    p.y = a.y - (i + 1) * (drop / steps);
    treads.box([width, 0.032, going + 0.03], [p.x, p.y, p.z], [0, yaw, 0], {
      radius: 0.004,
      vary: 0.12,
    });
  }
  const mid = a.clone().add(b).multiplyScalar(0.5);
  for (const s of [-0.5, 0.5]) {
    const o = side.clone().multiplyScalar(s * width);
    structure.box(
      [0.05, 0.24, length + 0.2],
      [mid.x + o.x, mid.y - 0.12, mid.z + o.z],
      [pitch, yaw, 0],
      { radius: 0.004 },
    );
  }
  if (options.rails) {
    const tops: { l: Vec3; r: Vec3 }[] = [];
    const posts = Math.max(2, Math.round(run.length() / 1.3) + 1);
    for (let k = 0; k < posts; k++) {
      const t = k / (posts - 1);
      const p = a.clone().lerp(b, t);
      for (const s of [-0.55, 0.55]) {
        const q = p.clone().addScaledVector(side, s * width);
        const bottomY = Math.min(ground(q.x, q.z), q.y - 0.3) - 0.3;
        structure.box(
          [0.08, q.y + 0.95 - bottomY, 0.08],
          [q.x, (q.y + 0.95 + bottomY) / 2, q.z],
          [0, yaw, 0],
          { radius: 0.01, vary: 0.12 },
        );
      }
      const l = p.clone().addScaledVector(side, -0.55 * width);
      const r = p.clone().addScaledVector(side, 0.55 * width);
      tops.push({ l: [l.x, l.y + 0.88, l.z], r: [r.x, r.y + 0.88, r.z] });
    }
    for (let k = 0; k < tops.length - 1; k++) {
      const p = tops[k] as { l: Vec3; r: Vec3 };
      const q = tops[k + 1] as { l: Vec3; r: Vec3 };
      ropes.add(catenary(p.l, q.l, 0.06, 0.016, 10));
      ropes.add(catenary(p.r, q.r, 0.06, 0.016, 10));
    }
  }
  for (const batch of [treads, structure, ropes]) {
    const mesh = batch.build();
    if (mesh) group.add(mesh);
  }
  return group;
}

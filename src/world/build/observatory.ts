import {
  Color,
  CylinderGeometry,
  Euler,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  PointLight,
  Quaternion,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Materials } from "../materials";
import { Batch, catenary, compose, instances, metricUVs, rng, type Vec3 } from "./kit";
import { scaleTile } from "./tiles";
import type { Building } from "./weather-house";

// The Nap Observatory: a round limewashed room under a rotating dome clad in blue-green
// glazed scale tiles. The dome carries a meridian slot; `open` turns the dome toward the sea
// and slides the curved shutter up over the crown on its rails.

export const OBSERVATORY = {
  radius: 2.2,
  wall: 2.45,
  domeRadius: 2.36,
  deckRadius: 3.4,
  floorLift: 0.5,
};

export function buildObservatory(mats: Materials, seed = 19): Building {
  const O = OBSERVATORY;
  const random = rng(seed);
  const group = new Group();
  group.name = "nap-observatory";
  const deck = new Batch("obs-deck", mats.deck, 1.4, seed + 1);
  const structure = new Batch("obs-structure", mats.structural, 1.4, seed + 2);
  const lime = new Batch("obs-limewash", mats.limewash, 1.6, seed + 3);
  const concrete = new Batch("obs-concrete", mats.concrete, 1, seed + 4);
  const brass = new Batch("obs-brass", mats.brass, 0.4, seed + 5);
  const steel = new Batch("obs-steel", mats.steel, 1, seed + 6);
  const glass = new Batch("obs-glass", mats.glass, 1, seed + 7);
  const linen = new Batch("obs-linen", mats.linen, 0.6, seed + 8);
  const wool = new Batch("obs-wool", mats.wool, 0.5, seed + 9);
  const rug = new Batch("obs-rug", mats.rug, 1.4, seed + 10);
  const lining = new Batch("obs-lining", mats.lining, 1.2, seed + 11);

  // ---- circular deck on piers with radial joists and board segments
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 ? O.deckRadius - 0.3 : O.radius * 0.55;
    concrete.box(
      [0.3, O.floorLift + 1, 0.3],
      [Math.cos(a) * r, -(O.floorLift + 1) / 2 - 0.15, Math.sin(a) * r],
      [0, a, 0],
      { radius: 0.02 },
    );
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    structure.box(
      [O.deckRadius - 0.1, 0.16, 0.05],
      [Math.cos(a) * (O.deckRadius / 2), -0.11, Math.sin(a) * (O.deckRadius / 2)],
      [0, -a, 0],
      { radius: 0.003 },
    );
  }
  // Deck boards laid straight across, clipped to the circle (wider than the room).
  for (let z = -O.deckRadius + 0.07; z < O.deckRadius; z += 0.146) {
    const half = Math.sqrt(Math.max(0, O.deckRadius ** 2 - z * z)) - 0.02;
    if (half < 0.2) continue;
    deck.box([half * 2, 0.028, 0.138], [0, -0.014, z], [0, 0, 0], { radius: 0.003, vary: 0.12 });
  }
  // A curved rim board around the deck edge.
  const rim = new TorusGeometry(O.deckRadius, 0.04, 6, 64);
  rim.rotateX(Math.PI / 2);
  metricUVs(rim, 1.4, 0, [0, 0]);
  structure.add(rim, compose([0, -0.06, 0]));
  // Rope railing on short posts around three quarters of the deck.
  const ropeParts: { a: Vec3; b: Vec3 }[] = [];
  let previous: Vec3 | null = null;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 0.65 + (i / 12) * Math.PI * 1.45;
    const x = Math.cos(a) * (O.deckRadius - 0.08);
    const z = Math.sin(a) * (O.deckRadius - 0.08);
    structure.box([0.07, 0.95, 0.07], [x, 0.47, z], [0, -a, 0], { radius: 0.01 });
    const top: Vec3 = [x, 0.86, z];
    if (previous) ropeParts.push({ a: previous, b: top });
    previous = top;
  }

  // ---- cylindrical wall: timber base course, limewashed render above, a door and portholes
  const wallProfile = [
    new Vector2(O.radius + 0.06, 0),
    new Vector2(O.radius + 0.06, 0.32),
    new Vector2(O.radius + 0.03, 0.34),
    new Vector2(O.radius + 0.03, O.wall - 0.1),
    new Vector2(O.radius + 0.08, O.wall - 0.06),
    new Vector2(O.radius + 0.08, O.wall),
    new Vector2(O.radius - 0.12, O.wall),
    new Vector2(O.radius - 0.12, 0),
  ];
  const doorAngle = Math.PI * 0.5;
  const doorHalf = 0.42 / O.radius;
  const wall = new LatheGeometry(wallProfile, 72, doorAngle + doorHalf, Math.PI * 2 - doorHalf * 2);
  metricUVs(wall, 1.6, 1, [0, 0]);
  lime.add(wall);
  // Base course of vertical boards (a timber plinth) around the outside.
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    if (Math.abs(((a - doorAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < doorHalf + 0.05)
      continue;
    structure.box(
      [0.2, 0.34, 0.025],
      [Math.cos(a) * (O.radius + 0.075), 0.17, Math.sin(a) * (O.radius + 0.075)],
      [0, Math.PI / 2 - a, 0],
      { radius: 0.003 },
    );
  }
  // Door: frame, boarded leaf standing ajar, brass latch.
  const doorPos = new Vector3(Math.cos(doorAngle) * O.radius, 0, Math.sin(doorAngle) * O.radius);
  for (const side of [-1, 1]) {
    const a = doorAngle + side * doorHalf;
    structure.box(
      [0.1, 2.05, 0.16],
      [Math.cos(a) * O.radius, 1.02, Math.sin(a) * O.radius],
      [0, Math.PI / 2 - a, 0],
      { radius: 0.006 },
    );
  }
  structure.box([0.94, 0.1, 0.16], [doorPos.x, 2.08, doorPos.z], [0, Math.PI / 2 - doorAngle, 0], {
    radius: 0.006,
  });
  const leaf = new Group();
  leaf.position.set(
    Math.cos(doorAngle + doorHalf) * O.radius,
    0,
    Math.sin(doorAngle + doorHalf) * O.radius,
  );
  leaf.rotation.y = -doorAngle - 0.9;
  const leafBatch = new Batch("obs-door", mats.painted, 1.2, seed + 12);
  for (let i = 0; i < 6; i++)
    leafBatch.box([0.135, 2.0, 0.035], [-0.07 - i * 0.138, 1.02, 0], [0, 0, 0], { radius: 0.004 });
  leafBatch.box([0.8, 0.12, 0.03], [-0.42, 0.45, 0.03], [0, 0, 0]);
  leafBatch.box([0.8, 0.12, 0.03], [-0.42, 1.6, 0.03], [0, 0, 0]);
  const leafMesh = leafBatch.build();
  if (leafMesh) leaf.add(leafMesh);
  group.add(leaf);
  // Three brass portholes.
  for (const a of [doorAngle + 1.4, doorAngle + Math.PI, doorAngle - 1.5]) {
    const p: Vec3 = [Math.cos(a) * (O.radius + 0.04), 1.55, Math.sin(a) * (O.radius + 0.04)];
    const ring = new TorusGeometry(0.24, 0.03, 10, 32);
    metricUVs(ring, 0.3, 0, [0, 0]);
    brass.add(ring, compose(p, [0, Math.PI / 2 - a, 0]));
    const pane = new CylinderGeometry(0.23, 0.23, 0.01, 28);
    pane.rotateX(Math.PI / 2);
    glass.add(pane, compose(p, [0, Math.PI / 2 - a, 0]));
  }

  // ---- dome: rotating group with scale tiles, a meridian slot and a sliding shutter
  const dome = new Group();
  dome.name = "dome";
  dome.position.y = O.wall + 0.06;
  // Brass track ring and roller bogies the dome rides on.
  const track = new TorusGeometry(O.radius + 0.02, 0.045, 10, 72);
  track.rotateX(Math.PI / 2);
  metricUVs(track, 0.5, 0, [0, 0]);
  brass.add(track, compose([0, O.wall + 0.035, 0]));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    steel.box(
      [0.12, 0.07, 0.08],
      [Math.cos(a) * (O.radius + 0.02), O.wall - 0.01, Math.sin(a) * (O.radius + 0.02)],
      [0, -a, 0],
      { radius: 0.01 },
    );
  }
  const slotHalf = 0.34; // metres, half the slot width
  const scales: { position: Vec3; rotation: Vec3; tone: Color }[] = [];
  const shutterScales: { position: Vec3; rotation: Vec3; tone: Color }[] = [];
  const glaze = () =>
    new Color().setHSL(
      0.47 + (random() - 0.5) * 0.04,
      0.42 + (random() - 0.5) * 0.12,
      0.34 + (random() - 0.5) * 0.08,
    );
  const R = O.domeRadius;
  // Rows of scales from the base ring toward the crown; circumference sets how many per row.
  for (let row = 0; row < 15; row++) {
    const phi = (row / 15) * (Math.PI / 2 - 0.12); // elevation angle
    const ring = Math.cos(phi) * R;
    const count = Math.max(6, Math.floor((Math.PI * 2 * ring) / 0.15));
    for (let i = 0; i < count; i++) {
      const theta = ((i + (row % 2) * 0.5) / count) * Math.PI * 2;
      const x = Math.cos(theta) * ring;
      const z = Math.sin(theta) * ring;
      const y = Math.sin(phi) * R;
      const inSlot = Math.abs(z) < slotHalf && x > 0;
      const normal = new Vector3(x, y, z).normalize();
      // Tile frame: +Y out of the dome, +Z down the dome (toward the base).
      const down = new Vector3(
        -Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        -Math.sin(theta) * Math.sin(phi),
      ).multiplyScalar(-1);
      const side = new Vector3().crossVectors(normal, down).normalize();
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, normal, down));
      const e = new Euler().setFromQuaternion(q);
      const place = {
        position: [x + normal.x * 0.02, y + normal.y * 0.02, z + normal.z * 0.02] as Vec3,
        rotation: [e.x, e.y, e.z] as Vec3,
        tone: glaze(),
      };
      (inSlot ? shutterScales : scales).push(place);
    }
  }
  const domeShell = new LatheGeometry(
    Array.from({ length: 24 }, (_, i) => {
      const phi = (i / 23) * (Math.PI / 2);
      return new Vector2(Math.cos(phi) * (R - 0.03), Math.sin(phi) * (R - 0.03));
    }),
    64,
  );
  metricUVs(domeShell, 1.2, 1, [0, 0]);
  const shellBatch = new Batch("dome-shell", mats.lining, 1.2, seed + 13);
  shellBatch.add(domeShell, new Matrix4(), { tone: 0.92 });
  // Slot: two brass-capped ribs along the meridian and a crown ring.
  const ribs = new Batch("dome-ribs", mats.brass, 0.4, seed + 14);
  for (const s of [-1, 1]) {
    const points = Array.from({ length: 20 }, (_, i) => {
      const phi = (i / 19) * (Math.PI / 2 - 0.05);
      return new Vector3(Math.cos(phi) * (R + 0.03), Math.sin(phi) * (R + 0.03), s * slotHalf);
    });
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i] as Vector3;
      const b = points[i + 1] as Vector3;
      ribs.rod([a.x, a.y, a.z], [b.x, b.y, b.z], 0.028, { segments: 8 });
    }
  }
  const crown = new TorusGeometry(0.5, 0.035, 8, 40);
  crown.rotateX(Math.PI / 2);
  metricUVs(crown, 0.4, 0, [0, 0]);
  ribs.add(crown, compose([0, R - 0.02, 0]));
  const domeMeshes = [shellBatch.build(), ribs.build()].filter(Boolean) as Mesh[];
  dome.add(...domeMeshes);
  const scaleGeometry = scaleTile();
  dome.add(instances("dome-scales", scaleGeometry, mats.tileGlaze, scales));
  // Shutter: the slot's own scales on a pivoting carrier that slides up and over the crown.
  const shutter = new Group();
  shutter.name = "shutter";
  shutter.add(instances("shutter-scales", scaleGeometry, mats.tileGlaze, shutterScales));
  dome.add(shutter);
  group.add(dome);

  // ---- interior: round daybed, telescope on a pier, lamp, rug, star chart
  rug.add(new CylinderGeometry(1.35, 1.35, 0.012, 48), compose([0, 0.006, 0.1]));
  structure.add(
    new CylinderGeometry(1.15, 1.2, 0.36, 48, 1, false, Math.PI * 0.15, Math.PI * 1.1),
    compose([0, 0.18, -0.35]),
  );
  linen.add(
    new CylinderGeometry(1.1, 1.12, 0.16, 48, 1, false, Math.PI * 0.15, Math.PI * 1.1),
    compose([0, 0.44, -0.35]),
  );
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.25 + i * 0.22;
    linen.add(
      new RoundedBoxGeometry(0.5, 0.14, 0.34, 3, 0.06),
      compose([Math.cos(a) * 0.82, 0.59, -0.35 - Math.sin(a) * 0.82], [0.35, Math.PI / 2 + a, 0]),
    );
  }
  wool.add(
    new RoundedBoxGeometry(1.3, 0.035, 0.7, 2, 0.015),
    compose([0.2, 0.54, -0.2], [0.03, 0.4, -0.05]),
  );
  // Telescope: brass tube on a timber pier, aimed up through the slot.
  const scope = new Group();
  scope.position.set(0.95, 0, 0.55);
  const scopeBatch = new Batch("telescope", mats.brass, 0.3, seed + 15);
  scopeBatch.rod([0, 0, 0], [0, 1.05, 0], 0.07, { segments: 16 });
  scopeBatch.add(new CylinderGeometry(0.2, 0.25, 0.06, 20), compose([0, 0.03, 0]));
  const tube = new Group();
  tube.position.set(0, 1.12, 0);
  tube.rotation.set(0, 0, -0.95);
  const tubeBatch = new Batch("telescope-tube", mats.brass, 0.3, seed + 16);
  tubeBatch.add(new CylinderGeometry(0.075, 0.09, 1.25, 24), compose([0, 0.35, 0]));
  tubeBatch.add(new CylinderGeometry(0.1, 0.1, 0.1, 24), compose([0, 0.95, 0]));
  tubeBatch.add(new CylinderGeometry(0.03, 0.03, 0.16, 12), compose([0, -0.32, 0]));
  const tubeMesh = tubeBatch.build();
  if (tubeMesh) tube.add(tubeMesh);
  const scopeMesh = scopeBatch.build();
  if (scopeMesh) scope.add(scopeMesh);
  scope.add(tube);
  group.add(scope);
  // Standing lamp by the daybed.
  brass.rod([-1.2, 0, 0.5], [-1.2, 1.35, 0.5], 0.012);
  brass.add(new CylinderGeometry(0.14, 0.16, 0.025, 24), compose([-1.2, 0.012, 0.5]));
  const shadeMaterial = mats.lampShade.clone();
  const shade = new Mesh(new CylinderGeometry(0.12, 0.18, 0.22, 24, 1, true), shadeMaterial);
  shade.position.set(-1.2, 1.42, 0.5);
  group.add(shade);
  const lamp = new PointLight(0xffb46b, 1);
  lamp.position.set(-1.2, 1.36, 0.5);
  group.add(lamp);
  // Interior lining at the wall's inner face and a floor of boards.
  for (let x = -O.radius + 0.07; x < O.radius; x += 0.142) {
    const half = Math.sqrt(Math.max(0, (O.radius - 0.12) ** 2 - x * x));
    if (half < 0.1) continue;
    lining.box([0.136, 0.022, half * 2], [x, 0.011, 0], [0, 0, 0], { radius: 0.002, vary: 0.1 });
  }

  const ropes = new Batch("obs-rope", mats.rope, 0.5, seed + 17);
  for (const part of ropeParts) ropes.add(catenary(part.a, part.b, 0.07, 0.013, 10));

  for (const batch of [
    deck,
    structure,
    lime,
    concrete,
    brass,
    steel,
    glass,
    linen,
    wool,
    rug,
    lining,
    ropes,
  ]) {
    const mesh = batch.build();
    if (mesh) {
      if (batch === glass) {
        mesh.castShadow = false;
        mesh.renderOrder = 3;
      }
      group.add(mesh);
    }
  }

  const setOpen = (amount: number) => {
    // Turn the slot toward the sea (+X local faces the view), then slide the shutter over.
    dome.rotation.y = 2.4 - amount * 2.4;
    shutter.rotation.z = amount * 1.35;
  };
  setOpen(0);
  return {
    group,
    setOpen,
    lights: [{ light: lamp, candela: 22 }],
    emissive: [{ material: shadeMaterial, luminance: 900 }],
    focus: new Vector3(0, 1.8, 0),
  };
}

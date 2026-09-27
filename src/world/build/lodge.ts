import {
  Color,
  CylinderGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  PointLight,
  Quaternion,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Materials } from "../materials";
import { Batch, compose, fastenerGeometry, instances, metricUVs, rng, type Vec3 } from "./kit";
import { flatTile } from "./tiles";
import type { Building } from "./weather-house";

// The Lantern Lodge: a long board-and-batten family cabin painted deep green, raised on posts
// over the lower terrace, with a terrace facing the bay. Its roof lifts straight up on four
// brass screw-jack posts to reveal the long breakfast table and two sleeping nooks.

export const LODGE = {
  halfLength: 3.6,
  halfWidth: 2.3,
  wall: 2.4,
  pitch: (32 * Math.PI) / 180,
  overhang: 0.42,
  terrace: 2.0,
  floorLift: 0.7,
  lift: 1.35,
};

export function buildLodge(mats: Materials, seed = 29): Building {
  const L = LODGE;
  const random = rng(seed);
  const group = new Group();
  group.name = "lantern-lodge";
  const painted = new Batch("lodge-painted", mats.painted, 1.2, seed + 1);
  const structure = new Batch("lodge-structure", mats.structural, 1.4, seed + 2);
  const deck = new Batch("lodge-deck", mats.deck, 1.4, seed + 3);
  const lining = new Batch("lodge-lining", mats.lining, 1.2, seed + 4);
  const concrete = new Batch("lodge-concrete", mats.concrete, 1, seed + 5);
  const brass = new Batch("lodge-brass", mats.brass, 0.4, seed + 6);
  const glass = new Batch("lodge-glass", mats.glass, 1, seed + 7);
  const linen = new Batch("lodge-linen", mats.linen, 0.6, seed + 8);
  const wool = new Batch("lodge-wool", mats.wool, 0.5, seed + 9);
  const rug = new Batch("lodge-rug", mats.rug, 1.6, seed + 10);
  const steel = new Batch("lodge-steel", mats.steel, 1, seed + 11);
  const ceramic = new Batch("lodge-ceramic", mats.ceramic, 0.3, seed + 12);

  // ---- posts, bearers, floor and terrace
  for (let x = -L.halfLength + 0.2; x <= L.halfLength - 0.19; x += (L.halfLength * 2 - 0.4) / 4)
    for (const z of [-L.halfWidth + 0.2, 0, L.halfWidth - 0.2, L.halfWidth + L.terrace - 0.15]) {
      structure.box([0.16, L.floorLift + 1.4, 0.16], [x, -(L.floorLift + 1.4) / 2, z], [0, 0, 0], {
        radius: 0.01,
      });
      concrete.box([0.36, 0.35, 0.36], [x, -L.floorLift - 1.2, z], [0, random() * 0.3, 0], {
        radius: 0.02,
      });
    }
  for (const z of [-L.halfWidth + 0.2, 0, L.halfWidth - 0.2, L.halfWidth + L.terrace - 0.15])
    structure.box([L.halfLength * 2, 0.22, 0.1], [0, -0.14, z], [0, 0, 0], { radius: 0.004 });
  for (let z = -L.halfWidth + 0.07; z < L.halfWidth; z += 0.142)
    lining.box([L.halfLength * 2 - 0.1, 0.024, 0.136], [0, -0.012, z], [0, 0, 0], {
      radius: 0.002,
      vary: 0.1,
    });
  const screws: { position: Vec3 }[] = [];
  for (let x = -L.halfLength + 0.07; x < L.halfLength; x += 0.146) {
    deck.box([0.138, 0.028, L.terrace], [x, -0.014, L.halfWidth + L.terrace / 2], [0, 0, 0], {
      radius: 0.003,
      vary: 0.12,
    });
    for (const z of [L.halfWidth + 0.05, L.halfWidth + L.terrace - 0.15])
      for (const dx of [-0.035, 0.035]) screws.push({ position: [x + dx, 0.001, z] });
  }
  // Terrace rail on the seaward edge: posts, a top rail, a mid rail.
  for (let x = -L.halfLength + 0.05; x <= L.halfLength; x += 1.2)
    structure.box([0.08, 1.0, 0.08], [x, 0.5, L.halfWidth + L.terrace - 0.04], [0, 0, 0], {
      radius: 0.01,
    });
  structure.box(
    [L.halfLength * 2 + 0.1, 0.06, 0.12],
    [0, 1.0, L.halfWidth + L.terrace - 0.04],
    [0, 0, 0],
    { radius: 0.01 },
  );
  structure.box(
    [L.halfLength * 2, 0.04, 0.05],
    [0, 0.55, L.halfWidth + L.terrace - 0.04],
    [0, 0, 0],
    { radius: 0.006 },
  );

  // ---- walls: board-and-batten painted green, openings on the terrace side
  const openings = [
    { x0: -2.9, x1: -1.2, y0: 0.55, y1: 2.05 },
    { x0: -0.5, x1: 0.5, y0: 0.02, y1: 2.08 }, // door
    { x0: 1.2, x1: 2.9, y0: 0.55, y1: 2.05 },
  ];
  const wallBoards = (
    length: number,
    place: (s: number, height: number, y: number) => void,
    gaps: { x0: number; x1: number; y0: number; y1: number }[],
  ) => {
    for (let s = -length / 2 + 0.1; s < length / 2; s += 0.2) {
      const gap = gaps.find((g) => s > g.x0 - 0.05 && s < g.x1 + 0.05);
      if (!gap) place(s, L.wall, L.wall / 2);
      else {
        if (gap.y0 > 0.05) place(s, gap.y0, gap.y0 / 2);
        const upper = L.wall - gap.y1;
        if (upper > 0.05) place(s, upper, gap.y1 + upper / 2);
      }
    }
  };
  // Front (+z) and back (-z) long walls.
  for (const side of [-1, 1]) {
    const z = side * L.halfWidth;
    const gaps = side > 0 ? openings : [{ x0: -1.0, x1: 1.0, y0: 0.9, y1: 2.0 }];
    wallBoards(
      L.halfLength * 2,
      (s, height, y) => {
        painted.box([0.19, height, 0.024], [s, y, z + side * 0.012], [0, 0, 0], {
          radius: 0.002,
          vary: 0.05,
        });
        painted.box([0.05, height, 0.02], [s + 0.1, y, z + side * 0.034], [0, 0, 0], {
          radius: 0.004,
          vary: 0.05,
        });
        lining.box([0.2, height, 0.016], [s, y, z - side * 0.08], [0, 0, 0], { radius: 0.001 });
      },
      gaps,
    );
    for (const g of gaps) {
      // Window frames and glass.
      structure.box(
        [g.x1 - g.x0 + 0.1, 0.07, 0.14],
        [(g.x0 + g.x1) / 2, g.y1 + 0.035, z],
        [0, 0, 0],
        { radius: 0.004 },
      );
      if (g.y0 > 0.05)
        structure.box(
          [g.x1 - g.x0 + 0.16, 0.06, 0.2],
          [(g.x0 + g.x1) / 2, g.y0 - 0.03, z + side * 0.04],
          [0, 0, 0],
          { radius: 0.004 },
        );
      for (const x of [g.x0 - 0.035, g.x1 + 0.035])
        structure.box([0.07, g.y1 - g.y0, 0.14], [x, (g.y0 + g.y1) / 2, z], [0, 0, 0], {
          radius: 0.004,
        });
      if (g.y0 > 0.05) {
        glass.add(
          new RoundedBoxGeometry(g.x1 - g.x0, g.y1 - g.y0, 0.008, 1, 0.002),
          compose([(g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, z]),
        );
        structure.box(
          [0.05, g.y1 - g.y0, 0.08],
          [(g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, z],
          [0, 0, 0],
        );
      }
    }
  }
  // Door leaf (half-glazed, painted) standing slightly open, brass handle.
  const doorLeaf = new Batch("lodge-door", mats.painted, 1.2, seed + 13);
  doorLeaf.box([0.98, 0.95, 0.045], [0, 0.5, 0], [0, 0, 0], { radius: 0.006 });
  doorLeaf.box([0.98, 0.12, 0.045], [0, 2.0, 0], [0, 0, 0], { radius: 0.006 });
  for (const x of [-0.44, 0.44]) doorLeaf.box([0.1, 1.1, 0.045], [x, 1.5, 0], [0, 0, 0]);
  const door = new Group();
  door.position.set(-0.49, 0, L.halfWidth + 0.01);
  const doorMesh = doorLeaf.build();
  if (doorMesh) {
    doorMesh.position.x = 0.49;
    door.add(doorMesh);
  }
  const doorGlass = new Mesh(new RoundedBoxGeometry(0.78, 1.0, 0.008, 1, 0.002), mats.glass);
  doorGlass.position.set(0.49, 1.5, 0);
  door.add(doorGlass);
  door.rotation.y = -0.55;
  group.add(door);
  brass.box([0.12, 0.018, 0.018], [0.36, 1.02, L.halfWidth + 0.07], [0, 0, 0], { radius: 0.006 });
  // Gable ends: boards up to the roof line.
  const ridgeRise = L.halfWidth * Math.tan(L.pitch);
  for (const side of [-1, 1]) {
    const x = side * L.halfLength;
    for (let z = -L.halfWidth + 0.1; z < L.halfWidth; z += 0.2) {
      const top = L.wall + (L.halfWidth - Math.abs(z)) * Math.tan(L.pitch) - 0.05;
      painted.box([0.024, top, 0.19], [x + side * 0.012, top / 2, z], [0, 0, 0], {
        radius: 0.002,
        vary: 0.05,
      });
      painted.box([0.02, top, 0.05], [x + side * 0.034, top / 2, z + 0.1], [0, 0, 0], {
        radius: 0.004,
        vary: 0.05,
      });
    }
  }
  // Corner boards and a wall plate.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      structure.box(
        [0.1, L.wall, 0.1],
        [sx * (L.halfLength + 0.02), L.wall / 2, sz * (L.halfWidth + 0.02)],
        [0, 0, 0],
        { radius: 0.006 },
      );
  structure.box([L.halfLength * 2 + 0.1, 0.12, 0.12], [0, L.wall + 0.02, L.halfWidth], [0, 0, 0], {
    radius: 0.004,
  });
  structure.box([L.halfLength * 2 + 0.1, 0.12, 0.12], [0, L.wall + 0.02, -L.halfWidth], [0, 0, 0], {
    radius: 0.004,
  });

  // ---- roof (lifts as one piece)
  const roof = new Group();
  roof.name = "lodge-roof";
  const roofBatch = new Batch("lodge-roof-structure", mats.structural, 1.4, seed + 20);
  const sarking = new Batch("lodge-sarking", mats.lining, 1.2, seed + 21);
  const slopeLength = (L.halfWidth + L.overhang) / Math.cos(L.pitch);
  const tilePlacements: { position: Vec3; rotation: Vec3; tone: Color }[] = [];
  for (const side of [-1, 1]) {
    // Slope frame: u down-slope (toward ±z), v along x, w out of the roof.
    const u = new Vector3(0, -Math.sin(L.pitch), side * Math.cos(L.pitch));
    const w = new Vector3(0, Math.cos(L.pitch), side * Math.sin(L.pitch));
    const v = new Vector3().crossVectors(w, u); // right-handed with (v, w, u)
    const basis = new Matrix4().makeBasis(u, v, w);
    if (basis.determinant() < 0) v.negate();
    const orient = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(u, v, w));
    const tileQuat = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(v, w, u));
    const ridge = new Vector3(0, L.wall + ridgeRise, 0);
    const at = (su: number, sv: number, sw: number) =>
      ridge.clone().addScaledVector(u, su).addScaledVector(v, sv).addScaledVector(w, sw);
    const put = (batch: Batch, size: Vec3, su: number, sv: number, sw: number) => {
      const g = new RoundedBoxGeometry(
        size[0],
        size[1],
        size[2],
        1,
        Math.min(0.004, Math.min(...size) / 4),
      );
      const grain = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;
      metricUVs(g, batch.textureMetres, grain as 0 | 1 | 2, [random() * 5, random() * 5]);
      batch.add(g, new Matrix4().compose(at(su, sv, sw), orient, new Vector3(1, 1, 1)));
    };
    for (let sv = -L.halfLength - 0.3; sv <= L.halfLength + 0.31; sv += 0.6)
      put(roofBatch, [slopeLength, 0.07, 0.2], slopeLength / 2, sv, -0.11);
    for (let su = 0.075; su < slopeLength; su += 0.15)
      put(sarking, [0.146, L.halfLength * 2 + 0.7, 0.02], su, 0, 0.01);
    put(roofBatch, [0.04, L.halfLength * 2 + 0.8, 0.22], slopeLength, 0, 0.02);
    const exposure = 0.34;
    for (let c = 0; c * exposure < slopeLength - 0.15; c++) {
      const su = slopeLength - 0.22 - c * exposure;
      put(roofBatch, [0.05, L.halfLength * 2 + 0.7, 0.025], su - 0.12, 0, 0.032);
      for (let sv = -L.halfLength - 0.2; sv < L.halfLength + 0.25; sv += 0.285) {
        const tilt = new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          -(0.045 + (random() - 0.5) * 0.02),
        );
        const q = tileQuat.clone().multiply(tilt);
        const e = new Euler().setFromQuaternion(q);
        const p = at(su, sv + (c % 2) * 0.14, 0.055);
        tilePlacements.push({
          position: [p.x, p.y, p.z],
          rotation: [e.x, e.y, e.z],
          tone: new Color().setHSL(
            0.56 + (random() - 0.5) * 0.03,
            0.28 + (random() - 0.5) * 0.1,
            0.3 + (random() - 0.5) * 0.07,
          ),
        });
      }
    }
  }
  // Ridge: a timber ridge board capped with a rolled lead-look strip.
  roofBatch.box(
    [L.halfLength * 2 + 0.8, 0.18, 0.06],
    [0, L.wall + ridgeRise + 0.02, 0],
    [0, 0, 0],
    { radius: 0.006 },
  );
  steel.box([L.halfLength * 2 + 0.82, 0.07, 0.24], [0, L.wall + ridgeRise + 0.12, 0], [0, 0, 0], {
    radius: 0.03,
  });
  for (const batch of [roofBatch, sarking]) {
    const mesh = batch.build();
    if (mesh) roof.add(mesh);
  }
  roof.add(instances("lodge-tiles", flatTile(), mats.tileSlate, tilePlacements));
  group.add(roof);
  // Four screw-jack posts that extend as the roof rises. Closed, the brass sleeves sit inside
  // the room's corners below the wall plate (above it they pierced the roof at the eaves).
  const jacks: { sleeve: Mesh; screw: Mesh; base: Vector3 }[] = [];
  const jackDrop = 0.53;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const base = new Vector3(
        sx * (L.halfLength - 0.15),
        L.wall + 0.08 - jackDrop,
        sz * (L.halfWidth - 0.15),
      );
      const sleeve = new Mesh(new CylinderGeometry(0.05, 0.05, 0.4, 16), mats.brass);
      sleeve.position.copy(base).add(new Vector3(0, 0.2, 0));
      const screw = new Mesh(new CylinderGeometry(0.022, 0.022, 1, 12), mats.steel);
      sleeve.castShadow = screw.castShadow = true;
      group.add(sleeve, screw);
      jacks.push({ sleeve, screw, base });
    }

  // ---- interior: long table, benches, pendants, two nooks with curtains, a dresser
  const tableTop = 0.76;
  structure.box([2.6, 0.045, 0.9], [0, tableTop, 0.2], [0, 0, 0], { radius: 0.008 });
  for (const x of [-1.1, 1.1]) {
    structure.box([0.07, tableTop, 0.07], [x, tableTop / 2, -0.12], [0, 0, 0]);
    structure.box([0.07, tableTop, 0.07], [x, tableTop / 2, 0.52], [0, 0, 0]);
  }
  for (const z of [-0.48, 0.88]) {
    structure.box([2.4, 0.04, 0.3], [0, 0.45, z], [0, 0, 0], { radius: 0.006 });
    for (const x of [-1.0, 1.0]) structure.box([0.06, 0.45, 0.25], [x, 0.225, z], [0, 0, 0]);
  }
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + i * 0.4;
    ceramic.add(
      new CylinderGeometry(0.11, 0.1, 0.02, 24),
      compose([x, tableTop + 0.035, i % 2 ? 0.45 : -0.05]),
    );
    ceramic.add(
      new CylinderGeometry(0.04, 0.035, 0.09, 16),
      compose([x + 0.12, tableTop + 0.07, i % 2 ? 0.3 : 0.1]),
    );
  }
  ceramic.add(new CylinderGeometry(0.08, 0.1, 0.2, 20), compose([0.1, tableTop + 0.12, 0.2]));
  // Pendants over the table (the lodge's practicals).
  const pendantMaterials = [mats.lampShade.clone(), mats.lampShade.clone()];
  const pendantLights: PointLight[] = [];
  for (const [i, x] of [-0.65, 0.65].entries()) {
    steel.rod([x, 1.55, 0.2], [x, L.wall + 0.9, 0.2], 0.004);
    const shade = new Mesh(new CylinderGeometry(0.06, 0.2, 0.18, 24, 1, true), pendantMaterials[i]);
    shade.position.set(x, 1.5, 0.2);
    group.add(shade);
    const light = new PointLight(0xffb46b, 1);
    light.position.set(x, 1.42, 0.2);
    group.add(light);
    pendantLights.push(light);
  }
  // Sleeping nooks at each end: a raised bunk platform, mattress, pillows, curtain.
  for (const side of [-1, 1]) {
    const x = side * (L.halfLength - 0.55);
    structure.box([0.95, 0.55, 2.1], [x, 0.275, -0.95], [0, 0, 0], { radius: 0.008 });
    linen.add(new RoundedBoxGeometry(0.85, 0.16, 1.95, 3, 0.05), compose([x, 0.63, -0.95]));
    linen.add(
      new RoundedBoxGeometry(0.6, 0.13, 0.34, 3, 0.06),
      compose([x, 0.76, -1.75], [0.25, 0, 0]),
    );
    wool.add(
      new RoundedBoxGeometry(0.9, 0.035, 1.1, 2, 0.015),
      compose([x, 0.73, -0.6], [0.03, 0, side * 0.03]),
    );
    for (let k = 0; k < 7; k++)
      linen.add(
        new RoundedBoxGeometry(0.1, 1.9, 0.03, 2, 0.012),
        compose([x - side * 0.52, 1.25, 0.05 - k * 0.1], [0, k % 2 ? 0.25 : -0.25, 0]),
        { tone: 0.95 },
      );
    structure.box([0.05, 0.05, 2.2], [x - side * 0.52, 2.22, -0.95], [0, 0, 0]);
  }
  rug.add(new RoundedBoxGeometry(3.2, 0.012, 1.8, 1, 0.004), compose([0, 0.006, 0.2]));

  // ---- the lodge's lantern: a ship's lantern on a bracket over the terrace's seaward corner
  const railZ = L.halfWidth + L.terrace - 0.04;
  const postX = 2.45;
  structure.box([0.09, 1.45, 0.09], [postX, 1.0 + 0.72, railZ], [0, 0, 0], { radius: 0.012 });
  structure.box([0.5, 0.07, 0.07], [postX + 0.21, 2.36, railZ], [0, 0, 0], { radius: 0.008 });
  structure.box([0.05, 0.3, 0.05], [postX + 0.1, 2.2, railZ], [0, 0, -0.75], { radius: 0.006 });
  const lx = postX + 0.4;
  const ly = 1.98;
  brass.rod([lx, ly + 0.2, railZ], [lx, 2.33, railZ], 0.008, { segments: 6 });
  const hook = new CylinderGeometry(0.035, 0.035, 0.012, 16);
  brass.add(hook, compose([lx, ly + 0.2, railZ]));
  brass.add(new CylinderGeometry(0.03, 0.14, 0.11, 20), compose([lx, ly + 0.14, railZ]));
  brass.add(new CylinderGeometry(0.12, 0.12, 0.025, 20), compose([lx, ly + 0.08, railZ]));
  brass.add(new CylinderGeometry(0.1, 0.11, 0.05, 20), compose([lx, ly - 0.13, railZ]));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    brass.rod(
      [lx + Math.cos(a) * 0.1, ly - 0.11, railZ + Math.sin(a) * 0.1],
      [lx + Math.cos(a) * 0.11, ly + 0.08, railZ + Math.sin(a) * 0.11],
      0.008,
      { segments: 6 },
    );
  }
  const lanternGlass = mats.bulb.clone();
  const lanternChimney = new Mesh(new CylinderGeometry(0.085, 0.085, 0.19, 20), lanternGlass);
  lanternChimney.position.set(lx, ly - 0.01, railZ);
  group.add(lanternChimney);
  const lanternLight = new PointLight(0xffb070, 1);
  lanternLight.position.set(lx, ly - 0.01, railZ);
  group.add(lanternLight);

  for (const batch of [
    painted,
    structure,
    deck,
    lining,
    concrete,
    brass,
    glass,
    linen,
    wool,
    rug,
    steel,
    ceramic,
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
  group.add(instances("lodge-screws", fastenerGeometry(), mats.steel, screws));

  const setOpen = (amount: number) => {
    const rise = amount * L.lift;
    roof.position.y = rise;
    for (const jack of jacks) {
      // The screw ends just under the roof plane at the corner (it used to pierce it).
      const length = jackDrop - 0.08 + rise;
      jack.screw.scale.set(1, length, 1);
      jack.screw.position.copy(jack.base).add(new Vector3(0, length / 2 + 0.05, 0));
      jack.screw.visible = amount > 0.01;
    }
  };
  setOpen(0);
  return {
    group,
    setOpen,
    lights: [
      ...pendantLights.map((light) => ({ light, candela: 28 })),
      { light: lanternLight, candela: 30 },
    ],
    emissive: [
      ...pendantMaterials.map((material) => ({ material, luminance: 1100 })),
      { material: lanternGlass, luminance: 24_000 },
    ],
    focus: new Vector3(0, 1.5, 0.6),
  };
}

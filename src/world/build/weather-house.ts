import {
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  PointLight,
  Quaternion,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Materials } from "../materials";
import { Batch, compose, fastenerGeometry, instances, metricUVs, rng, type Vec3 } from "./kit";
import { coverTile, panTile, ridgeTile } from "./tiles";

// The Weather House: a small cedar A-frame reading room at real scale. Local frame: origin at
// the floor centre, ridge along Z, the glazed gable and deck at +Z. One roof slope (-X) is a
// hatch hinged at the ridge; `open` (0–1) swings it up on two brass struts.

export const WEATHER_HOUSE = {
  halfWidth: 2.3,
  halfDepth: 2.5,
  kneeWall: 0.9,
  pitch: (58 * Math.PI) / 180,
  overhang: 0.3,
  gableOverhang: 0.35,
  deckDepth: 1.4,
  floorLift: 0.55,
};

export type Building = {
  group: Group;
  /** 0 closed, 1 open. */
  setOpen(amount: number): void;
  lights: { light: PointLight; candela: number }[];
  emissive: { material: import("three").MeshStandardMaterial; luminance: number }[];
  /** Local point the camera should frame, and the bounding radius. */
  focus: Vector3;
  update?(time: number): void;
};

export function buildWeatherHouse(mats: Materials, seed = 7): Building {
  const W = WEATHER_HOUSE;
  const random = rng(seed);
  const group = new Group();
  group.name = "weather-house";
  const ridgeY = W.kneeWall + W.halfWidth * Math.tan(W.pitch);
  const eaveRun = W.halfWidth + W.overhang;
  const eaveY = W.kneeWall - W.overhang * Math.tan(W.pitch);
  const slopeLength = Math.hypot(eaveRun, ridgeY - eaveY);
  const roofHalfDepth = W.halfDepth + W.gableOverhang;

  const cedar = new Batch("wh-cedar", mats.cedar, 1.2, seed + 1);
  const structure = new Batch("wh-structure", mats.structural, 1.4, seed + 2);
  const deck = new Batch("wh-deck", mats.deck, 1.4, seed + 3);
  const lining = new Batch("wh-lining", mats.lining, 1.2, seed + 4);
  const concrete = new Batch("wh-concrete", mats.concrete, 1.0, seed + 5);
  const steel = new Batch("wh-steel", mats.steel, 1, seed + 6);
  const brass = new Batch("wh-brass", mats.brass, 1, seed + 7);
  const glass = new Batch("wh-glass", mats.glass, 1, seed + 8);
  const fabric = new Batch("wh-linen", mats.linen, 0.6, seed + 9);
  const wool = new Batch("wh-wool", mats.wool, 0.5, seed + 10);
  const rug = new Batch("wh-rug", mats.rug, 1.6, seed + 11);
  const slate = new Batch("wh-slate", mats.slate, 0.8, seed + 12);

  // ---- piers, sills, joists, floor and deck
  for (const x of [-W.halfWidth + 0.15, 0, W.halfWidth - 0.15])
    for (const z of [-W.halfDepth + 0.15, 0, W.halfDepth - 0.15, W.halfDepth + W.deckDepth - 0.15])
      concrete.box(
        [0.3, W.floorLift + 0.9, 0.3],
        [x, -(W.floorLift + 0.9) / 2 - 0.2, z],
        [0, random() * 0.1, 0],
        { radius: 0.02 },
      );
  for (const x of [-W.halfWidth + 0.08, W.halfWidth - 0.08])
    structure.box(
      [0.12, 0.2, W.halfDepth * 2 + W.deckDepth],
      [x, -0.13, W.deckDepth / 2],
      [0, 0, 0],
      { radius: 0.004 },
    );
  for (let z = -W.halfDepth; z <= W.halfDepth + W.deckDepth + 0.01; z += 0.6)
    structure.box(
      [W.halfWidth * 2, 0.16, 0.05],
      [0, -0.11, Math.min(z, W.halfDepth + W.deckDepth - 0.03)],
      [0, 0, 0],
      { radius: 0.003 },
    );
  // Interior floorboards run along Z; deck boards run across X with 6 mm gaps.
  for (let x = -W.halfWidth + 0.07; x < W.halfWidth; x += 0.142)
    lining.box([0.136, 0.024, W.halfDepth * 2], [x, -0.012, 0], [0, 0, 0], {
      radius: 0.002,
      vary: 0.1,
    });
  for (let z = W.halfDepth + 0.07; z < W.halfDepth + W.deckDepth; z += 0.146)
    deck.box([W.halfWidth * 2 + 0.2, 0.028, 0.138], [0, -0.014, z], [0, 0, 0], {
      radius: 0.003,
      vary: 0.12,
    });
  // Two steps down from the deck.
  for (let s = 1; s <= 2; s++) {
    const z = W.halfDepth + W.deckDepth + 0.16 + (s - 1) * 0.3;
    deck.box([1.3, 0.028, 0.3], [0.6, -0.19 * s, z], [0, 0, 0], { radius: 0.003 });
    structure.box([0.05, 0.19 * s, 0.3], [0.0, (-0.19 * s) / 2 - 0.02, z], [0, 0, 0]);
    structure.box([0.05, 0.19 * s, 0.3], [1.2, (-0.19 * s) / 2 - 0.02, z], [0, 0, 0]);
  }
  // Deck screws: two per board per joist (visible at arm's length).
  const screws: { position: Vec3 }[] = [];
  for (let z = W.halfDepth + 0.07; z < W.halfDepth + W.deckDepth; z += 0.146)
    for (let x = -W.halfWidth + 0.2; x < W.halfWidth; x += 0.6)
      for (const dz of [-0.035, 0.035])
        screws.push({ position: [x + (random() - 0.5) * 0.01, 0.001, z + dz] });

  // ---- knee walls: vertical cedar outside, lining inside
  for (const side of [-1, 1]) {
    const x = side * W.halfWidth;
    for (let z = -W.halfDepth + 0.07; z < W.halfDepth; z += 0.142) {
      cedar.box(
        [0.022, W.kneeWall + 0.08, 0.13],
        [x + side * 0.03, W.kneeWall / 2 - 0.04, z],
        [0, 0, 0],
        { radius: 0.002, vary: 0.1 },
      );
      lining.box([0.016, W.kneeWall, 0.138], [x - side * 0.06, W.kneeWall / 2, z], [0, 0, 0], {
        radius: 0.001,
      });
    }
    structure.box([0.1, 0.12, W.halfDepth * 2], [x, W.kneeWall + 0.02, 0], [0, 0, 0], {
      radius: 0.004,
    });
  }

  // ---- gables
  const gableTop = (x: number) => W.kneeWall + (W.halfWidth - Math.abs(x)) * Math.tan(W.pitch);
  // Back gable: board-on-board cedar cut to the roof line, with a brass porthole.
  const porthole = { y: 2.55, r: 0.28 };
  for (let x = -W.halfWidth + 0.07; x < W.halfWidth; x += 0.14) {
    const top = gableTop(x) - 0.08;
    const holeGap = Math.abs(x) < porthole.r + 0.02;
    const layer = Math.round((x + W.halfWidth) / 0.14) % 2;
    const z = -W.halfDepth - 0.02 - layer * 0.02;
    if (holeGap) {
      const halfChord = Math.sqrt(Math.max(0, porthole.r ** 2 - x * x)) + 0.02;
      cedar.box(
        [0.13, porthole.y - halfChord, 0.02],
        [x, (porthole.y - halfChord) / 2, z],
        [0, 0, 0],
        { radius: 0.002 },
      );
      const upper = top - (porthole.y + halfChord);
      if (upper > 0.05)
        cedar.box([0.13, upper, 0.02], [x, porthole.y + halfChord + upper / 2, z], [0, 0, 0], {
          radius: 0.002,
        });
    } else cedar.box([0.13, top, 0.02], [x, top / 2, z], [0, 0, 0], { radius: 0.002 });
    lining.box(
      [0.138, Math.max(0.1, top - 0.1), 0.016],
      [x, Math.max(0.1, top - 0.1) / 2, -W.halfDepth + 0.05],
      [0, 0, 0],
      { radius: 0.001 },
    );
  }
  // Raking trims cover the cut board ends along both roof lines of the back gable.
  for (const side of [-1, 1]) {
    const len = Math.hypot(W.halfWidth, ridgeY - W.kneeWall);
    const angle = Math.atan2(ridgeY - W.kneeWall, W.halfWidth);
    cedar.box(
      [len + 0.05, 0.16, 0.035],
      [(side * W.halfWidth) / 2, (W.kneeWall + ridgeY) / 2 - 0.1, -W.halfDepth - 0.055],
      [0, 0, -side * angle],
      { radius: 0.004 },
    );
  }
  // …and inside, where the lifted hatch exposes the lining's stepped ends along the pitch.
  for (const side of [-1, 1]) {
    const len = Math.hypot(W.halfWidth, ridgeY - W.kneeWall);
    const angle = Math.atan2(ridgeY - W.kneeWall, W.halfWidth);
    lining.box(
      [len + 0.05, 0.24, 0.03],
      [(side * W.halfWidth) / 2, (W.kneeWall + ridgeY) / 2 - 0.2, -W.halfDepth + 0.045],
      [0, 0, -side * angle],
      { radius: 0.004 },
    );
  }
  const ring = new TorusGeometry(porthole.r, 0.028, 10, 40);
  metricUVs(ring, 0.3, 0, [0, 0]);
  brass.add(ring, compose([0, porthole.y, -W.halfDepth - 0.06]));
  const pane = new CylinderGeometry(porthole.r, porthole.r, 0.006, 32);
  pane.rotateX(Math.PI / 2);
  glass.add(pane, compose([0, porthole.y, -W.halfDepth - 0.05]));

  // Front gable: glazing between cedar mullions, a French door in the middle bay.
  const front = W.halfDepth;
  const mullions = [-W.halfWidth + 0.04, -1.55, -0.78, 0, 0.78, 1.55, W.halfWidth - 0.04];
  for (const x of mullions) {
    const top = gableTop(x) - 0.06;
    structure.box([0.07, top, 0.11], [x, top / 2, front], [0, 0, 0], { radius: 0.005 });
  }
  structure.box([W.halfWidth * 2, 0.08, 0.12], [0, 0.04, front], [0, 0, 0], { radius: 0.004 });
  // Transom only spans the gable's width at its height (the roof line cuts in above the knee wall).
  const transomY = 2.18;
  const transomHalf = W.halfWidth - (transomY - W.kneeWall) / Math.tan(W.pitch) - 0.05;
  structure.box([transomHalf * 2, 0.07, 0.11], [0, transomY, front], [0, 0, 0], { radius: 0.004 });
  // Raking frame members along both roof lines.
  for (const side of [-1, 1]) {
    const len = Math.hypot(W.halfWidth, ridgeY - W.kneeWall);
    const angle = Math.atan2(ridgeY - W.kneeWall, W.halfWidth);
    structure.box(
      [len, 0.1, 0.11],
      [(side * W.halfWidth) / 2, (W.kneeWall + ridgeY) / 2 - 0.05, front],
      [0, 0, -side * angle],
      { radius: 0.005 },
    );
  }
  // Glass: one plane per gable (thin), clipped to the triangle above the knee walls.
  const gableShape = new Shape();
  gableShape.moveTo(-W.halfWidth, 0);
  gableShape.lineTo(W.halfWidth, 0);
  gableShape.lineTo(W.halfWidth, W.kneeWall);
  gableShape.lineTo(0, ridgeY);
  gableShape.lineTo(-W.halfWidth, W.kneeWall);
  gableShape.closePath();
  const gableGlass = new ExtrudeGeometry(gableShape, { depth: 0.008, bevelEnabled: false });
  metricUVs(gableGlass, 1, 0, [0, 0]);
  glass.add(gableGlass, compose([0, 0, front - 0.004]));
  // Door: a slightly proud frame and two brass lever handles.
  structure.box([0.05, 2.1, 0.13], [-0.39, 1.05, front + 0.01]);
  structure.box([0.05, 2.1, 0.13], [0.39, 1.05, front + 0.01]);
  for (const x of [-0.08, 0.08]) {
    brass.box([0.018, 0.018, 0.13], [x, 1.02, front + 0.07], [0, 0, 0], { radius: 0.004 });
    brass.box([0.11, 0.016, 0.016], [x + Math.sign(x) * 0.05, 1.02, front + 0.13], [0, 0, 0], {
      radius: 0.006,
    });
  }

  // ---- roof slopes
  // Right-handed slope frame: u down-slope, v along the ridge, w out of the roof.
  const roofAngle = Math.atan2(ridgeY - eaveY, eaveRun);
  const slopeFrame = (side: number) =>
    new Matrix4().makeBasis(
      new Vector3(side * Math.cos(roofAngle), -Math.sin(roofAngle), 0),
      new Vector3(0, 0, -side),
      new Vector3(side * Math.sin(roofAngle), Math.cos(roofAngle), 0),
    );
  type Placement = { position: Vec3; rotation: Vec3; tone: Color };
  const tiles: { pan: Placement[]; cover: Placement[] } = { pan: [], cover: [] };
  const ridgeCaps: Placement[] = [];
  const glaze = (base: number) =>
    new Color().setHSL(
      0.042 + (random() - 0.5) * 0.02,
      0.6 + (random() - 0.5) * 0.12,
      base + 0.07 + (random() - 0.5) * 0.07,
    );
  const toEuler = (q: Quaternion): Vec3 => {
    const e = new Euler().setFromQuaternion(q);
    return [e.x, e.y, e.z];
  };

  const hatch = new Group();
  hatch.name = "roof-hatch";
  hatch.position.set(0, ridgeY, 0);
  const hatchInner = new Group();
  hatch.add(hatchInner);
  const fixed = new Group();
  fixed.name = "roof-fixed";
  fixed.position.set(0, ridgeY, 0);

  const buildSlope = (side: number, parent: Group, prefix: string) => {
    const frame = slopeFrame(side);
    const orient = new Quaternion().setFromRotationMatrix(frame);
    const axisU = new Vector3(1, 0, 0).applyQuaternion(orient);
    const axisV = new Vector3(0, 1, 0).applyQuaternion(orient);
    const axisW = new Vector3(0, 0, 1).applyQuaternion(orient);
    // Tiles: X along the ridge (v), Y out of the roof (w), Z down-slope (u).
    const tileQuat = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(axisV, axisW, axisU),
    );
    const local = (u: number, v: number, w: number) =>
      axisU.clone().multiplyScalar(u).addScaledVector(axisV, v).addScaledVector(axisW, w);
    const struct = new Batch(`${prefix}-rafters`, mats.structural, 1.4, seed + 20 + side);
    const sark = new Batch(`${prefix}-sarking`, mats.lining, 1.2, seed + 30 + side);
    const batten = new Batch(`${prefix}-battens`, mats.structural, 1.4, seed + 40 + side);
    const barge = new Batch(`${prefix}-barge`, mats.cedar, 1.2, seed + 45 + side);
    const place = (batch: Batch, size: Vec3, u: number, v: number, w: number) => {
      const g = new RoundedBoxGeometry(
        size[0],
        size[1],
        size[2],
        1,
        Math.min(0.004, Math.min(...size) / 4),
      );
      const grain = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;
      metricUVs(g, batch.textureMetres, grain as 0 | 1 | 2, [random() * 5, random() * 5]);
      batch.add(g, new Matrix4().compose(local(u, v, w), orient, new Vector3(1, 1, 1)));
    };
    for (let v = -roofHalfDepth + 0.05; v <= roofHalfDepth - 0.04; v += 0.6)
      place(struct, [slopeLength, 0.07, 0.19], slopeLength / 2, v, -0.1);
    for (let u = 0.075; u < slopeLength; u += 0.15)
      place(sark, [0.146, roofHalfDepth * 2, 0.02], u, 0, 0.01);
    const exposure = 0.32;
    const courses = Math.floor((slopeLength - 0.12) / exposure);
    for (let c = 0; c < courses; c++) {
      const u = slopeLength - 0.2 - c * exposure;
      place(batten, [0.05, roofHalfDepth * 2, 0.025], u - 0.12, 0, 0.032);
      for (let v = -roofHalfDepth + 0.12; v < roofHalfDepth - 0.05; v += 0.235) {
        // Each unit rests on the course below, so it sits a few degrees steeper than the rafters.
        const tilt = new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          -(0.05 + (random() - 0.5) * 0.02),
        );
        const yaw = new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          (random() - 0.5) * 0.02,
        );
        const q = tileQuat.clone().multiply(tilt).multiply(yaw);
        const pan = local(u, v, 0.058);
        tiles.pan.push({
          position: [pan.x, pan.y, pan.z],
          rotation: toEuler(q),
          tone: glaze(0.44),
        });
        if (v + 0.1175 < roofHalfDepth - 0.06) {
          const cover = local(u - 0.01, v + 0.1175, 0.1);
          tiles.cover.push({
            position: [cover.x, cover.y, cover.z],
            rotation: toEuler(q),
            tone: glaze(0.47),
          });
        }
      }
    }
    place(struct, [0.04, roofHalfDepth * 2 + 0.05, 0.2], slopeLength + 0.01, 0, 0.02);
    for (const v of [-roofHalfDepth, roofHalfDepth])
      place(barge, [slopeLength, 0.035, 0.22], slopeLength / 2, v, 0.04);
    for (const batch of [struct, sark, batten, barge]) {
      const mesh = batch.build();
      if (mesh) parent.add(mesh);
    }
  };
  for (let rv = -roofHalfDepth + 0.2; rv < roofHalfDepth; rv += 0.38)
    ridgeCaps.push({ position: [0, 0.075, rv], rotation: [0, 0, 0], tone: glaze(0.42) });
  buildSlope(-1, hatchInner, "hatch");
  buildSlope(1, fixed, "fixed");
  // Tiles are split by which slope they belong to, so the hatch carries its own.
  const split = (list: typeof tiles.pan) => ({
    hatch: list.filter((t) => t.position[0] < 0),
    fixed: list.filter((t) => t.position[0] >= 0),
  });
  const pans = split(tiles.pan);
  // Tile positions were computed relative to the ridge line (group origin at the ridge).
  const covers = split(tiles.cover);
  const panGeometry = panTile();
  const coverGeometry = coverTile();
  hatchInner.add(
    instances("hatch-pans", panGeometry, mats.tileCoral, pans.hatch),
    instances("hatch-covers", coverGeometry, mats.tileCoral, covers.hatch),
  );
  fixed.add(
    instances("fixed-pans", panGeometry, mats.tileCoral, pans.fixed),
    instances("fixed-covers", coverGeometry, mats.tileCoral, covers.fixed),
    instances("ridge", ridgeTile(), mats.tileCoral, ridgeCaps),
  );
  group.add(hatch, fixed);
  // The hatch's hinge: a continuous brass pin along the ridge with knuckles every 0.9 m, big
  // enough to read from the stay cameras as the line the roof turns on.
  brass.rod(
    [0, ridgeY + 0.03, -roofHalfDepth + 0.1],
    [0, ridgeY + 0.03, roofHalfDepth - 0.1],
    0.02,
    {
      segments: 10,
    },
  );
  for (let v = -roofHalfDepth + 0.3; v < roofHalfDepth; v += 0.9) {
    const knuckle = new CylinderGeometry(0.05, 0.05, 0.22, 14);
    knuckle.rotateX(Math.PI / 2);
    metricUVs(knuckle, 0.2, 2, [0, 0]);
    brass.add(knuckle, compose([0, ridgeY + 0.03, v]));
  }

  // ---- stove flue through the fixed slope, weather vane on the front of the ridge
  const flueX = 1.45;
  const flueZ = -1.55;
  steel.rod([flueX, 0.62, flueZ], [flueX, gableTop(flueX) + 0.9, flueZ], 0.075, { segments: 16 });
  // Rain cowl held clear of the pipe on three legs, and a storm collar above the flashing.
  const cap = new CylinderGeometry(0.03, 0.2, 0.12, 20);
  metricUVs(cap, 0.3, 1, [0, 0]);
  steel.add(cap, compose([flueX, gableTop(flueX) + 1.06, flueZ]));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    steel.rod(
      [flueX + Math.cos(a) * 0.07, gableTop(flueX) + 0.9, flueZ + Math.sin(a) * 0.07],
      [flueX + Math.cos(a) * 0.12, gableTop(flueX) + 1.02, flueZ + Math.sin(a) * 0.12],
      0.008,
      { segments: 6 },
    );
  }
  const collar = new CylinderGeometry(0.11, 0.11, 0.05, 20);
  metricUVs(collar, 0.3, 1, [0, 0]);
  steel.add(collar, compose([flueX, gableTop(flueX) + 0.2, flueZ]));
  const flashing = new CylinderGeometry(0.2, 0.2, 0.02, 16);
  metricUVs(flashing, 0.3, 1, [0, 0]);
  steel.add(flashing, compose([flueX, gableTop(flueX) + 0.1, flueZ], [0, 0, -W.pitch * 0.62]));
  const vane = new Group();
  vane.name = "weather-vane";
  vane.position.set(0, ridgeY + 0.12, roofHalfDepth - 0.25);
  const vaneBrass = new Batch("vane", mats.brass, 0.3, seed + 50);
  vaneBrass.rod([0, 0, 0], [0, 0.95, 0], 0.012);
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const)
    vaneBrass.rod([0, 0.55, 0], [dx * 0.22, 0.55, dz * 0.22], 0.006);
  const vaneTop = new Group();
  vaneTop.position.y = 0.8;
  const arrow = new Shape();
  arrow.moveTo(-0.34, -0.03);
  arrow.lineTo(0.2, -0.015);
  arrow.lineTo(0.2, -0.06);
  arrow.lineTo(0.34, 0);
  arrow.lineTo(0.2, 0.06);
  arrow.lineTo(0.2, 0.015);
  arrow.lineTo(-0.28, 0.03);
  arrow.lineTo(-0.36, 0.1);
  arrow.lineTo(-0.3, 0);
  arrow.lineTo(-0.36, -0.1);
  arrow.closePath();
  const arrowGeometry = new ExtrudeGeometry(arrow, { depth: 0.008, bevelEnabled: false });
  metricUVs(arrowGeometry, 0.3, 0, [0, 0]);
  const arrowBatch = new Batch("vane-arrow", mats.brass, 0.3, seed + 51);
  arrowBatch.add(arrowGeometry, compose([0, 0, -0.004]));
  const arrowMesh = arrowBatch.build();
  if (arrowMesh) vaneTop.add(arrowMesh);
  const vaneMesh = vaneBrass.build();
  if (vaneMesh) vane.add(vaneMesh);
  vane.add(vaneTop);
  group.add(vane);

  // ---- interior
  // Daybed against the back gable: timber base, linen mattress and pillows, a wool throw.
  structure.box([2.4, 0.32, 0.92], [0, 0.16, -W.halfDepth + 0.55], [0, 0, 0], { radius: 0.01 });
  fabric.add(
    new RoundedBoxGeometry(2.3, 0.16, 0.86, 3, 0.05),
    compose([0, 0.4, -W.halfDepth + 0.56]),
  );
  for (const x of [-0.75, 0, 0.75])
    fabric.add(
      new RoundedBoxGeometry(0.62, 0.14, 0.36, 3, 0.06),
      compose([x, 0.55, -W.halfDepth + 0.3], [0.25, (random() - 0.5) * 0.2, 0]),
    );
  wool.add(
    new RoundedBoxGeometry(1.2, 0.035, 0.9, 2, 0.015),
    compose([0.55, 0.5, -W.halfDepth + 0.6], [0.02, 0.18, 0.04]),
  );
  wool.add(
    new RoundedBoxGeometry(0.34, 0.06, 0.9, 2, 0.02),
    compose([1.2, 0.34, -W.halfDepth + 0.98], [0, 0.18, 1.2]),
  );
  // Reading chair and side table by the glazing, a lamp that becomes the room's practical.
  const chairX = -1.25;
  const chairZ = 1.45;
  mats.wool &&
    wool.add(
      new RoundedBoxGeometry(0.78, 0.18, 0.72, 3, 0.05),
      compose([chairX, 0.38, chairZ], [0, 0.6, 0]),
    );
  wool.add(
    new RoundedBoxGeometry(0.78, 0.62, 0.16, 3, 0.05),
    compose([chairX - 0.22, 0.66, chairZ - 0.26], [-0.18, 0.6, 0]),
  );
  structure.box([0.06, 0.3, 0.06], [chairX - 0.3, 0.15, chairZ + 0.18], [0, 0.6, 0]);
  structure.box([0.06, 0.3, 0.06], [chairX + 0.26, 0.15, chairZ - 0.2], [0, 0.6, 0]);
  structure.box([0.06, 0.3, 0.06], [chairX + 0.02, 0.15, chairZ + 0.42], [0, 0.6, 0]);
  structure.box([0.06, 0.3, 0.06], [chairX - 0.52, 0.15, chairZ - 0.04], [0, 0.6, 0]);
  const tableX = -0.45;
  const tableZ = 1.95;
  structure.box([0.5, 0.03, 0.5], [tableX, 0.58, tableZ], [0, 0.3, 0], { radius: 0.006 });
  for (const [dx, dz] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ] as const)
    structure.box([0.035, 0.57, 0.035], [tableX + dx, 0.285, tableZ + dz], [0, 0.3, 0]);
  brass.rod([tableX + 0.1, 0.6, tableZ - 0.08], [tableX + 0.1, 0.98, tableZ - 0.08], 0.008);
  brass.add(
    new CylinderGeometry(0.07, 0.08, 0.02, 20),
    compose([tableX + 0.1, 0.605, tableZ - 0.08]),
  );
  const shadeMaterial = mats.lampShade.clone();
  const shade = new Mesh(new CylinderGeometry(0.09, 0.14, 0.17, 24, 1, true), shadeMaterial);
  shade.position.set(tableX + 0.1, 1.02, tableZ - 0.08);
  shade.castShadow = false;
  group.add(shade);
  const lamp = new PointLight(0xffb46b, 1);
  lamp.position.set(tableX + 0.1, 0.98, tableZ - 0.08);
  group.add(lamp);
  // A mug and a small stack of books on the table.
  mats.ceramic &&
    group.add(
      meshAt(new CylinderGeometry(0.042, 0.036, 0.09, 20), mats.ceramic, [
        tableX - 0.1,
        0.64,
        tableZ + 0.06,
      ]),
    );
  // Bookshelf along the fixed knee wall, three shelves of real book sizes. Spines come from
  // a cloth-binding palette (sRGB): random hues read through the glazing as rainbow flecks.
  const BINDINGS = [
    0x6b2a26, 0x8a4a2b, 0xa37b3b, 0x5d6038, 0x2f4a3a, 0x2b3a55, 0x4d5561, 0xd8cfb8, 0x9c8467,
    0x2e2c2b, 0x3e6461, 0x4b3145,
  ];
  const books: { position: Vec3; rotation: Vec3; scale: Vec3; tone: Color }[] = [];
  const shelfX = W.halfWidth - 0.3;
  for (let s = 0; s < 3; s++) {
    const y = 0.06 + s * 0.3;
    structure.box([0.32, 0.024, 3.0], [shelfX, y, 0.1], [0, 0, 0], { radius: 0.003 });
    let z = -1.35;
    while (z < 1.55) {
      const thickness = 0.02 + random() * 0.035;
      const height = 0.17 + random() * 0.08;
      const depth = 0.12 + random() * 0.08;
      if (random() < 0.08) {
        z += 0.06;
        continue;
      }
      const lean = random() < 0.1 ? 0.25 : 0;
      books.push({
        position: [shelfX + 0.02, y + 0.012 + height / 2, z + thickness / 2],
        rotation: [lean, 0, 0],
        scale: [depth, height, thickness],
        tone: new Color(
          BINDINGS[Math.floor(random() * BINDINGS.length)] ?? 0x9c8467,
        ).multiplyScalar(0.85 + random() * 0.3),
      });
      z += thickness + 0.002;
    }
  }
  structure.box([0.32, 0.9, 0.024], [shelfX, 0.45, -1.4], [0, 0, 0]);
  structure.box([0.32, 0.9, 0.024], [shelfX, 0.45, 1.6], [0, 0, 0]);
  group.add(instances("books", new RoundedBoxGeometry(1, 1, 1, 1, 0.08), mats.books, books));
  // Wood stove on a slate hearth, with a practical glow behind its door.
  slate.box([0.8, 0.03, 0.8], [flueX, 0.015, flueZ], [0, 0, 0], { radius: 0.004 });
  steel.box([0.44, 0.46, 0.4], [flueX, 0.36, flueZ], [0, 0, 0], { radius: 0.015 });
  for (const [dx, dz] of [
    [-0.18, -0.15],
    [0.18, -0.15],
    [-0.18, 0.15],
    [0.18, 0.15],
  ] as const)
    steel.rod([flueX + dx, 0.03, flueZ + dz], [flueX + dx, 0.14, flueZ + dz], 0.015);
  const fireMaterial = mats.fire.clone();
  const fireWindow = new Mesh(new RoundedBoxGeometry(0.24, 0.16, 0.01, 1, 0.01), fireMaterial);
  fireWindow.position.set(flueX - 0.225, 0.38, flueZ);
  fireWindow.rotation.y = -Math.PI / 2;
  group.add(fireWindow);
  const fireLight = new PointLight(0xff8a3c, 1);
  fireLight.position.set(flueX - 0.35, 0.4, flueZ);
  group.add(fireLight);
  // Rug and a brass barometer on the back gable.
  rug.add(new RoundedBoxGeometry(2.2, 0.012, 1.5, 1, 0.004), compose([0, 0.006, 0.35]));
  brass.add(
    new CylinderGeometry(0.13, 0.13, 0.035, 32),
    compose([0, 2.0, -W.halfDepth + 0.08], [Math.PI / 2, 0, 0]),
  );
  mats.paper &&
    group.add(
      meshAt(
        new CylinderGeometry(0.11, 0.11, 0.004, 32),
        mats.paper,
        [0, 2.0, -W.halfDepth + 0.1],
        [Math.PI / 2, 0, 0],
      ),
    );

  // ---- gas struts from the wall plate to the hatch, 1.9 m down-slope under the rafters
  const struts: { body: Mesh; rod: Mesh; anchor: Vector3; mount: Vector3 }[] = [];
  const mountU = 1.9;
  for (const z of [-1.6, 1.6]) {
    const body = new Mesh(new CylinderGeometry(0.045, 0.045, 1, 16), mats.steel);
    const rod = new Mesh(new CylinderGeometry(0.02, 0.02, 1, 12), mats.brass);
    body.castShadow = rod.castShadow = true;
    group.add(body, rod);
    // Brass brackets at both ends: a plate on the wall plate, and one under the lid that
    // moves with it, so each strut visibly bolts to something.
    brass.box([0.07, 0.035, 0.06], [-W.halfWidth + 0.12, W.kneeWall + 0.065, z], [0, 0, 0], {
      radius: 0.006,
    });
    const lidBracket = new Mesh(new RoundedBoxGeometry(0.07, 0.03, 0.06, 1, 0.006), mats.brass);
    lidBracket.position.set(
      -Math.cos(roofAngle) * mountU + Math.sin(roofAngle) * 0.2,
      -Math.sin(roofAngle) * mountU - Math.cos(roofAngle) * 0.2,
      z,
    );
    lidBracket.rotation.z = roofAngle;
    lidBracket.castShadow = true;
    hatch.add(lidBracket);
    struts.push({
      body,
      rod,
      anchor: new Vector3(-W.halfWidth + 0.12, W.kneeWall + 0.08, z),
      mount: new Vector3(
        -Math.cos(roofAngle) * mountU + Math.sin(roofAngle) * 0.22,
        -Math.sin(roofAngle) * mountU - Math.cos(roofAngle) * 0.22,
        z,
      ),
    });
  }

  for (const batch of [
    cedar,
    structure,
    deck,
    lining,
    concrete,
    steel,
    brass,
    glass,
    fabric,
    wool,
    rug,
    slate,
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
  group.add(instances("deck-screws", fastenerGeometry(), mats.steel, screws));

  const mountPoint = new Vector3();
  const direction = new Vector3();
  const up = new Vector3(0, 1, 0);
  const setOpen = (amount: number) => {
    // 0.72 rad leaves the lid pitched ~17° below level, so it reads as a hinged roof slope
    // rather than a flat slab floating over the room.
    hatch.rotation.z = -amount * 0.72;
    hatch.updateMatrix();
    for (const strut of struts) {
      mountPoint.copy(strut.mount).applyMatrix4(hatch.matrix);
      const length = strut.anchor.distanceTo(mountPoint);
      direction.copy(mountPoint).sub(strut.anchor).normalize();
      // Body (fixed 1.1 m) from the anchor; the polished rod fills the remaining length.
      const bodyLength = Math.min(1.1, length * 0.55);
      strut.body.scale.set(1, bodyLength, 1);
      strut.body.position.copy(strut.anchor).addScaledVector(direction, bodyLength / 2);
      strut.body.quaternion.setFromUnitVectors(up, direction);
      strut.rod.scale.set(1, length - bodyLength + 0.05, 1);
      strut.rod.position.copy(mountPoint).addScaledVector(direction, -(length - bodyLength) / 2);
      strut.rod.quaternion.setFromUnitVectors(up, direction);
    }
  };
  setOpen(0);
  return {
    group,
    setOpen,
    lights: [
      { light: lamp, candela: 20 },
      { light: fireLight, candela: 6 },
    ],
    emissive: [
      { material: shadeMaterial, luminance: 900 },
      { material: fireMaterial, luminance: 1800 },
    ],
    focus: new Vector3(0, 1.8, 0.4),
    update(time) {
      vane.rotation.y = Math.sin(time * 0.23) * 0.5 + Math.sin(time * 0.61) * 0.12;
    },
  };
}

function meshAt(
  geometry: BufferGeometry,
  material: import("three").Material,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

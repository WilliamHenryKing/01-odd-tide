import {
  CircleGeometry,
  Color,
  CustomBlending,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PointLight,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Materials } from "../materials";
import { Batch, compose, metricUVs, rng, type Vec3 } from "./kit";
import type { Building } from "./weather-house";

// The Borrowed Bath: a round cedar hot tub on a small deck at the end of the tidal causeway.
// Staves bound with two steel hoops, an inside bench, a wood-fired stove with a flue, timber
// steps, a towel rail and a lantern. The water reflects by Fresnel and ripples slowly.

export const BATH = { radius: 0.95, height: 0.98, stave: 0.11, deck: 2.1 };

export function buildBath(mats: Materials, seed = 41): Building & { water: Mesh } {
  const B = BATH;
  const random = rng(seed);
  const group = new Group();
  group.name = "borrowed-bath";
  const cedar = new Batch("bath-cedar", mats.cedar, 1.0, seed + 1);
  const deck = new Batch("bath-deck", mats.deck, 1.4, seed + 2);
  const structure = new Batch("bath-structure", mats.structural, 1.4, seed + 3);
  const steel = new Batch("bath-steel", mats.steel, 1, seed + 4);
  const brass = new Batch("bath-brass", mats.brass, 0.4, seed + 5);
  const linen = new Batch("bath-linen", mats.linen, 0.6, seed + 6);
  const glass = new Batch("bath-glass", mats.glass, 1, seed + 7);

  // Deck: square boards on joists; the tub sits in the middle.
  for (let x = -B.deck + 0.07; x < B.deck; x += 0.146)
    deck.box([0.138, 0.028, B.deck * 2 - 0.2], [x, -0.014, 0], [0, 0, 0], {
      radius: 0.003,
      vary: 0.12,
    });
  for (const z of [-B.deck + 0.2, 0, B.deck - 0.2])
    structure.box([B.deck * 2, 0.16, 0.06], [0, -0.11, z], [0, 0, 0], { radius: 0.004 });
  for (const x of [-B.deck + 0.2, B.deck - 0.2])
    for (const z of [-B.deck + 0.2, B.deck - 0.2])
      structure.box([0.14, 1.0, 0.14], [x, -0.6, z], [0, 0, 0], { radius: 0.01 });

  // Staves: slightly tapered planks around the circle, each with its own tone.
  const staves = Math.round((Math.PI * 2 * B.radius) / B.stave);
  for (let i = 0; i < staves; i++) {
    const a = (i / staves) * Math.PI * 2;
    const r = B.radius + 0.022;
    cedar.box(
      [B.stave - 0.004, B.height + (random() - 0.5) * 0.01, 0.044],
      [Math.cos(a) * r, B.height / 2, Math.sin(a) * r],
      [0, Math.PI / 2 - a, 0],
      { radius: 0.004, vary: 0.12 },
    );
  }
  // Floor of the tub and the inside bench ring.
  cedar.add(new CylinderGeometry(B.radius, B.radius, 0.04, 40), compose([0, 0.06, 0]));
  for (let i = 0; i < 18; i++) {
    const a = Math.PI * 0.15 + (i / 18) * Math.PI * 1.6;
    const r = B.radius - 0.2;
    cedar.box(
      [0.12, 0.035, 0.3],
      [Math.cos(a) * r, 0.46, Math.sin(a) * r],
      [0, Math.PI / 2 - a, 0],
      { radius: 0.004 },
    );
  }
  // Two steel hoops with tensioning lugs.
  for (const y of [0.18, B.height - 0.22]) {
    const hoop = new TorusGeometry(B.radius + 0.05, 0.012, 6, 64);
    hoop.rotateX(Math.PI / 2);
    metricUVs(hoop, 0.5, 0, [0, 0]);
    steel.add(hoop, compose([0, y, 0]));
    steel.box([0.05, 0.04, 0.04], [B.radius + 0.07, y, 0], [0, 0, 0], { radius: 0.005 });
  }
  // A cedar rim cap on the top edge.
  const cap = new TorusGeometry(B.radius + 0.02, 0.03, 8, 72);
  cap.rotateX(Math.PI / 2);
  cap.scale(1, 0.5, 1);
  metricUVs(cap, 0.8, 0, [0, 0]);
  cedar.add(cap, compose([0, B.height + 0.005, 0]));

  // Steps up to the rim.
  for (let s = 0; s < 3; s++) {
    const y = 0.22 + s * 0.24;
    cedar.box([0.62, 0.035, 0.3], [0, y, B.radius + 0.62 - s * 0.24], [0, 0, 0], { radius: 0.004 });
    structure.box([0.05, y, 0.3], [-0.28, y / 2, B.radius + 0.62 - s * 0.24]);
    structure.box([0.05, y, 0.3], [0.28, y / 2, B.radius + 0.62 - s * 0.24]);
  }
  // Wood-fired stove beside the tub with its flue, and a glow in the firebox.
  const stove: Vec3 = [-B.radius - 0.45, 0, -0.35];
  steel.box([0.36, 0.52, 0.42], [stove[0], 0.3, stove[2]], [0, 0.2, 0], { radius: 0.02 });
  steel.rod([stove[0], 0.56, stove[2]], [stove[0], 2.1, stove[2]], 0.055, { segments: 14 });
  steel.add(new CylinderGeometry(0.03, 0.11, 0.08, 16), compose([stove[0], 2.15, stove[2]]));
  steel.rod([stove[0] + 0.18, 0.28, stove[2]], [-B.radius + 0.05, 0.28, stove[2] + 0.05], 0.03);
  const fireMaterial = mats.fire.clone();
  const firebox = new Mesh(new RoundedBoxGeometry(0.2, 0.14, 0.01, 1, 0.01), fireMaterial);
  firebox.position.set(stove[0] - 0.02, 0.32, stove[2] + 0.215);
  group.add(firebox);
  const fire = new PointLight(0xff8a3c, 1);
  fire.position.set(stove[0], 0.35, stove[2] + 0.35);
  group.add(fire);
  // Logs stacked by the stove.
  for (let i = 0; i < 7; i++) {
    const row = Math.floor(i / 3);
    structure.rod(
      [stove[0] - 0.3 + (i % 3) * 0.12, 0.06 + row * 0.1, stove[2] + 0.45],
      [stove[0] - 0.3 + (i % 3) * 0.12 + 0.02, 0.06 + row * 0.1, stove[2] + 0.85],
      0.05,
      { segments: 8, vary: 0.2 },
    );
  }
  // Towel rail with a folded towel; a lantern on a post.
  structure.box([0.05, 1.0, 0.05], [B.radius + 0.9, 0.5, -0.9]);
  structure.box([0.05, 1.0, 0.05], [B.radius + 0.9, 0.5, -0.1]);
  structure.box([0.05, 0.05, 0.9], [B.radius + 0.9, 0.98, -0.5]);
  linen.add(
    new RoundedBoxGeometry(0.06, 0.55, 0.5, 2, 0.02),
    compose([B.radius + 0.92, 0.72, -0.5]),
    { tone: 1 },
  );
  structure.box([0.08, 1.9, 0.08], [-B.deck + 0.25, 0.95, B.deck - 0.25], [0, 0, 0], {
    radius: 0.01,
  });
  const lanternGlass = mats.bulb.clone();
  const lanternCore = new Mesh(new CylinderGeometry(0.06, 0.06, 0.16, 16), lanternGlass);
  lanternCore.position.set(-B.deck + 0.25, 1.62, B.deck - 0.1);
  group.add(lanternCore);
  brass.add(
    new CylinderGeometry(0.09, 0.09, 0.02, 16),
    compose([-B.deck + 0.25, 1.72, B.deck - 0.1]),
  );
  brass.add(
    new CylinderGeometry(0.02, 0.09, 0.08, 16),
    compose([-B.deck + 0.25, 1.77, B.deck - 0.1]),
  );
  brass.add(
    new CylinderGeometry(0.08, 0.08, 0.02, 16),
    compose([-B.deck + 0.25, 1.53, B.deck - 0.1]),
  );
  for (const [dx, dz] of [
    [0.07, 0],
    [-0.07, 0],
    [0, 0.07],
    [0, -0.07],
  ] as const)
    brass.rod(
      [-B.deck + 0.25 + dx, 1.53, B.deck - 0.1 + dz],
      [-B.deck + 0.25 + dx, 1.72, B.deck - 0.1 + dz],
      0.006,
    );
  structure.box([0.3, 0.04, 0.04], [-B.deck + 0.25, 1.78, B.deck - 0.2], [0, 0, 0]);
  const lanternLight = new PointLight(0xffb86b, 1);
  lanternLight.position.copy(lanternCore.position);
  group.add(lanternLight);
  void glass;

  // Bath water: almost no diffuse colour of its own. It reflects sky and rim by Fresnel, lets
  // the tub show through darkened by ~0.5 m of depth, and carries slow ripples from the jets.
  const bathTime = { value: 0 };
  const waterMaterial = new MeshPhysicalMaterial({
    name: "bath-water",
    color: new Color(0.03, 0.07, 0.065),
    roughness: 0.05,
    metalness: 0,
    ior: 1.333,
    transparent: true,
    depthWrite: false,
  });
  waterMaterial.blending = CustomBlending;
  waterMaterial.blendSrc = OneFactor;
  waterMaterial.blendDst = OneMinusSrcAlphaFactor;
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.bathTime = bathTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vBathLocal;
        varying vec3 vBathX;
        varying vec3 vBathY;
        varying vec3 vBathZ;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vBathLocal = position.xy;
        vBathX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vBathY = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
        vBathZ = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float bathTime;
        varying vec2 vBathLocal;
        varying vec3 vBathX;
        varying vec3 vBathY;
        varying vec3 vBathZ;`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        {
          // Ring ripples out from the centre jet plus a slow cross-chop, as a height gradient.
          vec2 p = vBathLocal;
          float r = max(length(p), 1e-3);
          vec2 grad = (p / r) * cos(r * 34.0 - bathTime * 2.1) * 0.014;
          grad += vec2(cos(p.x * 21.0 + bathTime * 1.3), cos(p.y * 17.0 - bathTime * 1.1)) * 0.007;
          normal = normalize(vBathX * -grad.x + vBathY * -grad.y + vBathZ);
        }`,
      )
      .replace(
        "#include <opaque_fragment>",
        `float waterCos = saturate(dot(normal, normalize(vViewPosition)));
        float waterFresnel = 0.02 + 0.98 * pow(1.0 - waterCos, 5.0);
        // Alpha is how much of the tub behind is hidden: reflection at grazing angles, and
        // absorption through the water's depth at any angle.
        gl_FragColor = vec4(outgoingLight, clamp(max(waterFresnel, 0.55), 0.0, 1.0));`,
      );
  };
  waterMaterial.customProgramCacheKey = () => "odd-tide-bath-water-v1";
  const water = new Mesh(new CircleGeometry(B.radius - 0.01, 48), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = B.height - 0.16;
  water.receiveShadow = true;
  group.add(water);

  for (const batch of [cedar, deck, structure, steel, brass, linen]) {
    const mesh = batch.build();
    if (mesh) group.add(mesh);
  }
  return {
    group,
    water,
    setOpen() {},
    update(time: number) {
      bathTime.value = time;
    },
    lights: [
      { light: fire, candela: 8 },
      { light: lanternLight, candela: 18 },
    ],
    emissive: [
      { material: fireMaterial, luminance: 2200 },
      { material: lanternGlass, luminance: 5000 },
    ],
    focus: new Vector3(0, 0.8, 0),
  };
}

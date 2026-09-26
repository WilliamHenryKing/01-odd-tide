import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function texture(kind: "wood" | "rock" | "roof") {
  const rnd = random(kind === "wood" ? 341 : kind === "rock" ? 573 : 819);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas texture unavailable");
  ctx.fillStyle = "#c2bda9";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const n = 100 + Math.floor(rnd() * 110);
    ctx.fillStyle = `rgba(${n},${n},${n},${kind === "wood" ? 0.22 : 0.3})`;
    ctx.fillRect(
      rnd() * 256,
      rnd() * 256,
      kind === "wood" ? 1 : 1 + rnd() * 3,
      kind === "wood" ? 20 + rnd() * 90 : 2,
    );
  }
  if (kind === "wood")
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = "rgba(20,30,25,.3)";
      ctx.fillRect(x, 0, 1, 256);
    }
  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  result.wrapS = result.wrapT = RepeatWrapping;
  result.anisotropy = 4;
  return result;
}
export function materialKit() {
  const timber = texture("wood"),
    stone = texture("rock"),
    glaze = texture("roof");
  return {
    board: new MeshStandardMaterial({
      color: "#c8ad82",
      map: timber,
      bumpMap: timber,
      bumpScale: 0.025,
      roughness: 0.92,
    }),
    cream: new MeshStandardMaterial({ color: "#efe5c8", roughness: 0.83 }),
    dark: new MeshStandardMaterial({ color: "#264839", map: timber, roughness: 0.76 }),
    tile: new MeshPhysicalMaterial({
      color: "#d86e46",
      map: glaze,
      roughness: 0.3,
      clearcoat: 0.65,
      clearcoatRoughness: 0.3,
    }),
    blue: new MeshPhysicalMaterial({ color: "#447e82", roughness: 0.38, clearcoat: 0.5 }),
    sand: new MeshStandardMaterial({
      color: "#c2b192",
      map: stone,
      bumpMap: stone,
      bumpScale: 0.055,
      roughness: 1,
    }),
    rock: new MeshStandardMaterial({
      color: "#a79e86",
      map: stone,
      bumpMap: stone,
      bumpScale: 0.055,
      roughness: 0.96,
    }),
    grass: new MeshStandardMaterial({ color: "#798350", map: stone, roughness: 0.95 }),
    leaf: new MeshStandardMaterial({ color: "#345b43", roughness: 0.9 }),
    leafLight: new MeshStandardMaterial({ color: "#647a45", roughness: 0.9 }),
    brass: new MeshStandardMaterial({ color: "#b69150", metalness: 0.65, roughness: 0.4 }),
    glass: new MeshPhysicalMaterial({
      color: "#c9e8da",
      roughness: 0.1,
      metalness: 0.12,
      transparent: true,
      opacity: 0.47,
      side: DoubleSide,
      depthWrite: false,
    }),
    glow: new MeshStandardMaterial({
      color: "#ffd995",
      emissive: "#ffa947",
      emissiveIntensity: 0.6,
      roughness: 0.5,
    }),
    fabric: new MeshStandardMaterial({ color: "#e7b36c", roughness: 1 }),
    textures: [timber, stone, glaze],
  };
}
export type Kit = ReturnType<typeof materialKit>;
export function box(
  parent: Group,
  material: Material,
  size: [number, number, number],
  position: [number, number, number],
  radius = 0.025,
): Mesh {
  const geo =
    radius > 0
      ? new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map((v) => v / 3)))
      : new BoxGeometry(...size);
  const mesh = new Mesh(geo, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function rod(parent: Group, material: Material, from: Vector3, to: Vector3, radius = 0.035) {
  const delta = to.clone().sub(from);
  const mesh = new Mesh(new CylinderGeometry(radius, radius, delta.length(), 8), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function islet(
  parent: Group,
  kit: Kit,
  x: number,
  z: number,
  rx: number,
  rz: number,
  height: number,
  seed: number,
) {
  const noise = random(seed);
  const points = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI * 2) / 24;
    const r = 0.96 + Math.sin(a * 3 + seed) * 0.11 + Math.cos(a * 5) * 0.045 + noise() * 0.05;
    return [Math.cos(a) * rx * r, Math.sin(a) * rz * r] as const;
  });
  const group = new Group();
  group.position.set(x, 0, z);
  parent.add(group);
  for (let layer = 0; layer < 9; layer++) {
    const top = layer === 8;
    const scale = 1.075 - layer * 0.023 + (layer % 3 === 0 ? 0.018 : 0);
    const shape = new Shape();
    points.forEach(([px, pz], i) => {
      if (i === 0) shape.moveTo(px * scale, pz * scale);
      else shape.lineTo(px * scale, pz * scale);
    });
    shape.closePath();
    const depth = top ? 0.12 : height / 8;
    const geometry = new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: top ? 0.09 : 0.045,
      bevelThickness: top ? 0.035 : 0.025,
      bevelSegments: 2,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const material = top ? kit.grass : layer % 2 === 0 ? kit.sand : kit.rock;
    const mesh = new Mesh(geometry, material);
    mesh.position.y = -0.16 + (layer * (height - 0.16)) / 8;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Ledges and fractured ends interrupt the strata instead of duplicating a perfect stack.
  for (let i = 0; i < 18; i++) {
    const a = noise() * Math.PI * 2;
    const shard = new Mesh(
      new IcosahedronGeometry(0.2 + noise() * 0.2, 0),
      i % 3 ? kit.rock : kit.sand,
    );
    shard.position.set(
      Math.cos(a) * rx * 0.94,
      0.1 + noise() * (height - 0.4),
      Math.sin(a) * rz * 0.94,
    );
    shard.scale.set(1, 0.4 + noise() * 0.5, 1);
    shard.rotation.y = a;
    shard.castShadow = shard.receiveShadow = true;
    group.add(shard);
  }
  return group;
}
export function tree(parent: Group, kit: Kit, x: number, y: number, z: number, scale: number) {
  const group = new Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  rod(group, kit.dark, new Vector3(), new Vector3(0.25, 1.15, -0.08), 0.055);
  for (let i = 0; i < 8; i++) {
    const crown = new Mesh(new IcosahedronGeometry(0.46, 1), i % 3 ? kit.leaf : kit.leafLight);
    const end = new Vector3(
      Math.sin(i * 2.4) * 0.35 + i * 0.07,
      0.9 + i * 0.075,
      Math.cos(i * 2.4) * 0.27,
    );
    rod(group, kit.dark, new Vector3(0.12, 0.55, 0), end, 0.028);
    crown.position.copy(end);
    crown.scale.set(1.15, 0.4, 0.85);
    crown.rotation.set(i * 0.13, i * 1.7, -0.15);
    crown.castShadow = true;
    group.add(crown);
  }
  return group;
}
function furnishings(group: Group, kit: Kit, width: number, depth: number, family: boolean) {
  if (family) {
    for (const side of [-1, 1]) {
      const x = side * 0.76;
      box(group, kit.dark, [0.68, 0.22, 1.45], [x, 0.16, -0.08]);
      box(group, kit.fabric, [0.62, 0.12, 1.4], [x, 0.32, -0.08]);
      box(group, kit.cream, [0.5, 0.1, 0.3], [x, 0.42, -0.52]);
      box(group, kit.cream, [0.59, 0.018, 0.12], [x, 0.39, 0.41]);
    }
    box(group, kit.board, [0.48, 0.055, 1.12], [0, 0.55, 0.14]);
    for (const x of [-0.18, 0.18])
      for (const z of [-0.32, 0.56]) box(group, kit.dark, [0.045, 0.5, 0.045], [x, 0.28, z]);
    box(group, kit.tile, [0.34, 0.012, 0.8], [0, 0.59, 0.1]);
    for (const z of [-0.17, 0.32]) {
      const cup = new Mesh(new CylinderGeometry(0.05, 0.04, 0.08, 16), kit.cream);
      cup.position.set(0, 0.64, z);
      group.add(cup);
    }
    const lamp = new Mesh(new SphereGeometry(0.1, 16, 12), kit.glow);
    lamp.position.set(0, 0.68, 0.56);
    group.add(lamp);
    return;
  }
  box(group, kit.dark, [width * 0.65, 0.13, depth * 0.47], [0.12, 0.14, -0.2]);
  box(group, kit.fabric, [width * 0.64, 0.13, depth * 0.45], [0.12, 0.24, -0.2]);
  box(group, kit.cream, [width * 0.28, 0.11, 0.34], [-width * 0.13, 0.35, -depth * 0.21]);
  box(group, kit.cream, [width * 0.28, 0.11, 0.34], [width * 0.18, 0.35, -depth * 0.21]);
  box(group, kit.tile, [width * 0.36, 0.035, depth * 0.4], [-0.1, 0.095, depth * 0.18]);
  for (let i = 0; i < 7; i++)
    box(group, kit.cream, [width * 0.34, 0.009, 0.028], [-0.1, 0.119, depth * 0.02 + i * 0.09]);
  box(group, kit.board, [0.4, 0.4, 0.36], [width * 0.34, 0.26, depth * 0.18]);
  const lamp = new Mesh(new SphereGeometry(0.12, 16, 12), kit.glow);
  lamp.position.set(width * 0.34, 0.56, depth * 0.18);
  group.add(lamp);
  for (let i = 0; i < 3; i++)
    box(
      group,
      i % 2 ? kit.dark : kit.blue,
      [0.15, 0.03, 0.2],
      [width * 0.34, 0.49 + i * 0.035, depth * 0.32],
    );
  const cup = new Mesh(new CylinderGeometry(0.048, 0.04, 0.07, 16), kit.cream);
  cup.position.set(width * 0.3, 0.5, depth * 0.09);
  group.add(cup);
}
export function cabin(kit: Kit, kind: "a" | "round" | "lodge") {
  const group = new Group(),
    roof = new Group();
  const width = kind === "lodge" ? 2.3 : 1.75,
    depth = kind === "lodge" ? 1.9 : 1.65;
  const floor = new Group();
  group.add(floor);
  for (let i = 0; i < 14; i++)
    box(
      floor,
      kit.board,
      [width + 0.6, 0.08, (depth + 0.8) / 14 - 0.014],
      [0, 0, -depth / 2 - 0.35 + (i * (depth + 0.8)) / 14],
    );
  for (const x of [-width / 2, width / 2])
    for (const z of [-depth / 2, depth / 2]) box(group, kit.dark, [0.13, 0.7, 0.13], [x, -0.3, z]);
  if (kind === "round") {
    const wall = new Mesh(
      new CylinderGeometry(0.86, 0.86, 1.05, 36, 1, true, Math.PI * 0.28, Math.PI * 1.45),
      kit.cream,
    );
    wall.position.y = 0.55;
    wall.castShadow = true;
    group.add(wall);
    const rim = new Mesh(new TorusGeometry(0.87, 0.045, 8, 48), kit.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.1;
    group.add(rim);
    const dome = new Mesh(
      new SphereGeometry(0.94, 40, 18, 0, Math.PI * 1.45, 0, Math.PI / 2),
      kit.blue,
    );
    dome.scale.y = 0.7;
    roof.add(dome);
    const shutter = new Group();
    const cap = new Mesh(
      new SphereGeometry(0.957, 24, 18, Math.PI * 1.45, Math.PI * 0.55, 0, Math.PI / 2),
      kit.blue,
    );
    cap.scale.y = 0.7;
    shutter.add(cap);
    roof.add(shutter);
    roof.userData.shutter = shutter;
    roof.rotation.y = 2.7;
    roof.position.y = 1.11;
    group.add(roof);
    rod(group, kit.brass, new Vector3(0.35, 0.2, 0.25), new Vector3(0.35, 0.8, 0.25), 0.035);
    const telescope = new Mesh(new CylinderGeometry(0.075, 0.09, 0.4, 16), kit.brass);
    telescope.rotation.z = -0.75;
    telescope.position.set(0.35, 0.86, 0.25);
    group.add(telescope);
  } else {
    const height = kind === "a" ? 0.62 : 1.05;
    box(group, kit.cream, [width, height, 0.09], [0, height / 2 + 0.07, -depth / 2]);
    for (const sign of [-1, 1])
      box(group, kit.dark, [0.09, height, depth], [(sign * width) / 2, height / 2 + 0.07, 0]);
    box(group, kit.glass, [width - 0.2, height, 0.03], [0, height / 2 + 0.06, depth / 2]);
    for (const x of [-width / 2, 0, width / 2])
      box(group, kit.board, [0.055, height + 0.1, 0.1], [x, height / 2 + 0.07, depth / 2 + 0.02]);
    box(group, kit.brass, [0.024, 0.12, 0.03], [0.12, height * 0.5, depth / 2 + 0.07]);
    box(group, kit.board, [width + 0.14, 0.06, 0.1], [0, height + 0.09, depth / 2 + 0.04]);
    const pitch = kind === "a" ? 0.91 : 0.58;
    const half = width / 2 + 0.16;
    const slope = half / Math.cos(pitch);
    const ridgeHeight = height + Math.tan(pitch) * half;
    roof.position.set(-half, height + 0.08, 0);
    for (const side of [-1, 1]) {
      const panel = new Group();
      panel.position.set(half, ridgeHeight - height, 0);
      panel.rotation.z = -side * pitch;
      box(
        panel,
        kind === "a" ? kit.tile : kit.blue,
        [slope, 0.065, depth + 0.32],
        [(side * slope) / 2, 0, 0],
      );
      for (let row = 0; row < 7; row++) {
        const batten = box(
          panel,
          kind === "a" ? kit.tile : kit.blue,
          [slope + 0.03, 0.075, 0.055],
          [(side * slope) / 2, 0.025, -depth / 2 - 0.12 + (row * (depth + 0.24)) / 6],
        );
        batten.receiveShadow = true;
      }
      roof.add(panel);
    }
    group.add(roof);
    box(group, kit.board, [width + 0.65, 0.11, 0.2], [0, -0.13, depth / 2 + 0.5]);
    box(group, kit.board, [width + 0.65, 0.11, 0.2], [0, -0.24, depth / 2 + 0.7]);
    // Front gable is open glazing with a real triangular frame.
    const front = depth / 2 + 0.04;
    rod(
      group,
      kit.board,
      new Vector3(-half, height + 0.07, front),
      new Vector3(0, ridgeHeight + 0.08, front),
      0.045,
    );
    rod(
      group,
      kit.board,
      new Vector3(0, ridgeHeight + 0.08, front),
      new Vector3(half, height + 0.07, front),
      0.045,
    );
    box(roof, kit.dark, [0.16, 0.4, 0.16], [-0.55 + half, ridgeHeight - height + 0.1, -0.4]);
    for (const z of [-depth * 0.35, depth * 0.35])
      rod(
        group,
        kit.brass,
        new Vector3(-half, height + 0.08, z - 0.1),
        new Vector3(-half, height + 0.08, z + 0.1),
        0.055,
      );
  }
  furnishings(group, kit, width, depth, kind === "lodge");
  return { group, roof, kind, roofY: roof.position.y };
}
export function gull(kit: Kit) {
  const group = new Group();
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [-0.5, 0.08, 0, -0.2, 0.22, 0, 0, 0, 0.06, 0.5, 0.08, 0, 0, 0, 0.06, 0.2, 0.22, 0],
      3,
    ),
  );
  geometry.computeVertexNormals();
  const wings = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: new Color("#f6f1da"), side: DoubleSide }),
  );
  group.add(wings);
  const body = new Mesh(new SphereGeometry(0.07, 10, 8), kit.cream);
  body.scale.set(0.8, 0.8, 2);
  group.add(body);
  return group;
}

import {
  BackSide,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
} from "three";

// A herring gull at true size (1.4 m span, 0.6 m long): lathe body, head and a yellow bill,
// a fanned tail, and two-segment wings in the gull's M-shape, grey above with black tips.
// Forward is +Z. `update` flaps in bursts between glides; reduced motion holds the glide.

const WHITE = new Color(0xf1efe9);
const MANTLE = new Color(0x9aa1a6);
const TIP = new Color(0x1d1d1f);

/** One wing as a thin two-sided surface: arm (shoulder → wrist) and hand (wrist → tip). */
function wing(side: 1 | -1) {
  // Leading/trailing edge points along the span, in the wing's local frame (x out along the span).
  const span = [
    { x: 0.04, y: 0, lead: 0.1, trail: -0.1, colour: MANTLE },
    { x: 0.34, y: 0.07, lead: 0.1, trail: -0.09, colour: MANTLE },
    { x: 0.52, y: 0.04, lead: 0.04, trail: -0.12, colour: MANTLE },
    { x: 0.62, y: 0.02, lead: -0.02, trail: -0.12, colour: TIP },
    { x: 0.71, y: 0, lead: -0.11, trail: -0.15, colour: TIP },
  ];
  const positions: number[] = [];
  const colours: number[] = [];
  const push = (p: (typeof span)[number], z: number) => {
    positions.push(side * p.x, p.y, z);
    colours.push(p.colour.r, p.colour.g, p.colour.b);
  };
  for (let i = 0; i < span.length - 1; i++) {
    const a = span[i] as (typeof span)[number];
    const b = span[i + 1] as (typeof span)[number];
    // Two triangles per panel, wound so the upper face points +Y for either side.
    const quad = side > 0 ? [a, b, b, a, b, a] : [a, a, b, a, b, b];
    const zs =
      side > 0
        ? [a.lead, b.lead, b.trail, a.lead, b.trail, a.trail]
        : [a.lead, a.trail, b.trail, a.lead, b.trail, b.lead];
    quad.forEach((p, k) => {
      push(p, zs[k] ?? 0);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildGull() {
  const group = new Group();
  group.name = "gull";
  const feathers = new MeshStandardMaterial({
    name: "gull-feathers",
    vertexColors: true,
    roughness: 0.85,
    side: DoubleSide,
  });
  // Wings: grey mantle and black tips above, white below (as a herring gull's underwing).
  const upperWing = new MeshStandardMaterial({
    name: "gull-wing-upper",
    vertexColors: true,
    roughness: 0.85,
    side: FrontSide,
  });
  const underWing = new MeshStandardMaterial({
    name: "gull-wing-under",
    color: WHITE,
    roughness: 0.85,
    side: BackSide,
  });
  const white = new MeshStandardMaterial({ name: "gull-white", color: WHITE, roughness: 0.85 });
  const bill = new MeshStandardMaterial({ name: "gull-bill", color: 0xd8a52e, roughness: 0.5 });

  // Body: a lathe along +Z, deepest just behind the wings.
  const profile = [
    [0, -0.3],
    [0.03, -0.26],
    [0.05, -0.14],
    [0.065, 0.0],
    [0.06, 0.1],
    [0.042, 0.18],
    [0, 0.21],
  ].map(([r, z]) => new Vector2(r ?? 0, z ?? 0));
  const bodyGeometry = new LatheGeometry(profile, 16);
  bodyGeometry.rotateX(Math.PI / 2);
  const body = new Mesh(bodyGeometry, white);
  body.scale.set(1, 0.9, 1);
  const head = new Mesh(new SphereGeometry(0.045, 14, 10), white);
  head.position.set(0, 0.03, 0.22);
  const beak = new Mesh(new ConeGeometry(0.012, 0.07, 8), bill);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.022, 0.285);
  // Tail: a shallow white fan behind the body.
  const tailGeometry = new BufferGeometry();
  tailGeometry.setAttribute(
    "position",
    new Float32BufferAttribute([0, 0, -0.24, -0.07, 0, -0.38, 0.07, 0, -0.38], 3),
  );
  tailGeometry.setAttribute(
    "color",
    new Float32BufferAttribute([...WHITE.toArray(), ...WHITE.toArray(), ...WHITE.toArray()], 3),
  );
  tailGeometry.computeVertexNormals();
  const tail = new Mesh(tailGeometry, feathers);

  const left = new Group();
  const right = new Group();
  left.position.set(-0.04, 0.02, 0.03);
  right.position.set(0.04, 0.02, 0.03);
  const leftWing = wing(-1);
  const rightWing = wing(1);
  left.add(new Mesh(leftWing, upperWing), new Mesh(leftWing, underWing));
  right.add(new Mesh(rightWing, upperWing), new Mesh(rightWing, underWing));
  group.add(body, head, beak, tail, left, right);
  group.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.userData.visualFamily = "gull";
    }
  });

  const update = (time: number, animated: boolean) => {
    // Flap for ~1.6 s every 6 s, glide in between; a held glide when motion is reduced.
    const cycle = animated ? time % 6 : 5;
    const flapping = cycle < 1.6;
    const beat = flapping ? Math.sin(cycle * Math.PI * 2 * 2.6) : 0;
    const angle = 0.12 + beat * 0.55;
    right.rotation.z = angle;
    left.rotation.z = -angle;
  };
  update(0, false);
  return {
    group,
    update,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of [feathers, upperWing, underWing, white, bill]) material.dispose();
    },
  };
}

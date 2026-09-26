import {
  Color,
  CustomBlending,
  DoubleSide,
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  type Texture,
} from "three";
import { loadPbrSet, type PbrSet } from "./textures";

// Material roles for the island. Sourced CC0 scans supply albedo/normal/AO-roughness at known
// real size (see assets.manifest.json); per-piece tone comes from vertex colours so repeated
// boards and tiles never match exactly. Values follow docs/visual/ART_DIRECTION.md.

export type Materials = {
  cedar: Material;
  structural: Material;
  deck: Material;
  lining: Material;
  painted: Material;
  limewash: Material;
  concrete: Material;
  steel: Material;
  brass: Material;
  glass: Material;
  linen: Material;
  wool: Material;
  rug: Material;
  slate: Material;
  books: Material;
  paper: Material;
  ceramic: Material;
  rope: Material;
  tileCoral: Material;
  tileSlate: Material;
  tileGlaze: Material;
  lampShade: MeshStandardMaterial;
  fire: MeshStandardMaterial;
  bulb: MeshStandardMaterial;
  all: Material[];
};

/** Texture sets by role. Each folder holds <id>_diff/_nor_gl/_arm at the listed resolution. */
export const TEXTURE_SETS = {
  grain: "kitchen_wood",
  lining: "oak_veneer_01",
  painted: "distressed_painted_planks",
  plaster: "white_stucco",
  concrete: "rough_concrete",
  fabric: "rough_linen",
  wool: "wool_boucle",
  rug: "hessian_230",
  metal: "",
} as const;

function pbr(
  set: PbrSet | null,
  parameters: ConstructorParameters<typeof MeshStandardMaterial>[0],
) {
  const material = new MeshStandardMaterial(parameters);
  if (set) {
    material.map = set.colour;
    material.normalMap = set.normal;
    material.roughnessMap = set.arm;
    material.aoMap = set.arm;
    material.aoMapIntensity = 0.7;
  }
  return material;
}

/** Thin glass: full-strength reflection, background passes by (1 − Fresnel). */
export function createGlass(tint = new Color(0.9, 0.97, 0.95)) {
  const material = new MeshPhysicalMaterial({
    name: "glass",
    color: tint,
    roughness: 0.03,
    metalness: 0,
    ior: 1.52,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb *= 0.02;")
      .replace(
        "#include <opaque_fragment>",
        `float glassCos = saturate(abs(dot(normal, normalize(vViewPosition))));
        float glassFresnel = 0.04 + 0.96 * pow(1.0 - glassCos, 5.0);
        gl_FragColor = vec4(outgoingLight, clamp(glassFresnel + 0.06, 0.0, 1.0));`,
      );
  };
  material.customProgramCacheKey = () => "odd-tide-glass-v1";
  return material;
}

export async function createMaterials(load = loadPbrSet): Promise<Materials> {
  const safe = async (id: string, res = "1k", grainAlongV = false) => {
    if (!id) return null;
    try {
      return await load(id, res, 8, grainAlongV);
    } catch {
      return null;
    }
  };
  const [grain, lining, painted, plaster, concrete, fabric, wool, rug, metal] = await Promise.all([
    safe(TEXTURE_SETS.grain, "1k", true),
    safe(TEXTURE_SETS.lining, "1k", true),
    safe(TEXTURE_SETS.painted),
    safe(TEXTURE_SETS.plaster),
    safe(TEXTURE_SETS.concrete),
    safe(TEXTURE_SETS.fabric),
    safe(TEXTURE_SETS.wool),
    safe(TEXTURE_SETS.rug),
    safe(TEXTURE_SETS.metal),
  ]);
  const vertexColors = true;
  // Glazed units: the base colour stays white because each instance carries its own glaze
  // colour (instance colour multiplies the material colour).
  const glazed = (_colour: string, name: string) =>
    new MeshPhysicalMaterial({
      name,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      side: DoubleSide,
    });
  const materials: Omit<Materials, "all"> = {
    // One weathered grain scan, tinted per role: warm cladding, silvered structure, grey decks.
    cedar: pbr(grain, { name: "cedar", color: 0xf2d3b2, roughness: 1, vertexColors }),
    structural: pbr(grain, { name: "structural", color: 0xe0d2bd, roughness: 1, vertexColors }),
    deck: pbr(grain, { name: "deck", color: 0xdcd8d0, roughness: 1, vertexColors }),
    lining: pbr(lining, { name: "lining", color: 0xf4ece0, roughness: 1, vertexColors }),
    painted: pbr(painted, { name: "painted-green", color: 0x3f5a4b, roughness: 1, vertexColors }),
    limewash: pbr(plaster, { name: "limewash", color: 0xf2eadb, roughness: 1, vertexColors }),
    concrete: pbr(concrete, { name: "concrete", color: 0xc9c4ba, roughness: 1, vertexColors }),
    steel: pbr(metal, {
      name: "blackened-steel",
      color: 0x2b2a28,
      metalness: 0.85,
      roughness: 0.62,
      vertexColors,
    }),
    brass: pbr(metal, {
      name: "brass",
      color: 0xc79a52,
      metalness: 1,
      roughness: 0.34,
      vertexColors,
    }),
    glass: createGlass(),
    linen: pbr(fabric, { name: "linen", color: 0xeee6d6, roughness: 1, vertexColors }),
    wool: pbr(wool, { name: "wool", color: 0x9a5a3c, roughness: 1, vertexColors }),
    rug: pbr(rug, { name: "rug", color: 0xd8c9ae, roughness: 1, vertexColors }),
    slate: new MeshStandardMaterial({
      name: "slate",
      color: 0x3b3e40,
      roughness: 0.75,
      vertexColors,
    }),
    books: new MeshStandardMaterial({ name: "books", color: 0xffffff, roughness: 0.8 }),
    paper: new MeshStandardMaterial({ name: "paper", color: 0xf4efe2, roughness: 0.9 }),
    ceramic: new MeshPhysicalMaterial({
      name: "ceramic",
      color: 0xefe9dc,
      roughness: 0.35,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    }),
    rope: new MeshStandardMaterial({ name: "rope", color: 0xb59d74, roughness: 0.95 }),
    tileCoral: glazed("#d36b44", "tile-coral"),
    tileSlate: glazed("#35505c", "tile-slate"),
    tileGlaze: glazed("#3d8c86", "tile-glaze"),
    lampShade: new MeshStandardMaterial({
      name: "lamp-shade",
      color: 0xf1e3c7,
      emissive: 0xffc98a,
      roughness: 0.8,
      side: DoubleSide,
    }),
    fire: new MeshStandardMaterial({
      name: "fire",
      color: 0x201008,
      emissive: 0xff7a2a,
      roughness: 0.6,
    }),
    bulb: new MeshStandardMaterial({
      name: "bulb",
      color: 0xfff4e0,
      emissive: 0xffc98a,
      roughness: 0.3,
    }),
  };
  // Metals need a finer repeat and a subtle tint so brushed texture does not read as wood.
  for (const m of [materials.brass, materials.steel] as MeshStandardMaterial[]) {
    if (m.map) m.map = null;
  }
  return { ...materials, all: Object.values(materials) as Material[] };
}

export function disposeMaterials(materials: Materials) {
  const textures = new Set<Texture>();
  for (const material of materials.all) {
    for (const value of Object.values(material))
      if (value && typeof value === "object" && "isTexture" in value)
        textures.add(value as Texture);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

// Idempotent fetch + process for ODD TIDE's CC0 assets (directive §4.3).
// Run: bun tools/assets/fetch-assets.ts [--only id,id]
// Originals → assets-src/polyhaven/<id>/ (gitignored). Processed → public/textures, public/models.
// Every shipped file is recorded in assets.manifest.json with source, licence, hashes and steps.
// Files come from Poly Haven's download host (the files its website's download buttons fetch),
// not from its API, per the collection directive.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const USER_AGENT = "odd-tide-assets/1.0 (+local portfolio build)";
const HOST = "https://dl.polyhaven.org/file/ph-assets";
const RETRIEVED = new Date().toISOString().slice(0, 10);

type TextureJob = {
  kind: "texture";
  id: string;
  res: "1k" | "2k";
  role: string;
  title: string;
  author: string;
};
type ModelJob = {
  kind: "model";
  id: string;
  res: "1k" | "2k";
  role: string;
  title: string;
  author: string;
  /** Extra alpha maps the glTF omits (vegetation cards). */
  alpha?: string[];
  /** Target triangle ratio for gltf-transform simplify (1 = none). */
  simplify?: number;
};

export const JOBS: (TextureJob | ModelJob)[] = [
  // Terrain (C2)
  {
    kind: "texture",
    id: "cliff_side",
    res: "2k",
    role: "terrain sandstone (primary)",
    title: "Cliff Side",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "rock_face_03",
    res: "2k",
    role: "terrain sandstone (variation)",
    title: "Rock Face 03",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "damp_sand",
    res: "1k",
    role: "terrain beach and seabed sand",
    title: "Damp Sand",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "grass_ground",
    res: "1k",
    role: "terrain coastal turf",
    title: "Grass Ground",
    author: "Poly Haven",
  },
  {
    kind: "model",
    id: "namaqualand_boulder_02",
    res: "1k",
    role: "causeway stepping stones / shore boulders",
    title: "Namaqualand Boulder 02",
    author: "Poly Haven",
  },
  {
    kind: "model",
    id: "namaqualand_boulder_05",
    res: "1k",
    role: "causeway stepping stones / shore boulders",
    title: "Namaqualand Boulder 05",
    author: "Poly Haven",
  },
  {
    kind: "model",
    id: "rock_face_02",
    res: "1k",
    role: "cliff-base kitbash rock (layered sandstone scan)",
    title: "Rock Face 02",
    author: "Poly Haven",
  },
  // Architecture (C3)
  {
    kind: "texture",
    id: "wood_planks_grey",
    res: "1k",
    role: "weathered decking and cladding",
    title: "Wood Planks Grey",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "brown_planks_03",
    res: "1k",
    role: "structural timber and cedar-toned cladding",
    title: "Brown Planks 03",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "plank_flooring_02",
    res: "1k",
    role: "interior lining and floors",
    title: "Plank Flooring 02",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "distressed_painted_planks",
    res: "1k",
    role: "painted board-and-batten (tinted green)",
    title: "Distressed Painted Planks",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "rough_concrete",
    res: "1k",
    role: "footings and piers",
    title: "Rough Concrete",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "white_stucco",
    res: "1k",
    role: "observatory limewash render",
    title: "White Stucco",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "rough_linen",
    res: "1k",
    role: "bedding and curtains (retinted)",
    title: "Rough Linen",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "wool_boucle",
    res: "1k",
    role: "throws and upholstery",
    title: "Wool Boucle",
    author: "Poly Haven",
  },
  {
    kind: "texture",
    id: "hessian_230",
    res: "1k",
    role: "rugs and matting",
    title: "Hessian 230",
    author: "Poly Haven",
  },
];

const ROOT = process.cwd();
const only = process.argv.includes("--only")
  ? (process.argv[process.argv.indexOf("--only") + 1] ?? "").split(",")
  : null;
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

async function download(url: string, file: string) {
  if (existsSync(file) && statSync(file).size > 0) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  writeFileSync(file, new Uint8Array(await response.arrayBuffer()));
  return true;
}

type ManifestAsset = {
  id: string;
  title: string;
  sourceUrl: string;
  author: string;
  license: string;
  retrievalDate: string | null;
  originalSha256: string | Record<string, string>;
  processingSteps: string[];
  outputFiles: { path: string; bytes: number; sha256: string }[];
  bytesPerTier: Record<string, number>;
  status: string;
  role?: string;
};

const manifestPath = path.join(ROOT, "assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  assets: ManifestAsset[];
} & Record<string, unknown>;
const upsert = (asset: ManifestAsset) => {
  const index = manifest.assets.findIndex((a) => a.id === asset.id);
  if (index >= 0) manifest.assets[index] = asset;
  else manifest.assets.push(asset);
};

for (const job of JOBS) {
  if (only && !only.includes(job.id)) continue;
  const srcDir = path.join(ROOT, "assets-src", "polyhaven", job.id);
  if (job.kind === "texture") {
    const maps = ["diff", "nor_gl", "arm"];
    const originals: Record<string, string> = {};
    const outputs: { path: string; bytes: number; sha256: string }[] = [];
    for (const map of maps) {
      const name = `${job.id}_${map}_${job.res}.jpg`;
      const src = path.join(srcDir, name);
      const fresh = await download(`${HOST}/Textures/jpg/${job.res}/${job.id}/${name}`, src);
      originals[name] = sha(src);
      const out = path.join(ROOT, "public", "textures", job.id, name);
      mkdirSync(path.dirname(out), { recursive: true });
      copyFileSync(src, out);
      outputs.push({
        path: path.relative(ROOT, out).replaceAll("\\", "/"),
        bytes: statSync(out).size,
        sha256: sha(out),
      });
      console.log(
        `${fresh ? "fetched" : "cached "} ${name} (${(statSync(out).size / 1024).toFixed(0)} KiB)`,
      );
    }
    upsert({
      id: `polyhaven-${job.id}`,
      title: `${job.title} (${job.res} diff/nor_gl/arm)`,
      sourceUrl: `https://polyhaven.com/a/${job.id}`,
      author: job.author,
      license: "CC0 1.0",
      retrievalDate: RETRIEVED,
      originalSha256: originals,
      processingSteps: [
        `Downloaded ${job.res} JPG maps from the Poly Haven download host`,
        "Shipped unmodified (JPG); colour map sRGB, others linear",
      ],
      outputFiles: outputs,
      bytesPerTier: { existing: outputs.reduce((n, o) => n + o.bytes, 0) },
      status: "sourced; pending look-dev and review",
      role: job.role,
    });
  } else {
    // glTF + shared binary + textures, resolved from the page-listed layout.
    const gltfName = `${job.id}_${job.res}.gltf`;
    const gltfPath = path.join(srcDir, gltfName);
    await download(`${HOST}/Models/gltf/${job.res}/${job.id}/${gltfName}`, gltfPath);
    const gltf = JSON.parse(readFileSync(gltfPath, "utf8")) as {
      buffers?: { uri: string }[];
      images?: { uri: string }[];
    };
    const originals: Record<string, string> = { [gltfName]: sha(gltfPath) };
    for (const buffer of gltf.buffers ?? []) {
      const local = path.join(srcDir, buffer.uri);
      if (!existsSync(local)) {
        let ok = false;
        for (const res of [job.res, "1k", "2k", "4k", "8k", "16k"]) {
          try {
            await download(
              `${HOST}/Models/gltf/${res}/${job.id}/${path.basename(buffer.uri)}`,
              local,
            );
            ok = true;
            break;
          } catch {}
        }
        if (!ok) throw new Error(`buffer not found: ${buffer.uri}`);
      }
      originals[buffer.uri] = sha(local);
    }
    for (const image of gltf.images ?? []) {
      const local = path.join(srcDir, image.uri);
      await download(`${HOST}/Models/jpg/${job.res}/${job.id}/${path.basename(image.uri)}`, local);
      originals[image.uri] = sha(local);
    }
    for (const alpha of job.alpha ?? []) {
      const local = path.join(srcDir, "textures", alpha);
      await download(`${HOST}/Models/png/${job.res}/${job.id}/${alpha}`, local);
      originals[alpha] = sha(local);
    }
    const out = path.join(ROOT, "public", "models", `${job.id}.glb`);
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    // npx.cmd needs the shell on Windows, so quote arguments containing spaces.
    const quote = (arg: string) =>
      process.platform === "win32" && arg.includes(" ") ? `"${arg}"` : arg;
    const run = (args: string[]) =>
      execFileSync(npx, ["--yes", "@gltf-transform/cli@4.5.0", ...args].map(quote), {
        stdio: "pipe",
        shell: process.platform === "win32",
      });
    const tmp = path.join(srcDir, "work");
    mkdirSync(tmp, { recursive: true });
    const steps = [
      "Downloaded glTF, shared binary and 1k textures from the Poly Haven download host",
    ];
    run(["dedup", gltfPath, path.join(tmp, "a.glb")]);
    steps.push("gltf-transform dedup");
    run(["prune", path.join(tmp, "a.glb"), path.join(tmp, "b.glb")]);
    steps.push("gltf-transform prune");
    let current = path.join(tmp, "b.glb");
    if (job.simplify && job.simplify < 1) {
      run([
        "simplify",
        current,
        path.join(tmp, "c.glb"),
        "--ratio",
        String(job.simplify),
        "--error",
        "0.001",
      ]);
      steps.push(`gltf-transform simplify --ratio ${job.simplify} --error 0.001`);
      current = path.join(tmp, "c.glb");
    }
    run(["meshopt", current, out, "--level", "medium"]);
    steps.push("gltf-transform meshopt --level medium");
    upsert({
      id: `polyhaven-${job.id}`,
      title: `${job.title} (glTF ${job.res})`,
      sourceUrl: `https://polyhaven.com/a/${job.id}`,
      author: job.author,
      license: "CC0 1.0",
      retrievalDate: RETRIEVED,
      originalSha256: originals,
      processingSteps: steps,
      outputFiles: [
        {
          path: path.relative(ROOT, out).replaceAll("\\", "/"),
          bytes: statSync(out).size,
          sha256: sha(out),
        },
      ],
      bytesPerTier: { existing: statSync(out).size },
      status: "sourced; pending look-dev and review",
      role: job.role,
    });
    console.log(`model ${job.id} → ${(statSync(out).size / 1024).toFixed(0)} KiB`);
  }
}
manifest.status =
  "visual reset: CC0 sources being integrated under the directive; see docs/visual/ASSET_PLAN.md";
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("manifest updated");

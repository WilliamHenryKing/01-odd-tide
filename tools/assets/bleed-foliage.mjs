// Alpha bleeding for foliage atlases: fills the colour map's transparent areas with the colour
// of the nearest leaf, so texture filtering at card edges blends leaf into leaf instead of into
// the scan's dark background (the dark 1-px fringe the C4b review measured). CC0 sources from
// assets-src/polyhaven; outputs recorded in assets.manifest.json.
// Usage: node tools/assets/bleed-foliage.mjs
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const magick =
  process.env.ODD_TIDE_MAGICK ??
  "C:/Users/William King/.codex/tools/visual/ImageMagick-7.1.2-31/magick.exe";
const jobs = [
  {
    id: "grass_medium_02",
    colour: "assets-src/polyhaven/grass_medium_02/textures/grass_medium_02_diff_1k.jpg",
    alpha: "assets-src/polyhaven/grass_medium_02/textures/grass_medium_02_alpha_1k.png",
    out: "public/textures/grass_medium_02/grass_medium_02_diff_bled_1k.jpg",
  },
  {
    id: "shrub_02",
    colour: "public/textures/shrub_02/shrub_02_diff_1k.jpg",
    alpha: "public/textures/shrub_02/shrub_02_alpha_1k.png",
    out: "public/textures/shrub_02/shrub_02_diff_bled_1k.jpg",
  },
];
const tmp = path.join(os.tmpdir(), `bleed-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const manifestPath = path.resolve("assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
for (const job of jobs) {
  const rgba = path.join(tmp, `${job.id}-rgba.png`);
  const far = path.join(tmp, `${job.id}-far.png`);
  const near = path.join(tmp, `${job.id}-near.png`);
  mkdirSync(path.dirname(job.out), { recursive: true });
  // Colour with the mask as alpha; alpha-weighted blurs at two radii spread leaf colour outward.
  execFileSync(magick, [
    job.colour,
    "(",
    job.alpha,
    "-colorspace",
    "Gray",
    ")",
    "-alpha",
    "off",
    "-compose",
    "CopyOpacity",
    "-composite",
    rgba,
  ]);
  execFileSync(magick, [rgba, "-channel", "RGBA", "-blur", "0x40", "-alpha", "off", far]);
  execFileSync(magick, [rgba, "-channel", "RGBA", "-blur", "0x6", near]);
  execFileSync(magick, [
    far,
    near,
    "-compose",
    "Over",
    "-composite",
    rgba,
    "-compose",
    "Over",
    "-composite",
    "-alpha",
    "off",
    "-quality",
    "92",
    job.out,
  ]);
  const asset = manifest.assets.find((a) => a.id === `polyhaven-${job.id}`);
  if (asset) {
    const file = job.out.replaceAll("\\", "/");
    asset.outputFiles = asset.outputFiles.filter((o) => o.path !== file);
    asset.outputFiles.push({ path: file, bytes: statSync(job.out).size, sha256: sha(job.out) });
    const step =
      "Alpha-bled colour map (tools/assets/bleed-foliage.mjs): transparent areas filled with nearest leaf colour";
    if (!asset.processingSteps.includes(step)) asset.processingSteps.push(step);
  }
  console.log(`${job.id} → ${job.out} (${Math.round(statSync(job.out).size / 1024)} KiB)`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
rmSync(tmp, { recursive: true, force: true });

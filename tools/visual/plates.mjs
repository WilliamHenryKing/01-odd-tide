// Renders the page's stills from the live scene (src/visual/plates.ts) through the dev server's
// visual-test hook: each plate at 2× its size on the real GPU, then downsampled with Lanczos
// and encoded (WebP q84 / JPEG q86) by ImageMagick. External tools only, nothing saved to the
// project's dependencies. Usage (dev server on 4511):
//   node tools/visual/plates.mjs [--only id,id] [--magick <path to magick>]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((part) => {
      const [key, ...value] = part.trim().split(" ");
      return [key, value.join(" ") || "true"];
    }),
);
const playwrightPath =
  args.playwright ??
  process.env.ODD_TIDE_PLAYWRIGHT ??
  "C:/Users/William King/AppData/Local/npm-cache/_npx/81fb41e6b6793dc6/node_modules/playwright/index.mjs";
const magick =
  args.magick ??
  process.env.ODD_TIDE_MAGICK ??
  "C:/Users/William King/.codex/tools/visual/ImageMagick-7.1.2-31/magick.exe";
const only = args.only && args.only !== "true" ? args.only.split(",") : null;
const base = args.url ?? "http://127.0.0.1:4511";
const scratch = path.join(os.tmpdir(), `odd-tide-plates-${process.pid}`);
mkdirSync(scratch, { recursive: true });

const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-size=1600,1000", "--no-first-run"],
});
const written = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${base}/`);
  await page.waitForFunction(() => !!window.__VISUAL_TEST__, null, { timeout: 60_000 });
  await page.evaluate(async () => await window.__VISUAL_TEST__.ready);
  const plates = await page.evaluate(() => window.__VISUAL_TEST__.plates);
  for (const plate of plates) {
    if (only && !only.includes(plate.id)) continue;
    const dataUrl = await page.evaluate(
      async (id) => await window.__VISUAL_TEST__.renderPlate(id, 2),
      plate.id,
    );
    const raw = path.join(scratch, `${plate.id}.png`);
    writeFileSync(raw, Buffer.from(dataUrl.split(",")[1], "base64"));
    const out = path.resolve("public", plate.file);
    mkdirSync(path.dirname(out), { recursive: true });
    const quality = out.endsWith(".webp") ? "84" : "86";
    execFileSync(magick, [
      raw,
      "-filter",
      "Lanczos",
      "-resize",
      `${plate.width}x${plate.height}!`,
      "-strip",
      "-quality",
      quality,
      out,
    ]);
    written.push({ id: plate.id, file: plate.file, bytes: statSync(out).size });
    console.log(
      `${plate.id} → public/${plate.file} (${Math.round(statSync(out).size / 1024)} KiB)`,
    );
  }
  if (errors.length) console.log("page errors:", errors);
  await context.close();
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`${written.length} plates written`);

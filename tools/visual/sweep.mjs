// Breakpoint sweep (capture policy: portrait/landscape sweeps): every route at phone, tablet and
// desktop sizes in headed Chrome against the dev server, after the loader has revealed a ready
// world. Writes docs/visual/captures/<run>/<route>_<w>x<h>.png and one contact sheet per route.
// Usage: node tools/visual/sweep.mjs <run> [--base http://127.0.0.1:4511]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const run = argv.find((a) => !a.startsWith("--")) ?? `sweep-${Date.now()}`;
const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "http://127.0.0.1:4511";
const out = path.resolve("docs/visual/captures", run);
mkdirSync(out, { recursive: true });
const playwright =
  process.env.ODD_TIDE_PLAYWRIGHT ??
  "C:/Users/William King/AppData/Local/npm-cache/_npx/81fb41e6b6793dc6/node_modules/playwright/index.mjs";
const magick =
  process.env.ODD_TIDE_MAGICK ??
  "C:/Users/William King/.codex/tools/visual/ImageMagick-7.1.2-31/magick.exe";
const { chromium } = await import(pathToFileURL(playwright).href);

const VIEWPORTS = [
  [360, 740],
  [375, 667],
  [390, 844],
  [430, 932],
  [844, 390],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1180, 820],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];
const ROUTES = [
  ["home", "/"],
  ["weather-house", "/stays/weather-house"],
  ["nap-observatory", "/stays/nap-observatory"],
  ["lantern-lodge", "/stays/lantern-lodge"],
  ["plan", "/plan"],
  ["about", "/about"],
  ["wrong-turn", "/no-such-cove"],
];
const report = { run, started: new Date().toISOString(), shots: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: false });
try {
  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(`${width}x${height}: ${e.message}`));
    for (const [name, route] of ROUTES) {
      const file = path.join(out, `${name}_${width}x${height}.png`);
      try {
        await page.goto(`${base}${route}`);
        await page.waitForFunction(() => !document.getElementById("odd-loader"), null, {
          timeout: 90_000,
        });
        if (await page.locator(".island-surface").count())
          await page.waitForSelector(".island-surface.ready", { timeout: 60_000 });
        await page.waitForTimeout(1800);
        // Horizontal overflow is a layout fault at any size.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        await page.screenshot({ path: file });
        report.shots.push({ name, width, height, overflow });
      } catch (error) {
        report.errors.push(`${name} ${width}x${height}: ${String(error).slice(0, 200)}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
for (const [name] of ROUTES) {
  const tiles = VIEWPORTS.map(([w, h]) => path.join(out, `${name}_${w}x${h}.png`)).filter((f) =>
    existsSync(f),
  );
  if (tiles.length)
    execFileSync(magick, [
      "montage",
      ...tiles,
      "-tile",
      "7x",
      "-geometry",
      "420x420+6+6",
      "-background",
      "#16181b",
      path.join(out, `sheet_${name}.jpg`),
    ]);
}
report.finished = new Date().toISOString();
report.overflowing = report.shots.filter((s) => s.overflow > 0);
writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
console.log(
  `sweep: ${report.shots.length} shots, ${report.overflowing.length} with horizontal overflow, ${report.errors.length} errors`,
);

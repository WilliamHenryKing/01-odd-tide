// Repeatable visual captures for the directive's change loop (§3.5, §7.2).
// External Playwright only (no project dependency); headed Chrome so frames come from the
// real GPU. Usage:
//   node tools/visual/capture.mjs --run <id> --target lookdev [--states day,night] [--views overview]
//   node tools/visual/capture.mjs --run <id> --target app [--bookmarks a,b] [--viewports desktop,mobile]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const run = args.run;
const target = args.target ?? "app";
if (!run) throw new Error("--run <id> is required");
const base = args.url ?? "http://127.0.0.1:4511";
const list = (value) => (value && value !== "true" ? value.split(",").filter(Boolean) : null);
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080, dpr: 1 },
  mobile: { width: 390, height: 844, dpr: 3 },
  tablet: { width: 1100, height: 1400, dpr: 1 },
  landscape: { width: 800, height: 360, dpr: 2 },
};
const viewports = (
  list(args.viewports) ?? (target === "lookdev" ? ["desktop"] : ["desktop", "mobile"])
).map((name) => ({ name, ...VIEWPORTS[name] }));
const out = path.resolve("docs/visual/captures", run);
mkdirSync(out, { recursive: true });

const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-size=1920,1080", "--no-first-run"],
});
const commit = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
const dirty = execFileSync("git", ["status", "--porcelain"]).toString().trim().length > 0;
const results = [];
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        errors.push(`${message.type()}: ${message.text()}`);
    });
    try {
      if (target === "lookdev") {
        await page.goto(
          `${base}/?lookdev${args.query && args.query !== "true" ? `&${args.query}` : ""}`,
        );
        await page.waitForFunction(() => !!window.__LOOKDEV__, null, { timeout: 60_000 });
        await page.evaluate(async () => await window.__LOOKDEV__.ready);
        const all = await page.evaluate(() => window.__LOOKDEV__.states.map((s) => s.id));
        const views = list(args.views) ?? ["overview"];
        for (const view of views)
          for (const state of list(args.states) ?? all) {
            await page.evaluate(
              async ([v, s]) => {
                const hook = window.__LOOKDEV__;
                hook.setView(v);
                await hook.setState(s);
                await hook.settle(24);
              },
              [view, state],
            );
            const panel = page.locator(".lookdev-panel");
            const readout = await panel.innerText();
            await panel.evaluate((node) => {
              node.style.visibility = "hidden";
            });
            const suffix =
              args.query && args.query !== "true"
                ? `_${args.query.replace(/[^a-z0-9]+/gi, "-")}`
                : "";
            const file = path.join(out, `lookdev_${view}_${state}${suffix}_${viewport.name}.png`);
            await page.screenshot({ path: file });
            await panel.evaluate((node) => {
              node.style.visibility = "visible";
            });
            const info = await page.evaluate(() => window.__LOOKDEV__.info());
            results.push({
              kind: "lookdev",
              view,
              state,
              viewport,
              file: path.basename(file),
              sha256: sha(file),
              readout,
              info,
            });
          }
      } else {
        await page.goto(`${base}/`);
        await page.waitForFunction(() => !!window.__VISUAL_TEST__, null, { timeout: 60_000 });
        await page.evaluate(async () => await window.__VISUAL_TEST__.ready);
        const all = await page.evaluate(() => window.__VISUAL_TEST__.bookmarks.map((b) => b.id));
        const tier = args.tier ?? (await page.evaluate(() => window.__VISUAL_TEST__.tiers[0]));
        for (const bookmark of list(args.bookmarks) ?? all) {
          await page.evaluate(
            async ([id, t]) => {
              const hook = window.__VISUAL_TEST__;
              hook.setTier(t);
              const result = await hook.setBookmark(id);
              if (result.bookmark !== id) throw new Error("Bookmark acknowledgement mismatch");
              hook.freeze();
              await hook.settle(30);
              window.scrollTo(0, 0);
            },
            [bookmark, tier],
          );
          await page.waitForTimeout(150);
          const stem = path.join(out, `${bookmark}_${tier}_${viewport.name}`);
          await page.screenshot({ path: `${stem}.png`, animations: "disabled" });
          const dataUrl = await page
            .locator(".world-canvas canvas")
            .evaluate((canvas) => canvas.toDataURL("image/png"));
          writeFileSync(`${stem}_webgl.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
          const info = await page.evaluate(() => {
            const i = window.__VISUAL_TEST__.info();
            return {
              ...i,
              meshes: undefined,
              materials: undefined,
              textures: undefined,
              meshCount: i.meshes.length,
              materialCount: i.materials.length,
              textureCount: i.textures.length,
            };
          });
          results.push({
            kind: "bookmark",
            bookmark,
            tier,
            viewport,
            file: path.basename(`${stem}.png`),
            webgl: path.basename(`${stem}_webgl.png`),
            sha256: sha(`${stem}.png`),
            webglSha256: sha(`${stem}_webgl.png`),
            info,
          });
        }
      }
    } finally {
      results.push({ kind: "console", viewport: viewport.name, errors: [...errors] });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(
  path.join(out, "meta.json"),
  JSON.stringify(
    {
      run,
      target,
      capturedAt: new Date().toISOString(),
      commit,
      workingTreeDirty: dirty,
      browser: "Chrome (channel) headed",
      results,
    },
    null,
    2,
  ),
);
const errors = results.filter((r) => r.kind === "console").flatMap((r) => r.errors);
console.log(`${results.filter((r) => r.kind !== "console").length} captures → ${out}`);
if (errors.length) console.log(`console errors/warnings:\n${errors.slice(0, 20).join("\n")}`);

// One unattended batch cycle (D10): heavy local jobs run one after another while the agent is
// idle; results and a log land in docs/visual/batch/<cycle>/ for review on waking.
// Usage (dev server on 4511, perf preview on 4611): node tools/batch/cycle.mjs <cycle-id> [steps]
// Steps (default all, in order): reveal, captures, plates, build, perf
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [cycle = `cycle-${Date.now()}`, stepList] = process.argv.slice(2);
const steps = (stepList ?? "reveal,captures,plates,build,perf").split(",");
const out = path.resolve("docs/visual/batch", cycle);
mkdirSync(out, { recursive: true });
const logFile = path.join(out, "log.txt");
const log = (line) => {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  appendFileSync(logFile, `${stamped}\n`);
};
const playwright =
  process.env.ODD_TIDE_PLAYWRIGHT ??
  "C:/Users/William King/AppData/Local/npm-cache/_npx/81fb41e6b6793dc6/node_modules/playwright/index.mjs";
const magick =
  process.env.ODD_TIDE_MAGICK ??
  "C:/Users/William King/.codex/tools/visual/ImageMagick-7.1.2-31/magick.exe";
const ffmpeg =
  process.env.ODD_TIDE_FFMPEG ??
  "C:/Users/William King/.bun/install/cache/@remotion/compositor-win32-x64-msvc@4.0.500@@@1/ffmpeg.exe";
const summary = { cycle, started: new Date().toISOString(), steps: {} };
// Port 4611 is this project's preview: stop whatever serves it, then serve the given build.
async function preview(outDir) {
  if (process.platform === "win32")
    spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-NetTCPConnection -LocalPort 4611 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }",
    ]);
  const child = spawn("bunx", ["--no-install", "vite", "preview", "--outDir", outDir], {
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4611/")).ok)
        return log(`preview on 4611 serves ${outDir}`);
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`preview of ${outDir} did not start on 4611`);
}
const run = (name, command, args, options = {}) => {
  log(`▶ ${name}: ${command} ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, ...options });
  const tail = `${result.stdout ?? ""}${result.stderr ?? ""}`.split("\n").slice(-12).join("\n");
  appendFileSync(logFile, `${tail}\n`);
  summary.steps[name] = {
    ok: result.status === 0,
    status: result.status,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  log(`■ ${name}: exit ${result.status} in ${summary.steps[name].seconds}s`);
  return result.status === 0;
};

// 1. Reveal: a continuous recording of load → loader → reveal, with per-frame hero statistics
//    so a blank or flickering canvas shows up as numbers, not only as pictures.
async function reveal() {
  const started = Date.now();
  const { chromium } = await import(pathToFileURL(path.resolve(playwright)).href);
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const videoDir = path.join(out, "reveal-video");
  rmSync(videoDir, { recursive: true, force: true });
  try {
    const warm = await browser.newContext();
    const warmPage = await warm.newPage();
    await warmPage.goto("http://127.0.0.1:4511/");
    await warmPage.waitForTimeout(8000);
    await warm.close();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4511/", { waitUntil: "commit" });
    await page.waitForFunction(() => !document.getElementById("odd-loader"), null, {
      timeout: 60_000,
      polling: 100,
    });
    await page.waitForTimeout(4000);
    await context.close();
  } finally {
    await browser.close();
  }
  const video = readdirSync(videoDir).find((name) => name.endsWith(".webm"));
  if (!video || !existsSync(ffmpeg)) {
    summary.steps.reveal = { ok: false, note: "no video or ffmpeg" };
    return;
  }
  const frames = path.join(videoDir, "frames");
  mkdirSync(frames, { recursive: true });
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    path.join(videoDir, video),
    "-r",
    "8",
    "-s",
    "640x360",
    path.join(frames, "f%03d.png"),
  ]);
  // Hero region (right two-thirds, below the header): standard deviation of luminance. A blank
  // teal hero measures ~0.02; the island ~0.12+.
  const stats = readdirSync(frames)
    .filter((name) => name.endsWith(".png"))
    .map((name) => {
      const value = execFileSync(magick, [
        path.join(frames, name),
        "-crop",
        "400x220+230+80",
        "-colorspace",
        "Gray",
        "-format",
        "%[fx:standard_deviation]",
        "info:",
      ])
        .toString()
        .trim();
      return { frame: name, deviation: Number(value) };
    });
  writeFileSync(path.join(out, "reveal.json"), JSON.stringify(stats, null, 1));
  // After the first frame that shows the island, any later blank frame is a flicker.
  const firstIsland = stats.findIndex((s) => s.deviation > 0.08);
  const blanksAfter =
    firstIsland < 0 ? -1 : stats.slice(firstIsland).filter((s) => s.deviation < 0.05).length;
  summary.steps.reveal = {
    ok: firstIsland >= 0 && blanksAfter === 0,
    frames: stats.length,
    firstIslandFrame: firstIsland,
    blankFramesAfterReveal: blanksAfter,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  log(`■ reveal: ${JSON.stringify(summary.steps.reveal)}`);
}

try {
  if (steps.includes("reveal")) await reveal();
  if (steps.includes("captures"))
    run("captures", "node", [
      "tools/visual/capture.mjs",
      "--run",
      `${cycle}-captures`,
      "--target",
      "app",
    ]);
  if (steps.includes("plates")) run("plates", "node", ["tools/visual/plates.mjs"]);
  if (steps.includes("build")) {
    run("build", "bun", ["run", "build"], { shell: true });
    const html = existsSync("dist/index.html") ? readdirSync("dist").length : 0;
    summary.steps.build.distEntries = html;
  }
  if (steps.includes("perf")) {
    run(
      "perf-build",
      "bunx",
      ["--no-install", "vite", "build", "--mode", "performance", "--outDir", "dist-perf"],
      {
        shell: true,
      },
    );
    // The harness measures the performance build on 4611; the ordinary preview returns after.
    await preview("dist-perf");
    try {
      run("perf", "node", [
        "tools/perf/run.mjs",
        playwright,
        process.env.CYCLE_PERF_SPEC ?? "tools/perf/scene.json",
        `${cycle}-scene`,
      ]);
    } finally {
      await preview("dist");
    }
  }
} catch (error) {
  log(`✖ ${error?.stack ?? error}`);
  summary.error = String(error);
} finally {
  summary.finished = new Date().toISOString();
  writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
  log("cycle finished");
}

// Showcase films rendered frame by frame from the live scene (a D10 batch job): the island
// through a day (landscape and portrait) and each stay from golden hour into night. Frames are
// rendered at 2x on the real GPU through the visual-test hook, Lanczos-downsampled, then
// encoded with ffmpeg. Resumable (existing frames are skipped); pauses above 83 C on the GPU.
// Usage (dev server on 4511): node tools/visual/film.mjs [--wait-for <file>] [--only id,id]
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const only = opt("--only")?.split(",");
const playwright =
  "C:/Users/William King/AppData/Local/npm-cache/_npx/81fb41e6b6793dc6/node_modules/playwright/index.mjs";
const magick = "C:/Users/William King/.codex/tools/visual/ImageMagick-7.1.2-31/magick.exe";
const ffmpeg =
  "C:/Users/William King/.bun/install/cache/@remotion/compositor-win32-x64-msvc@4.0.500@@@1/ffmpeg.exe";
const root = path.resolve("assets-src/film");
mkdirSync(root, { recursive: true });
mkdirSync(path.resolve("docs/visual/batch"), { recursive: true });
const logFile = path.resolve("docs/visual/batch/film.log");
const log = (line) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One heavy job at a time: wait for the previous job's final file.
const waitFor = opt("--wait-for");
if (waitFor) {
  log(`waiting for ${waitFor}`);
  const deadline = Date.now() + 40 * 60_000;
  while (!existsSync(waitFor) && Date.now() < deadline) await sleep(20_000);
  await sleep(15_000);
}

const ease = (t) => t * t * (3 - 2 * t);
const orbit = (centre, radius, height, az0, az1, t) => {
  const a = ((az0 + (az1 - az0) * ease(t)) * Math.PI) / 180;
  return [centre[0] + Math.cos(a) * radius, centre[1] + height, centre[2] + Math.sin(a) * radius];
};
const base = { selected: null, opened: false, paused: true, reduced: true, discover: false };
const ALL = ["bath", "weather", "stars"];
// Stay centres and the azimuth (degrees from +x toward +z) of their closed shots (layout.ts).
const STAYS = {
  "weather-house": { centre: [-3, 8.3, 0.2], az: 145.2, radius: 13, height: 7 },
  "nap-observatory": { centre: [14, 10.5, -9.4], az: 101.9, radius: 13, height: 8 },
  "lantern-lodge": { centre: [11.2, 6, 8.2], az: 43.7, radius: 15.8, height: 7.7 },
};
const FILMS = [
  {
    id: "island-day-landscape",
    width: 1920,
    height: 1080,
    frames: 480,
    hours: [6, 22],
    camera: (t) => ({
      position: orbit([0.5, 1.2, -1], 58, 19, 32, 78, t),
      target: [0.5, 2.2, -1],
      fov: 34,
    }),
  },
  {
    id: "island-day-portrait",
    width: 1080,
    height: 1920,
    frames: 480,
    hours: [6, 22],
    // A 9:16 frame sees under 20° across: the ~43 m island needs 140-160 m to fit whole (film-02
    // at 84 m cut the observatory off at the right edge). A slow push-in over the day.
    camera: (t) => ({
      position: orbit([0.5, 1.2, -1], 160 - 20 * ease(t), 64 - 8 * ease(t), 78, 32, t),
      target: [0.5, 1.5, -1],
      fov: 34,
    }),
  },
  ...Object.entries(STAYS).map(([id, s]) => ({
    id: `${id}-evening`,
    width: 1920,
    height: 1080,
    frames: 240,
    hours: [16.5, 21.5],
    selected: id,
    camera: (t) => ({
      position: orbit(s.centre, s.radius, s.height - 2.5, s.az - 22, s.az + 22, t),
      target: s.centre,
      fov: 32,
    }),
  })),
].filter((film) => !only || only.includes(film.id));

const gpuTemperature = () => {
  try {
    const out = execFileSync("nvidia-smi", [
      "--query-gpu=temperature.gpu",
      "--format=csv,noheader",
    ]);
    return Number(out.toString().trim());
  } catch {
    return 0;
  }
};

const { chromium } = await import(pathToFileURL(playwright).href);
let browser = null;
let page = null;
const open = async () => {
  if (browser) await browser.close().catch(() => {});
  browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--window-size=1400,900"],
  });
  page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto("http://127.0.0.1:4511/");
  await page.waitForFunction(() => !!window.__VISUAL_TEST__?.renderShot, null, {
    timeout: 120_000,
  });
  await page.evaluate(async () => await window.__VISUAL_TEST__.ready);
};
const summary = { started: new Date().toISOString(), films: {} };
const writeSummary = () =>
  writeFileSync(
    path.resolve("docs/visual/batch/film-summary.json"),
    JSON.stringify(summary, null, 1),
  );
log(`film job start: ${FILMS.map((f) => f.id).join(", ")}`);
try {
  await open();
  for (const film of FILMS) {
    const dir = path.join(root, film.id);
    mkdirSync(dir, { recursive: true });
    const started = Date.now();
    let rendered = 0;
    for (let i = 0; i < film.frames; i++) {
      const file = path.join(dir, `f${String(i + 1).padStart(4, "0")}.jpg`);
      if (existsSync(file)) continue;
      if (i % 10 === 0) {
        let temperature = gpuTemperature();
        while (temperature >= 83) {
          log(`GPU ${temperature} C: cooling for 90 s`);
          await sleep(90_000);
          temperature = gpuTemperature();
        }
      }
      const t = film.frames > 1 ? i / (film.frames - 1) : 0;
      const hour = film.hours[0] + (film.hours[1] - film.hours[0]) * t;
      const shot = {
        state: { ...base, hour, selected: film.selected ?? null, found: hour >= 18.5 ? ALL : [] },
        time: i * 0.2,
        camera: film.camera(t),
      };
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const dataUrl = await page.evaluate(
            async ({ shot, w, h }) => await window.__VISUAL_TEST__.renderShot(shot, w, h),
            { shot, w: film.width * 2, h: film.height * 2 },
          );
          const raw = path.join(dir, "raw.png");
          writeFileSync(raw, Buffer.from(dataUrl.split(",")[1], "base64"));
          execFileSync(magick, [
            raw,
            "-filter",
            "Lanczos",
            "-resize",
            `${film.width}x${film.height}!`,
            "-quality",
            "92",
            file,
          ]);
          rendered++;
          break;
        } catch (error) {
          log(
            `${film.id} frame ${i + 1} attempt ${attempt + 1} failed: ${String(error).slice(0, 200)}`,
          );
          await open().catch((e) => log(`reopen failed: ${e}`));
        }
      }
      if (i % 40 === 0) log(`${film.id}: frame ${i + 1}/${film.frames}`);
    }
    const out = path.join(root, `${film.id}.mp4`);
    let encoded = false;
    for (const args of [
      ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", out],
      ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "28", out.replace(".mp4", ".webm")],
    ]) {
      try {
        execFileSync(ffmpeg, [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-framerate",
          "24",
          "-i",
          path.join(dir, "f%04d.jpg"),
          ...args,
        ]);
        encoded = args[args.length - 1];
        break;
      } catch (error) {
        log(`${film.id}: encoder ${args[1]} failed: ${String(error).slice(0, 160)}`);
      }
    }
    summary.films[film.id] = {
      frames: film.frames,
      rendered,
      minutes: Math.round((Date.now() - started) / 60000),
      encoded,
    };
    log(`${film.id}: done ${JSON.stringify(summary.films[film.id])}`);
    writeSummary();
  }
} catch (error) {
  log(`film job error: ${error?.stack ?? error}`);
  summary.error = String(error);
} finally {
  await browser?.close().catch(() => {});
  summary.finished = new Date().toISOString();
  writeSummary();
  log("film job finished");
}

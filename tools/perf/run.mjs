import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// External Playwright installation only; no project dependency or browser profile is modified.
const [playwrightPath, planPath, runName = "local-rtx2060"] = process.argv.slice(2);
if (!playwrightPath || !planPath)
  throw new Error(
    "Usage: node tools/perf/run.mjs <external-playwright/index.mjs> <plan.json> <run-name>",
  );
const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const out = path.resolve("docs/visual/perf", runName);
mkdirSync(out, { recursive: true });
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const source = Object.fromEntries(
  [
    "src/world/island.ts",
    "src/visual/perf.ts",
    "src/visual/bookmarks.ts",
    "src/visual/perf-math.ts",
    "tools/perf/run.mjs",
    "package.json",
    "bun.lock",
  ].map((file) => [file, sha(file)]),
);
const bundles = Object.fromEntries(
  [
    "dist-perf/index.html",
    "dist-perf/.vite/manifest.json",
    ...readdirSync("dist-perf/assets").map((name) => `dist-perf/assets/${name}`),
  ].map((file) => [file, sha(file)]),
);
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-size=1920,1080", "--no-first-run"],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
let currentRun = "setup";
let latestGpu = null;
let lastTelemetryAt = Date.now();
let stopReason = null;
let previousCpu = os.cpus();
const coldCpu = previousCpu;
const events = [];
page.on("pageerror", (error) =>
  events.push({ run: currentRun, type: "pageerror", message: error.message }),
);
page.on("console", (msg) => {
  if (msg.type() === "error")
    events.push({ run: currentRun, type: "console-error", message: msg.text() });
});
const monitor = spawn(
  "nvidia-smi",
  [
    "--query-gpu=timestamp,name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu,power.draw,clocks.current.graphics,clocks.current.memory,pstate",
    "--format=csv,noheader,nounits",
    "-l",
    "1",
  ],
  { windowsHide: true },
);
let buffered = "";
monitor.stdout.on("data", (data) => {
  buffered += data.toString();
  const lines = buffered.split(/\r?\n/);
  buffered = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = line.split(",").map((v) => v.trim());
    latestGpu = {
      timestamp: values[0],
      name: values[1],
      totalMiB: Number(values[2]),
      usedMiB: Number(values[3]),
      freeMiB: Number(values[4]),
      temperatureC: Number(values[5]),
      utilizationPercent: Number(values[6]),
      powerW: Number(values[7]),
      graphicsMHz: Number(values[8]),
      memoryMHz: Number(values[9]),
      pstate: values[10],
    };
    if (![latestGpu.freeMiB, latestGpu.usedMiB, latestGpu.temperatureC].every(Number.isFinite)) {
      stopReason = "GPU telemetry has invalid required fields";
      void page.evaluate(() => window.__PERF__?.stop()).catch(() => {});
      continue;
    }
    lastTelemetryAt = Date.now();
    const nowCpu = os.cpus();
    const perCoreBusyPercent = nowCpu.map((core, i) => {
      const prior = previousCpu[i]?.times ?? core.times;
      const total =
        Object.values(core.times).reduce((a, b) => a + b, 0) -
        Object.values(prior).reduce((a, b) => a + b, 0);
      return total ? 100 * (1 - (core.times.idle - prior.idle) / total) : 0;
    });
    previousCpu = nowCpu;
    const availableRam = os.freemem();
    appendFileSync(
      path.join(out, "telemetry.jsonl"),
      `${JSON.stringify({ at: new Date().toISOString(), run: currentRun, gpu: latestGpu, availableRam, perCoreBusyPercent })}\n`,
    );
    if (
      !stopReason &&
      (latestGpu.temperatureC >= 85 || latestGpu.freeMiB < 1024 || availableRam < 1.5 * 1024 ** 3)
    ) {
      stopReason = `Operating reserve guard: GPU ${latestGpu.temperatureC}C, free VRAM ${latestGpu.freeMiB}MiB, free RAM ${Math.round(availableRam / 1024 ** 2)}MiB`;
      void page.evaluate(() => window.__PERF__?.stop()).catch(() => {});
    }
  }
});
monitor.stderr.on("data", (data) =>
  events.push({ type: "telemetry-error", message: data.toString() }),
);
monitor.on("error", (error) => {
  stopReason = `Telemetry error: ${error.message}`;
  void page.evaluate(() => window.__PERF__?.stop()).catch(() => {});
});
const telemetryGuard = setInterval(() => {
  if (!stopReason && (Date.now() - lastTelemetryAt > 7000 || os.freemem() < 1.5 * 1024 ** 3)) {
    stopReason = "Telemetry stale or system RAM reserve exhausted";
    void page.evaluate(() => window.__PERF__?.stop()).catch(() => {});
  }
}, 2000);
try {
  await page.goto("http://127.0.0.1:4611/?perf", { waitUntil: "networkidle" });
  await page.bringToFront();
  await page.waitForFunction(() => !!window.__PERF__, { timeout: 30000 });
  const browserVersion = browser.version();
  if (!latestGpu || !Number.isFinite(latestGpu.freeMiB) || Date.now() - lastTelemetryAt > 3000)
    throw new Error("Fresh GPU telemetry unavailable");
  // Verify the actual served bundle bytes against the files we are recording.
  for (const [file, expected] of Object.entries(bundles)) {
    if (file.includes("/.vite/")) continue;
    const response = await context.request.get(
      `http://127.0.0.1:4611/${file.replace("dist-perf/", "")}`,
    );
    if (
      !response.ok() ||
      createHash("sha256")
        .update(await response.body())
        .digest("hex") !== expected
    )
      throw new Error(`Served bundle mismatch: ${file}`);
  }
  const cdp = await context.newCDPSession(page);
  const browserCommandLine = await cdp.send("Browser.getBrowserCommandLine").catch(() => null);
  writeFileSync(
    path.join(out, "run.json"),
    JSON.stringify(
      {
        started: new Date().toISOString(),
        browserVersion,
        headless: false,
        launchArgs: ["--window-size=1920,1080", "--no-first-run"],
        cpu: coldCpu[0]?.model,
        logicalCores: coldCpu.length,
        totalRam: os.totalmem(),
        initialFreeRam: os.freemem(),
        source,
        bundles,
        browserCommandLine,
        commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        dirty: true,
        plan,
      },
      null,
      2,
    ),
  );
  for (const options of plan) {
    if (stopReason) break;
    const textureCount =
      options.textureCount ?? (options.kind === "textures" ? (options.count ?? 1) : 0);
    const textureSize = options.textureSize ?? 1024;
    const payload = (textureCount * textureSize * textureSize * 4 * 4) / 3;
    if (
      payload &&
      (!latestGpu ||
        payload / 1024 ** 2 > latestGpu.freeMiB - 1024 ||
        128 * 1024 ** 2 > os.freemem() - 1.5 * 1024 ** 3)
    ) {
      const reason = `Preflight reserve would be exceeded by ${options.id} (${Math.round(payload / 1024 ** 2)} MiB texture payload)`;
      writeFileSync(
        path.join(out, `${options.id}-not-run.json`),
        JSON.stringify(
          { options, reason, latestGpu, availableRam: os.freemem(), at: new Date().toISOString() },
          null,
          2,
        ),
      );
      console.log(reason);
      continue;
    }
    currentRun = options.id;
    console.log(`START ${currentRun}`);
    const before = latestGpu;
    const result = await page.evaluate(
      async (options) => await window.__PERF__.run(options),
      options,
    );
    if (result.setupFrame) {
      writeFileSync(
        path.join(out, `${currentRun}.png`),
        Buffer.from(result.setupFrame.split(",")[1], "base64"),
      );
      result.setupFrame = `${currentRun}.png (captured before warm-up; no readback during measurement)`;
    }
    result.external = {
      browserVersion,
      gpuBefore: before,
      gpuAfter: latestGpu,
      stopReason,
      source,
      bundles,
      errors: events.filter((event) => event.run === currentRun),
    };
    writeFileSync(path.join(out, `${currentRun}.json`), JSON.stringify(result));
    const stats = result.summary;
    console.log(
      JSON.stringify({
        id: currentRun,
        aborted: result.aborted,
        seconds: result.measuredWallSeconds,
        raf: stats.rafMs,
        cpu: stats.cpuSubmitMs.p95,
        gpu: stats.gpuMs.p95,
        calls: stats.drawCalls.p95,
        triangles: stats.triangles.p95,
        gpuCoverage: result.timing.gpuCoverage,
        temp: latestGpu?.temperatureC,
        vram: latestGpu?.usedMiB,
        ramFreeMiB: Math.round(os.freemem() / 1024 ** 2),
      }),
    );
    if (result.aborted) break;
    // Let asynchronous driver disposal settle before the next memory preflight.
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  currentRun = "completed";
  await page.screenshot({ path: path.join(out, "after-run.png") });
  writeFileSync(
    path.join(out, "events.json"),
    JSON.stringify({ events, stopReason, ended: new Date().toISOString() }, null, 2),
  );
} catch (error) {
  writeFileSync(
    path.join(out, `${currentRun}-failed.json`),
    JSON.stringify(
      { run: currentRun, error: String(error), stack: error.stack, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  throw error;
} finally {
  clearInterval(telemetryGuard);
  writeFileSync(
    path.join(out, "events.json"),
    JSON.stringify({ events, stopReason, ended: new Date().toISOString() }, null, 2),
  );
  monitor.kill();
  await context.close();
  await browser.close();
}

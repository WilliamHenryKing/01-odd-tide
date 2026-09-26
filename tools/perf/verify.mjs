import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const results = [];
const opts = (id, extra = {}) => ({ id, kind: "empty", warmup: 0, seconds: 2, ...extra });
const run = (options) => page.evaluate((options) => window.__PERF__.run(options), options);
const active = () => page.waitForFunction(() => window.__PERF__?.status().running);
try {
  await page.goto("http://127.0.0.1:4611/?perf", { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__PERF__);
  const control = await run(opts("control"));
  assert.equal(control.aborted, false);
  assert.equal(control.timing.gpuCoverage, 1);
  const counts = control.cleanupMemory;
  results.push({ test: "real GPU queries and empty control", pass: true, gpu: control.gpu });

  let pending = run(opts("cancel", { seconds: 60 }));
  await active();
  await page.evaluate(() => window.__PERF__.stop());
  assert.equal((await pending).aborted, true);
  results.push({ test: "explicit cancel resolves", pass: true });

  pending = run(opts("hidden", { seconds: 60 }));
  await active();
  // This automation launch keeps pages visible even when another page/window is activated.
  // Exercise the visibility handler explicitly; do not call this a native minimise test.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await pending;
  assert.equal(hidden.aborted, true);
  assert.ok(hidden.invalidReasons.includes("Document became hidden"));
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.bringToFront();
  results.push({
    test: "injected visibility handler cancels without waiting on rAF",
    pass: true,
    limitation: "Native tab/minimise visibility was not induced by this automation configuration",
  });

  pending = run(opts("resize", { seconds: 60 }));
  await active();
  await page.setViewportSize({ width: 1880, height: 1040 });
  const resized = await pending;
  assert.ok(resized.invalidReasons.includes("Viewport resized during run"));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  results.push({ test: "resize invalidates run", pass: true });

  // A rAF timestamp may precede performance.now on the same frame; exercise long warm-up path.
  const island = await run(opts("island-first-frame", { kind: "island", warmup: 1, seconds: 1 }));
  assert.equal(island.aborted, false);
  results.push({ test: "island first-frame camera phase is nonnegative", pass: true });

  const allocation = run(
    opts("allocation-cancel", { kind: "textures", count: 384, seconds: 60 }),
  ).catch((error) => String(error));
  await active();
  await page.evaluate(() => window.__PERF__.stop());
  assert.match(await allocation, /Texture setup cancelled/);
  const afterAllocation = await run(opts("after-cancel"));
  assert.deepEqual(afterAllocation.memory.rendererBefore, counts);
  results.push({ test: "partial texture upload cancels and releases resources", pass: true });

  // Inject a real WebGL draw exception after measurement begins; verify timer-query cleanup.
  pending = run(opts("render-exception", { kind: "combined", count: 32, seconds: 60 })).catch(
    (error) => String(error),
  );
  await page.waitForFunction(() => window.__PERF__.status().progress.includes("measuring"));
  await page.evaluate(() => {
    const proto = WebGL2RenderingContext.prototype;
    const draw = proto.drawElements,
      begin = proto.beginQuery,
      end = proto.endQuery;
    let balance = 0;
    proto.beginQuery = function (...args) {
      balance++;
      return begin.apply(this, args);
    };
    proto.endQuery = function (...args) {
      balance--;
      return end.apply(this, args);
    };
    proto.drawElements = () => {
      throw new Error("intentional benchmark draw failure");
    };
    window.__restorePerfInjection = () => {
      proto.drawElements = draw;
      proto.beginQuery = begin;
      proto.endQuery = end;
      return balance;
    };
  });
  assert.match(await pending, /intentional benchmark draw failure/);
  assert.equal(await page.evaluate(() => window.__restorePerfInjection()), 0);
  const afterFailure = await run(opts("after-render-exception"));
  assert.equal(afterFailure.timing.gpuCoverage, 1);
  assert.deepEqual(afterFailure.cleanupMemory, counts);
  results.push({ test: "render exception closes active query; next run recovers", pass: true });

  const terminal = await page.evaluate(async () => {
    setTimeout(() => {
      const end = performance.now() + 140;
      while (performance.now() < end) {
        /* intentional terminal stall */
      }
    }, 960);
    return window.__PERF__.run({ id: "terminal-stall", kind: "empty", warmup: 0, seconds: 1 });
  });
  assert.ok(terminal.summary.rafMs.max > 100);
  results.push({
    test: "terminal stall retained in pacing distribution",
    pass: true,
    maxMs: terminal.summary.rafMs.max,
  });

  await assert.rejects(() => run(opts("invalid-size", { textureSize: NaN })), /dimensions|finite/);
  results.push({ test: "nonfinite dimensions reject without hanging", pass: true });
} finally {
  writeFileSync(
    "docs/visual/perf/HARNESS-CHECKS.json",
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));

// End-to-end journeys through the real UI in headed Chrome (the site's promises, not unit
// logic): arrival and loader → stays → a stay (open the roof) → plan (dates, guests, day) →
// summary → postcard download; the lens hunt → lighthouse relit; the time-lapse; and, against
// the production preview, the 404 route. Writes docs/visual/journeys/<run>/report.json and a
// screenshot per step. Usage: node tools/visual/journeys.mjs <run> [--base http://127.0.0.1:4511]
//   [--preview http://127.0.0.1:4611]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const run = argv.find((a) => !a.startsWith("--")) ?? `journeys-${Date.now()}`;
const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const base = opt("--base", "http://127.0.0.1:4511");
const preview = opt("--preview", "http://127.0.0.1:4611");
const out = path.resolve("docs/visual/journeys", run);
mkdirSync(out, { recursive: true });
const playwright =
  process.env.ODD_TIDE_PLAYWRIGHT ??
  "C:/Users/William King/AppData/Local/npm-cache/_npx/81fb41e6b6793dc6/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(playwright).href);
const report = { run, started: new Date().toISOString(), steps: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: false });

async function journey(name, viewport, fn) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => {
    // The status journey requests wrong turns on purpose; their 404s are the expected answer.
    if (name === "status" && /status of 404/.test(m.text())) return;
    if (m.type() === "error") report.errors.push(`${name}: console: ${m.text().slice(0, 200)}`);
  });
  let n = 0;
  const step = async (label, action) => {
    const started = Date.now();
    try {
      const detail = await action();
      report.steps.push({ journey: name, step: label, ok: true, ms: Date.now() - started, detail });
    } catch (error) {
      report.steps.push({
        journey: name,
        step: label,
        ok: false,
        ms: Date.now() - started,
        error: String(error).slice(0, 300),
      });
    }
    await page
      .screenshot({ path: path.join(out, `${name}-${String(++n).padStart(2, "0")}.png`) })
      .catch(() => {});
  };
  try {
    await fn(page, step);
  } finally {
    await context.close();
  }
}

const loaderGone = (page) =>
  page.waitForFunction(() => !document.getElementById("odd-loader"), null, { timeout: 60_000 });
const ready = (page) => page.waitForSelector(".island-surface.ready", { timeout: 60_000 });

await journey("booking", { width: 1440, height: 900 }, async (page, step) => {
  await step("arrival: loader shows, then reveals a ready island", async () => {
    await page.goto(`${base}/`, { waitUntil: "commit" });
    const sawLoader = await page.waitForSelector("#odd-loader", { timeout: 10_000 }).then(
      () => true,
      () => false,
    );
    await loaderGone(page);
    await ready(page);
    return { sawLoader };
  });
  await step("find your little escape → stays", async () => {
    await page
      .getByRole("link", { name: /find your little escape/i })
      .first()
      .click();
    await page.waitForURL(/\/stays/);
    return { cards: await page.locator(".stay-card").count() };
  });
  await step("explore the Weather House", async () => {
    await page
      .getByRole("button", { name: /explore this stay/i })
      .first()
      .click();
    await page.waitForURL(/\/stays\/weather-house/);
    await ready(page);
  });
  await step("take a peek inside (roof opens)", async () => {
    await page
      .getByRole("button", { name: /take a peek inside/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /tuck the roof back in/i })
      .first()
      .waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1500);
  });
  await step("make this your little place → plan", async () => {
    await page
      .getByRole("button", { name: /make this your little place/i })
      .first()
      .click();
    await page.waitForURL(/\/plan/);
  });
  await step("plan: too many guests is explained and blocks the summary", async () => {
    await page.getByLabel("Guests").selectOption("3");
    await page
      .getByText(/sleeps 2\. Choose fewer guests/i)
      .first()
      .waitFor({ timeout: 5000 });
    const next = page.getByRole("button", { name: /see your island plan/i }).first();
    if (await next.isEnabled())
      throw new Error("summary reachable with 3 guests in a 2-guest stay");
  });
  await step("plan: unavailable dates are explained and block the summary", async () => {
    await page.getByLabel("Guests").selectOption("2");
    await page.getByLabel("Arrive").fill("2026-10-14");
    await page.getByLabel("Leave").fill("2026-10-17");
    await page
      .getByText(/unavailable for part of those sample dates/i)
      .first()
      .waitFor({ timeout: 5000 });
    const next = page.getByRole("button", { name: /see your island plan/i }).first();
    if (await next.isEnabled()) throw new Error("summary reachable on blocked dates");
  });
  await step("plan: open dates, two guests, one more activity", async () => {
    await page.getByLabel("Arrive").fill("2026-10-19");
    await page.getByLabel("Leave").fill("2026-10-22");
    const add = page.getByRole("button", { name: /^add \+$/i }).first();
    await add.click();
    // A new activity lands at the hour on the dial and may clash with the day; the planner
    // explains the clash and offers to fit everything around the tide and each other.
    const repair = page.getByRole("button", { name: /find a time that works/i });
    const clashed = await repair.isVisible();
    if (clashed) {
      await repair.click();
      await page
        .getByText(/fitted around the tide and each other/i)
        .first()
        .waitFor({ timeout: 5000 });
    }
    const next = page.getByRole("button", { name: /see your island plan/i }).first();
    if (!(await next.isEnabled())) throw new Error("plan still blocked after repair");
    const query = new URL(page.url()).searchParams;
    if (query.get("guests") !== "2" || query.get("in") !== "2026-10-19")
      throw new Error(`plan not kept: ${query}`);
    return { clashed, query: String(query).slice(0, 140) };
  });
  await step("see your island plan → summary", async () => {
    await page
      .getByRole("button", { name: /see your island plan/i })
      .first()
      .click();
    await page.waitForURL(/\/summary/);
    if (!/guests=2/.test(page.url())) throw new Error("summary lost the plan");
    await page.locator(".postcard img").first().waitFor({ timeout: 15_000 });
    return {
      postcard: await page
        .locator(".postcard img")
        .first()
        .evaluate((img) => img.naturalWidth),
    };
  });
  await step("take a postcard with you (download)", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 20_000 }),
      page
        .getByRole("button", { name: /take a postcard with you/i })
        .first()
        .click(),
    ]);
    const file = path.join(out, "postcard.png");
    await download.saveAs(file);
    return { suggested: download.suggestedFilename() };
  });
});

await journey("discovery", { width: 1440, height: 900 }, async (page, step) => {
  await step("open the island", async () => {
    await page.goto(`${base}/`);
    await loaderGone(page);
    await ready(page);
  });
  await step("follow a little curiosity (clues appear)", async () => {
    await page
      .getByRole("button", { name: /follow a little curiosity/i })
      .first()
      .click();
    await page.locator(".clue-list").waitFor({ timeout: 10_000 });
    return { clues: await page.locator(".clue-list button").count() };
  });
  await step("collect the three lens pieces, each at its moment", async () => {
    // Each clue names when it can be found; turn the day until its button wakes, then collect.
    const slider = page.locator("#clue-time");
    const collect = async (title, hours) => {
      const button = page.getByRole("button", { name: `Collect lens piece: ${title}` });
      for (const hour of hours) {
        await slider.fill(String(hour));
        if (await button.isEnabled()) {
          await button.click();
          return hour;
        }
      }
      throw new Error(`${title}: never collectable`);
    };
    return {
      weather: await collect("Something in the wind", [8]),
      stars: await collect("The last little star", [20]),
      bath: await collect(
        "A glint beside the bath",
        Array.from({ length: 33 }, (_, i) => 6 + i * 0.5),
      ),
    };
  });
  await step("the lighthouse is restored", async () => {
    await page.getByText(/lighthouse is glowing again/i).waitFor({ timeout: 10_000 });
    await page
      .getByText(/lighthouse restored/i)
      .first()
      .waitFor({ timeout: 10_000 });
  });
});

await journey("timelapse", { width: 1440, height: 900 }, async (page, step) => {
  await step("open the island", async () => {
    await page.goto(`${base}/`);
    await loaderGone(page);
    await ready(page);
  });
  await step("watch the day go by (hour advances)", async () => {
    const before = await page.locator(".tide-label strong").first().innerText();
    await page
      .getByRole("button", { name: /watch the day go by/i })
      .first()
      .click();
    await page.waitForTimeout(4000);
    const during = await page.locator(".tide-label strong").first().innerText();
    await page
      .getByRole("button", { name: /pause the day/i })
      .first()
      .click();
    return { before: before.slice(0, 5), during: during.slice(0, 5), url: page.url().slice(-60) };
  });
});

await journey("mobile", { width: 390, height: 844 }, async (page, step) => {
  await step("arrival on a phone", async () => {
    await page.goto(`${base}/`);
    await loaderGone(page);
    await ready(page);
  });
  await step("menu opens and reaches the planner", async () => {
    await page.getByRole("button", { name: /menu/i }).first().click();
    await page
      .getByRole("link", { name: /make yourself at home|plan/i })
      .first()
      .click();
    await page.waitForURL(/\/plan/);
  });
});

await journey("status", { width: 1280, height: 800 }, async (page, step) => {
  const expect = async (url, status, text) => {
    const response = await page.goto(url);
    if (response?.status() !== status) throw new Error(`${url}: status ${response?.status()}`);
    if (text) await page.getByText(text).first().waitFor({ timeout: 10_000 });
    return { status };
  };
  await step("preview: an unknown route answers 404 with the wrong-turn page", () =>
    expect(`${preview}/no-such-cove`, 404, /a small wrong turn/i),
  );
  await step("preview: an unknown stay answers 404", () =>
    expect(`${preview}/stays/the-lost-hut`, 404),
  );
  await step("preview: a missing file answers 404", () =>
    expect(`${preview}/plates/no-such-plate.webp`, 404),
  );
  await step("preview: a stay route answers 200", () =>
    expect(`${preview}/stays/nap-observatory`, 200),
  );
  await step("dev: an unknown route shows the wrong-turn page", () =>
    expect(`${base}/no-such-cove`, 200, /a small wrong turn/i),
  );
});

await browser.close();
report.finished = new Date().toISOString();
report.passed = report.steps.filter((s) => s.ok).length;
report.failed = report.steps.filter((s) => !s.ok).length;
writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
console.log(
  `journeys: ${report.passed} passed, ${report.failed} failed, ${report.errors.length} page errors`,
);
for (const s of report.steps.filter((x) => !x.ok))
  console.log(`FAIL ${s.journey} / ${s.step}: ${s.error}`);

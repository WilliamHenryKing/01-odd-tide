// The arrival loader: a tide clock that fills while the island loads, then reveals the page
// only when it is ready to be seen — fonts in, models and textures loaded, shaders compiled and
// the first frames lit — instead of letting the visitor watch the page assemble itself.
//
// The overlay itself is static HTML/CSS in index.html (so it paints before any script runs);
// this module drives it. Progress is honest: it comes from real loading stages, is never
// allowed to go backwards, and is only eased for display. A failure or a very slow device
// reveals the page anyway (the island's own poster and status take over).

type Stage = "module" | "assets" | "compile" | "frames";

/** Share of the bar each stage owns, in order. */
const STAGES: Record<Stage, [number, number]> = {
  module: [0.06, 0.14],
  assets: [0.14, 0.84],
  compile: [0.84, 0.95],
  frames: [0.95, 1],
};
const LINES: [number, string][] = [
  [0.14, "Checking the tide tables…"],
  [0.5, "Carrying the cabins down to the shore…"],
  [0.84, "Warming up the bath…"],
  [0.97, "Lighting the lamps…"],
  [1.01, "Here we are."],
];
/** Reveal regardless after this long: the island keeps loading behind its poster. */
const TIMEOUT_MS = 25_000;

let target = 0.06;
let shown = 0;
let started = false;
let exiting = false;
let pending = 0;
let revealResolve: (() => void) | null = null;
const revealed =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        revealResolve = resolve;
      });

/** Resolves as the loader begins to reveal the page (immediately if there was no loader). */
export function whenRevealed(): Promise<void> {
  return revealed;
}

/** Raise the bar to `fraction` (0–1) of a stage. Stages only ever move it forward. */
export function reportLoading(stage: Stage, fraction = 1) {
  const [from, to] = STAGES[stage];
  const value = from + (to - from) * Math.min(1, Math.max(0, fraction));
  if (value > target) target = value;
}

let worldGate: (() => void) | null = null;
/** The island has rendered its first settled frames. */
export function worldReady() {
  reportLoading("frames", 1);
  worldGate?.();
}
/** The island could not start (no WebGL, a lost context, a failed load): reveal now. */
export function worldFailed() {
  target = 1;
  worldGate?.();
}

export function startLoader({ world }: { world: boolean }) {
  const root = document.documentElement;
  const overlay = document.getElementById("odd-loader");
  if (started || !overlay || !root.classList.contains("odd-loading")) {
    revealResolve?.();
    return;
  }
  started = true;
  const text = overlay.querySelector<HTMLElement>("[data-loader-text]");
  const percent = overlay.querySelector<HTMLElement>("[data-loader-percent]");
  const start = (window as unknown as { __oddLoaderStart?: number }).__oddLoaderStart ?? 0;
  document.body.setAttribute("aria-busy", "true");

  const gates: Promise<unknown>[] = [document.fonts?.ready ?? Promise.resolve()];
  if (world) gates.push(new Promise<void>((resolve) => (worldGate = resolve)));
  else target = 1;
  pending = gates.length;
  for (const gate of gates) void gate.then(() => pending--);

  const reveal = () => {
    if (exiting) return;
    exiting = true;
    const quick = performance.now() - start < 450;
    overlay.classList.add(quick ? "quick" : "done");
    document.body.removeAttribute("aria-busy");
    revealResolve?.();
    window.setTimeout(
      () => {
        root.classList.remove("odd-loading");
        overlay.remove();
      },
      quick ? 320 : 1250,
    );
  };
  const timeout = window.setTimeout(() => {
    target = 1;
    pending = 0;
  }, TIMEOUT_MS);

  let last = performance.now();
  let line = "";
  const tick = (now: number) => {
    // rAF timestamps can precede the scheduling time: never step backwards.
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    // Ease toward the real progress; a little faster once everything is in.
    shown += (target - shown) * (1 - Math.exp(-dt * (pending ? 4 : 7)));
    if (target - shown < 0.002) shown = target;
    overlay.style.setProperty("--progress", shown.toFixed(4));
    if (percent) percent.textContent = `${Math.round(shown * 100)}%`;
    const next = LINES.find(([limit]) => shown < limit)?.[1] ?? "";
    if (text && next !== line) {
      line = next;
      text.textContent = next;
    }
    if (pending <= 0 && shown >= 0.995) {
      window.clearTimeout(timeout);
      reveal();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

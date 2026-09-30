// Quality tiers and the frame governor, so the island runs smoothly on a modest laptop and at
// full fidelity on a capable GPU. The tier is guessed at startup from the GPU and the device
// (overridable with ?quality=low|medium|high, and per setting with ?ao=0|1, ?msaa=0|2|4,
// ?shadow=1024 and ?budget=<pixels>); the governor then watches real frame times and trades
// render resolution first, then ambient occlusion, for smoothness.

export type Quality = "high" | "medium" | "low";

export interface Tier {
  /** Drawing-buffer pixels the scene may use. */
  pixelBudget: number;
  maxPixelRatio: number;
  /** Multisampling of the HDR target (0 = off). */
  msaa: number;
  /** Ground-truth ambient occlusion (a second geometry pass and a denoise). */
  ao: boolean;
  /** The Sun's shadow map, per side. */
  shadow: number;
}

export const TIERS: Record<Quality, Tier> = {
  // As authored (D08): full density up to about 2560 × 1440.
  high: { pixelBudget: 3.7e6, maxPixelRatio: 3, msaa: 4, ao: true, shadow: 4096 },
  medium: { pixelBudget: 2.1e6, maxPixelRatio: 1.5, msaa: 2, ao: false, shadow: 2048 },
  low: { pixelBudget: 1.0e6, maxPixelRatio: 1, msaa: 0, ao: false, shadow: 1024 },
};

/**
 * The address as the page was first opened: the app soon rewrites its query to carry the day's
 * plan, so the overrides are read once, when this module first loads (main.tsx imports it).
 */
const opened = (() => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
})();

function params() {
  return opened;
}

/** A first guess from the GPU's name and the device; the governor corrects it in play. */
export function detectQuality(): Quality {
  const forced = params().get("quality");
  if (forced === "high" || forced === "medium" || forced === "low") return forced;
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = String(
        ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      );
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // No WebGL 2 at all: the lowest tier is the kindest guess.
    return "low";
  }
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return "low";
  if (coarse) return /apple gpu|adreno \(tm\) 7|mali-g7/i.test(gpu) ? "medium" : "low";
  if (/nvidia|geforce|rtx|gtx|radeon (rx|pro)|amd radeon rx|apple m[2-9]/i.test(gpu)) return "high";
  if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega|apple m1/i.test(gpu)) return "medium";
  return "medium";
}

/** The tier's settings, with any single setting forced from the URL. */
export function tierSettings(quality: Quality): Tier {
  const p = params();
  const t = { ...TIERS[quality] };
  const ao = p.get("ao");
  if (ao === "0" || ao === "1") t.ao = ao === "1";
  const msaa = Number(p.get("msaa"));
  if (p.has("msaa") && [0, 2, 4, 8].includes(msaa)) t.msaa = msaa;
  const shadow = Number(p.get("shadow"));
  if (p.has("shadow") && [512, 1024, 2048, 4096].includes(shadow)) t.shadow = shadow;
  const budget = Number(p.get("budget"));
  if (p.has("budget") && budget >= 2e5 && budget <= 1e7) t.pixelBudget = budget;
  return t;
}

/**
 * Watches frame times over one-second windows. Slow windows lower the render scale step by
 * step (down to 60 %), then drop ambient occlusion; long runs of fast windows raise the scale
 * again. It never changes anything while frames are not being drawn (the island rests when
 * nothing moves), and it ignores the first seconds, while shaders compile.
 */
export class FrameGovernor {
  private sum = 0;
  private count = 0;
  private window = 0;
  private fastWindows = 0;
  private warmup = 3;

  constructor(
    /** The frame time to hold (seconds). */
    private target: number,
    private setScale: (scale: number) => void,
    private scale: () => number,
    /** Drop one expensive feature; returns false when there is nothing left to drop. */
    private shed: () => boolean,
  ) {}

  sample(dt: number) {
    if (dt <= 0 || dt > 0.25) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    this.sum += dt;
    this.count++;
    this.window += dt;
    if (this.window < 1) return;
    const average = this.sum / this.count;
    this.sum = this.count = this.window = 0;
    const s = this.scale();
    if (average > this.target * 1.25) {
      this.fastWindows = 0;
      if (s > 0.62) this.setScale(Math.max(0.6, s - 0.1));
      else this.shed();
    } else if (average < this.target * 0.7) {
      if (++this.fastWindows >= 4 && s < 1) {
        this.fastWindows = 0;
        this.setScale(Math.min(1, s + 0.1));
      }
    } else this.fastWindows = 0;
  }
}

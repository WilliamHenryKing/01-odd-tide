export function distribution(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
  return {
    count: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted.at(-1) ?? null,
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
    over16_67: sorted.filter((x) => x > 1000 / 60 + 0.25).length,
    over33_33: sorted.filter((x) => x > 1000 / 30 + 0.25).length,
    over50: sorted.filter((x) => x > 50).length,
  };
}

// Exact RGBA8 uncompressed mip-chain payload; excludes driver/render-target overhead.
export function rgbaMipBytes(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new Error("Texture dimensions must be positive finite integers");
  let bytes = 0;
  for (;;) {
    bytes += width * height * 4;
    if (width === 1 && height === 1) return bytes;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
}

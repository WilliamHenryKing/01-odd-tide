import { describe, expect, test } from "bun:test";
import { distribution, rgbaMipBytes } from "../src/visual/perf-math";

describe("performance evidence math", () => {
  test("nearest-rank percentiles retain stalls and missing samples stay missing", () => {
    const values = [...Array.from({ length: 99 }, (_, i) => i + 1), 1000];
    expect(distribution(values)).toMatchObject({
      count: 100,
      p50: 50,
      p95: 95,
      p99: 99,
      max: 1000,
    });
    expect(distribution([])).toMatchObject({ count: 0, p95: null, mean: null });
    expect(distribution([NaN, 7, Infinity])).toMatchObject({ count: 1, p95: 7 });
  });
  test("texture payload sums rectangular mip levels without confusing MiB and bytes", () => {
    expect(rgbaMipBytes(1, 1)).toBe(4);
    expect(rgbaMipBytes(4, 2)).toBe(44);
    expect(rgbaMipBytes(1024, 1024)).toBe(5592404);
    expect(() => rgbaMipBytes(NaN, 1024)).toThrow();
    expect(() => rgbaMipBytes(Infinity, 1024)).toThrow();
    expect(() => rgbaMipBytes(0, 1024)).toThrow();
  });
});

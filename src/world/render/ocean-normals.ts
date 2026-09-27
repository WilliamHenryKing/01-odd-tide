import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from "three";

// A tileable ocean slope map synthesised once at start-up (Tessendorf): a Phillips wind-wave
// spectrum sampled on a periodic grid, inverse-FFT'd to a height field and differentiated.
// Thousands of wave components, so scrolled layers never read as a repeating pattern.

/** In-place iterative radix-2 FFT on (re, im) of length n (a power of two). */
function fft(re: Float32Array, im: Float32Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] as number;
      re[i] = re[j] as number;
      re[j] = tr;
      const ti = im[i] as number;
      im[i] = im[j] as number;
      im[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const br = (re[b] as number) * cr - (im[b] as number) * ci;
        const bi = (re[b] as number) * ci + (im[b] as number) * cr;
        re[b] = (re[a] as number) - br;
        im[b] = (im[a] as number) - bi;
        re[a] = (re[a] as number) + br;
        im[a] = (im[a] as number) + bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Seeded Gaussian pairs (Box–Muller over a small LCG), so the sea is identical every load. */
function gaussian(seed: number) {
  let state = seed >>> 0;
  const uniform = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
  return () => {
    const u = uniform();
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)] as const;
  };
}

/**
 * texture: normalised slopes (RG) and squared slopes (BA); rms: the RMS of the normalised slope,
 * so a shader can scale a layer to a chosen physical RMS slope (the spectrum has no absolute
 * amplitude of its own).
 */
export type OceanNormals = { texture: DataTexture; tile: number; rms: number };

/**
 * size: grid resolution (power of two); tile: patch size in metres; wind: speed (m/s) and
 * direction (radians, toward +x at 0).
 */
export function createOceanNormals(size = 256, tile = 24, wind = { speed: 6.5, angle: 0.5 }) {
  const n = size;
  const re = new Float32Array(n * n);
  const im = new Float32Array(n * n);
  const g = 9.81;
  const windLength = (wind.speed * wind.speed) / g;
  const wx = Math.cos(wind.angle);
  const wz = Math.sin(wind.angle);
  const random = gaussian(90210);
  const damping = 0.02; // metres: suppress capillary scales below this
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const m = row < n / 2 ? row : row - n;
      const k0 = col < n / 2 ? col : col - n;
      const kx = (2 * Math.PI * k0) / tile;
      const kz = (2 * Math.PI * m) / tile;
      const k = Math.hypot(kx, kz);
      const index = row * n + col;
      if (k < 1e-6) continue;
      const align = (kx * wx + kz * wz) / k;
      // Phillips spectrum; waves travelling against the wind are damped rather than removed.
      const phillips =
        (Math.exp(-(1 / (k * windLength) ** 2)) / k ** 4) *
        (align > 0 ? align * align : 0.07 * align * align) *
        Math.exp(-((k * damping) ** 2));
      const [a, b] = random();
      const amplitude = Math.sqrt(phillips / 2);
      re[index] = a * amplitude;
      im[index] = b * amplitude;
    }
  // Make the spectrum Hermitian so the height field is real: h(-k) = conj(h(k)).
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const j = ((n - row) % n) * n + ((n - col) % n);
      if (j <= i) continue;
      const r = ((re[i] as number) + (re[j] as number)) / 2;
      const q = ((im[i] as number) - (im[j] as number)) / 2;
      re[i] = r;
      im[i] = q;
      re[j] = r;
      im[j] = -q;
    }
  // 2D inverse FFT: rows, then columns.
  const rowRe = new Float32Array(n);
  const rowIm = new Float32Array(n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      rowRe[col] = re[row * n + col] as number;
      rowIm[col] = im[row * n + col] as number;
    }
    fft(rowRe, rowIm, true);
    for (let col = 0; col < n; col++) {
      re[row * n + col] = rowRe[col] as number;
      im[row * n + col] = rowIm[col] as number;
    }
  }
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n; row++) {
      rowRe[row] = re[row * n + col] as number;
      rowIm[row] = im[row * n + col] as number;
    }
    fft(rowRe, rowIm, true);
    for (let row = 0; row < n; row++) re[row * n + col] = rowRe[row] as number;
  }
  // Normals from periodic central differences, normalised so the steepest ~1% of slopes use the
  // full range; the shader scales strength per layer.
  const texel = tile / n;
  const slopes = new Float32Array(n * n * 2);
  let maxSlope = 0;
  const all: number[] = [];
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const h = (r: number, c: number) => re[((r + n) % n) * n + ((c + n) % n)] as number;
      const dx = (h(row, col + 1) - h(row, col - 1)) / (2 * texel);
      const dz = (h(row + 1, col) - h(row - 1, col)) / (2 * texel);
      slopes[(row * n + col) * 2] = dx;
      slopes[(row * n + col) * 2 + 1] = dz;
      if (((row * n + col) & 15) === 0) all.push(Math.hypot(dx, dz));
    }
  all.sort((p, q) => p - q);
  maxSlope = all[Math.floor(all.length * 0.99)] ?? 1;
  const data = new Uint8Array(n * n * 4);
  let sumSquares = 0;
  for (let i = 0; i < n * n; i++) {
    const sx = Math.max(-1, Math.min(1, (slopes[i * 2] as number) / maxSlope));
    const sz = Math.max(-1, Math.min(1, (slopes[i * 2 + 1] as number) / maxSlope));
    // RG: slope; BA: slope squared. Mipmaps then average both, so the shader recovers the
    // slope variance a distant texel hides (LEAN mapping) and widens the sun's glint to match.
    data[i * 4] = Math.round((sx * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((sz * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round(sx * sx * 255);
    data[i * 4 + 3] = Math.round(sz * sz * 255);
    sumSquares += sx * sx + sz * sz;
  }
  const rms = Math.sqrt(sumSquares / (n * n));
  const texture = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = NoColorSpace;
  texture.name = "ocean-slopes";
  texture.needsUpdate = true;
  return { texture, tile, rms } satisfies OceanNormals;
}

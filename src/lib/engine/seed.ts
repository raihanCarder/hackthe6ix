/**
 * Deterministic hashing and seeded random utilities (documentation/ideas/ALGORITHM_DESIGN.md §14).
 * Pure — no Node crypto so the engine stays portable and trivially testable.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function hashString(input: string): string {
  const [a, b, c, d] = cyrb128(input);
  return (
    a.toString(16).padStart(8, "0") +
    b.toString(16).padStart(8, "0") +
    c.toString(16).padStart(8, "0") +
    d.toString(16).padStart(8, "0")
  );
}

export type Rng = () => number;

/** sfc32 PRNG seeded from an arbitrary string. Returns floats in [0, 1). */
export function createRng(seed: string): Rng {
  let [a, b, c, d] = cyrb128(seed);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function randNormal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Marsaglia–Tsang gamma sampler (shape > 0, scale 1). */
export function randGamma(rng: Rng, shape: number): number {
  if (shape <= 0) throw new Error("gamma shape must be > 0");
  if (shape < 1) {
    // Boosting: Gamma(a) = Gamma(a+1) * U^(1/a)
    const u = Math.max(rng(), Number.MIN_VALUE);
    return randGamma(rng, shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = randNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleDirichlet(rng: Rng, alphas: number[]): number[] {
  const draws = alphas.map((a) => randGamma(rng, Math.max(a, 1e-9)));
  const total = draws.reduce((s, x) => s + x, 0);
  if (total <= 0) {
    return alphas.map(() => 1 / alphas.length);
  }
  return draws.map((x) => x / total);
}

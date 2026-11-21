// Seeded RNG (sfc32) + helpers. One instance per game; every gameplay roll
// comes from it, so the same seed replays the same city, traffic and fights.
export function createRng(seed) {
  let a = (seed | 0) >>> 0;
  let b = (seed ^ 0x9e3779b9) >>> 0;
  let c = ((seed * 2654435761) >>> 0) ^ 0x85ebca6b;
  let d = ((seed * 2246822519) >>> 0) ^ 0xc2b2ae35;
  // Warm up so the first draws are not visibly correlated with the seed.
  for (let i = 0; i < 16; i++) {
    const t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); d = (d + 1) | 0; const u = (t + d) | 0; d = (d + u) | 0; c = (c + u) | 0;
  }
  function next() {
    const t = (a + b) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    const u = (t + d) | 0;
    d = (d + u) | 0;
    c = (c + u) | 0;
    return ((u >>> 0) / 4294967296);
  }
  return {
    next,
    range(lo, hi) { return lo + (hi - lo) * next(); },
    int(lo, hi) { return Math.floor(lo + (hi - lo + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}

// Deterministic string hash -> seed, for per-entity stable variation.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

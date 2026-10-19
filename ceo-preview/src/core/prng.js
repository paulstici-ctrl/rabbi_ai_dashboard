// Deterministic PRNG utilities: same seed -> same demo data on every machine.
export function xmur3(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; }; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function rngFor(label) {
  const rnd = mulberry32(xmur3(String(label))());
  let spare = null;
  const normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); const m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v); };
  return { rnd, normal, int: (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)), pick: (a) => a[Math.floor(rnd() * a.length)], chance: (p) => rnd() < p };
}
export const hash32 = (s) => xmur3(String(s))();

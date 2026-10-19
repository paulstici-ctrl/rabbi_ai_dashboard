// Pure indicator maths on arrays. No DOM, no randomness.
export const closes = (c) => c.map((x) => x.c);
export function sma(v, n) {
  const out = new Array(v.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) out[i] = s / n; }
  return out;
}
export function ema(v, n) {
  const out = new Array(v.length).fill(NaN);
  if (!v.length) return out;
  const k = 2 / (n + 1);
  out[0] = v[0];
  for (let i = 1; i < v.length; i++) out[i] = v[i] * k + out[i - 1] * (1 - k);
  return out;
}
export function trueRange(c) {
  return c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
}
export function atr(c, n = 14) {
  const tr = trueRange(c), out = new Array(c.length).fill(NaN);
  if (c.length < n) return out;
  let a = tr.slice(0, n).reduce((s, x) => s + x, 0) / n;
  out[n - 1] = a;
  for (let i = n; i < c.length; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
  return out;
}
export function rsi(v, n = 14) {
  const out = new Array(v.length).fill(NaN);
  if (v.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= n; l /= n;
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
export const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const last = (a) => a[a.length - 1];

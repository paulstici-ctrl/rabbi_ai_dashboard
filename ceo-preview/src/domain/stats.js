import { rngFor } from '../core/prng.js';
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : NaN);
export function equityFromR(rs, start = 0) { const out = []; let e = start; for (const r of rs) { e += r; out.push(e); } return out; }
export function drawdownSeries(curve) { let peak = -Infinity; return curve.map((v) => { peak = Math.max(peak, v); return v - peak; }); }
export const maxDrawdown = (curve) => Math.abs(Math.min(0, ...drawdownSeries(curve)));
export const winRate = (rs) => (rs.length ? rs.filter((r) => r > 0).length / rs.length : NaN);
export function profitFactor(rs) { const g = sum(rs.filter((r) => r > 0)), l = -sum(rs.filter((r) => r < 0)); return l > 0 ? g / l : g > 0 ? Infinity : NaN; }
export function longestStreak(rs, win) { let best = 0, cur = 0; for (const r of rs) { cur = (win ? r > 0 : r < 0) ? cur + 1 : 0; best = Math.max(best, cur); } return best; }
export function percentile(a, p) { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
export function summarize(rs) {
  const eq = equityFromR(rs);
  return { trades: rs.length, mean_r: mean(rs), net_r: sum(rs), win_rate: winRate(rs), profit_factor: profitFactor(rs), max_dd_r: maxDrawdown(eq), longest_loss_streak: longestStreak(rs, false), longest_win_streak: longestStreak(rs, true) };
}
// Day-block bootstrap of the trade-weighted mean (mirrors the Python research code). Deterministic for a seed.
export function bootstrapMeanCI(values, groups, { B = 400, seed = 'boot', ci = 0.95 } = {}) {
  const by = new Map();
  values.forEach((v, i) => { const g = groups[i]; const e = by.get(g) || { s: 0, n: 0 }; e.s += v; e.n += 1; by.set(g, e); });
  const days = [...by.values()], d = days.length;
  if (d < 2) return { mean: mean(values), ci_low: null, ci_high: null, days: d };
  const rng = rngFor(seed), means = [];
  for (let b = 0; b < B; b++) { let s = 0, n = 0; for (let k = 0; k < d; k++) { const e = days[Math.floor(rng.rnd() * d)]; s += e.s; n += e.n; } means.push(s / n); }
  return { mean: mean(values), ci_low: percentile(means, (1 - ci) / 2), ci_high: percentile(means, 1 - (1 - ci) / 2), days: d };
}
export function normalCdf(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
// Benjamini-Hochberg adjusted p-values (monotone step-up), same order as the input.
export function bhAdjust(p) {
  const m = p.length, idx = p.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), out = new Array(m);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) { prev = Math.min(prev, idx[k][0] * m / (k + 1)); out[idx[k][1]] = prev; }
  return out;
}

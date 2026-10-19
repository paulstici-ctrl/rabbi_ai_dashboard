// Market-structure analysis used by the Terminal overlays. Pure and deterministic.
// Pivots are CONFIRMED only k candles after they form, so overlays never use future data.
import { atr, closes, ema, median } from './indicators.js';

export function pivots(c, k = 3) {
  const highs = [], lows = [];
  for (let i = k; i < c.length - k; i++) {
    let hi = true, lo = true;
    for (let j = 1; j <= k; j++) {
      if (!(c[i].h > c[i - j].h && c[i].h >= c[i + j].h)) hi = false;
      if (!(c[i].l < c[i - j].l && c[i].l <= c[i + j].l)) lo = false;
    }
    if (hi) highs.push({ i, price: c[i].h, t: c[i].t });
    if (lo) lows.push({ i, price: c[i].l, t: c[i].t });
  }
  return { highs, lows, k };
}

export function zones(c, piv, opts = {}) {
  const n = c.length, a = atr(c, 14)[n - 1];
  if (!Number.isFinite(a) || n < 30) return [];
  const { maxZones = 6, minTouches = 2, window = 300 } = opts, close = c[n - 1].c;
  const pts = [...piv.highs, ...piv.lows].filter((p) => p.i >= n - window).sort((x, y) => x.price - y.price);
  const clusters = [];
  for (const p of pts) {
    const cl = clusters[clusters.length - 1];
    if (cl && p.price - cl.pts[0].price <= 0.6 * a) cl.pts.push(p); else clusters.push({ pts: [p] });   // anchored: a zone never grows wider than ~0.6 ATR
  }
  return clusters.filter((cl) => cl.pts.length >= minTouches).map((cl) => {
    const prices = cl.pts.map((p) => p.price), lo = Math.min(...prices) - 0.08 * a, hi = Math.max(...prices) + 0.08 * a, mid = (lo + hi) / 2;
    const lastI = Math.max(...cl.pts.map((p) => p.i));
    const recency = 1 - (n - 1 - lastI) / window;
    return { type: mid < close ? 'support' : 'resistance', lo, hi, mid, touches: cl.pts.length, firstI: Math.min(...cl.pts.map((p) => p.i)), lastI, strength: +(cl.pts.length + recency).toFixed(2) };
  }).sort((x, y) => y.strength - x.strength).slice(0, maxZones);
}

export function trend(c) {
  const n = c.length;
  if (n < 60) return { direction: 'RANGE', strength: 0, relative: 0, slope: 0, structure: 'n/a' };
  const cl = closes(c), e20 = ema(cl, 20), e50 = ema(cl, 50), a = atr(c, 14)[n - 1];
  const relative = (e20[n - 1] - e50[n - 1]) / a, slope = (e20[n - 1] - e20[n - 11]) / (10 * a);
  const direction = relative > 0.6 && slope > 0.02 ? 'UP' : relative < -0.6 && slope < -0.02 ? 'DOWN' : 'RANGE';
  const p = pivots(c, 3), h = p.highs.slice(-2), l = p.lows.slice(-2);
  let structure = 'mixed';
  if (h.length === 2 && l.length === 2) {
    const hh = h[1].price > h[0].price, hl = l[1].price > l[0].price;
    structure = hh && hl ? 'HH/HL' : !hh && !hl ? 'LH/LL' : hh ? 'HH/LL' : 'LH/HL';
  }
  return { direction, strength: Math.min(1, Math.abs(relative) / 2), relative, slope, structure };
}

export function sweeps(c, piv, opts = {}) {
  const { lookback = 60 } = opts, k = piv.k, a = atr(c, 14), out = [], used = new Set();
  for (let j = 20; j < c.length; j++) {
    for (const p of piv.highs) {
      const key = 'h' + p.i;
      if (used.has(key) || p.i + k > j || j - p.i > lookback) continue;
      if (c[j].h > p.price && c[j].c < p.price) { used.add(key); out.push({ i: j, level: p.price, kind: 'BUY_SIDE', bias: 'BEARISH', pivotI: p.i, wickAtr: Number.isFinite(a[j]) ? (c[j].h - p.price) / a[j] : 0 }); }
    }
    for (const p of piv.lows) {
      const key = 'l' + p.i;
      if (used.has(key) || p.i + k > j || j - p.i > lookback) continue;
      if (c[j].l < p.price && c[j].c > p.price) { used.add(key); out.push({ i: j, level: p.price, kind: 'SELL_SIDE', bias: 'BULLISH', pivotI: p.i, wickAtr: Number.isFinite(a[j]) ? (p.price - c[j].l) / a[j] : 0 }); }
    }
  }
  return out;
}

export function regime(c) {
  const a = atr(c, 14), n = c.length;
  if (n < 80 || !Number.isFinite(a[n - 1])) return 'RANGE';
  const ref = median(a.slice(n - 60, n - 1));
  if (a[n - 1] > 1.8 * ref) return 'VOLATILE';
  const t = trend(c).direction;
  return t === 'UP' ? 'TREND_UP' : t === 'DOWN' ? 'TREND_DOWN' : 'RANGE';
}

export function trendLines(c, piv) {
  const out = [], n = c.length;
  const l = piv.lows.slice(-2), h = piv.highs.slice(-2);
  if (l.length === 2) out.push({ kind: 'support', x1: l[0].i, y1: l[0].price, x2: l[1].i, y2: l[1].price, to: n - 1 });
  if (h.length === 2) out.push({ kind: 'resistance', x1: h[0].i, y1: h[0].price, x2: h[1].i, y2: h[1].price, to: n - 1 });
  return out;
}

export const analyze = (c) => { const piv = pivots(c, 3); return { pivots: piv, zones: zones(c, piv), trend: trend(c), sweeps: sweeps(c, piv), regime: regime(c), lines: trendLines(c, piv) }; };

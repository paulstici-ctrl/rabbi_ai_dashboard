// Pure geometry helpers for the canvas charts (unit-tested without a DOM).
import { fmtDate, fmtTime, pad2 } from '../../core/format.js';

export function niceStep(range, target = 6) {
  if (!(range > 0)) return 1;
  const raw = range / Math.max(1, target), p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return +((f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p).toPrecision(12);
}
export function niceTicks(min, max, target = 6) {
  const step = niceStep(max - min, target), ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(12));
  return { ticks, step };
}
export function priceExtent(candles, i0, i1, extra = []) {
  let lo = Infinity, hi = -Infinity;
  for (let i = Math.max(0, i0); i <= Math.min(candles.length - 1, i1); i++) { if (candles[i].l < lo) lo = candles[i].l; if (candles[i].h > hi) hi = candles[i].h; }
  for (const v of extra) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!Number.isFinite(lo)) return { lo: 0, hi: 1 };
  const pad = (hi - lo || Math.abs(hi) * 0.001 || 1) * 0.07;
  return { lo: lo - pad, hi: hi + pad };
}
export const xOfIndex = (i, viewStart, barW, left) => left + (i - viewStart + 0.5) * barW;
export const indexOfX = (x, viewStart, barW, left) => Math.round((x - left) / barW + viewStart - 0.5);
export const yOfPrice = (p, lo, hi, top, h) => top + (1 - (p - lo) / (hi - lo)) * h;
export const priceOfY = (y, lo, hi, top, h) => lo + (1 - (y - top) / h) * (hi - lo);
export function clampView(viewStart, n, visibleBars, rightPad = 8) {
  const max = Math.max(0, n - visibleBars + rightPad), min = -(visibleBars * 0.6);
  return Math.min(max, Math.max(min, viewStart));
}
export function zoomAround(viewStart, barW, anchorX, left, factor, [minW, maxW] = [2, 44]) {
  const nb = Math.min(maxW, Math.max(minW, barW * factor)), idxAtAnchor = (anchorX - left) / barW + viewStart;
  return { barW: nb, viewStart: idxAtAnchor - (anchorX - left) / nb };
}
export function axisTimeLabel(unix, tf, prevUnix) {
  const d = new Date(unix * 1000), newDay = prevUnix != null && new Date(prevUnix * 1000).getUTCDate() !== d.getUTCDate();
  if (tf === 'H4') return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return newDay || (tf === 'H1' && d.getUTCHours() === 0) ? `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` : fmtTime(unix);
}
export function timeTicks(candles, i0, i1, tf, plotW, visible, minPx = 84) {
  const out = [], every = Math.max(1, Math.ceil((minPx / (plotW / Math.max(1, visible)))));
  let last = -Infinity;
  for (let i = Math.max(0, Math.ceil(i0)); i <= Math.min(candles.length - 1, i1); i++) {
    if (i - last >= every) { out.push({ i, label: axisTimeLabel(candles[i].t, tf, i > 0 ? candles[i - 1].t : null) }); last = i; }
  }
  return out;
}
export const nearestIndex = (xs, x) => { let lo = 0, hi = xs.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; } return lo > 0 && Math.abs(xs[lo - 1] - x) <= Math.abs(xs[lo] - x) ? lo - 1 : lo; };
export const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export { fmtDate };

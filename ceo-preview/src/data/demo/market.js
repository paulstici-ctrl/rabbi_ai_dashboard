// Deterministic synthetic market: regime-switching random walks with session volatility profiles.
// These are NOT real quotes. Same seed -> identical series on every machine.
import { rngFor } from '../../core/prng.js';
import { atr, median } from '../../domain/indicators.js';
import { clamp } from '../../core/format.js';

export const DEMO_NOW = Date.UTC(2026, 9, 19, 12, 0, 0) / 1000;   // fixed "as of" instant of the demo world
const START = Date.UTC(2026, 8, 21, 0, 0, 0) / 1000;
const AHEAD_MIN = 720;                                              // pre-generated minutes used by the demo replay
export const TF_SEC = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400 };
export const TIMEFRAMES = Object.keys(TF_SEC);
export const SYMBOL_CFG = {
  XAUUSD: { symbol: 'XAUUSD', asset_class: 'metal', digits: 2, pip_size: 0.01, pip_value_per_lot_usd: 1.0, spread_floor_pips: 40, max_spread_pips: 80, min_stop_pips: 160, max_spread_r: 0.25, start: 3950, sigma: 0.00032, base_spread_pips: 30, seed: 11 },
  EURUSD: { symbol: 'EURUSD', asset_class: 'fx_major', digits: 5, pip_size: 0.0001, pip_value_per_lot_usd: 10, spread_floor_pips: 1.0, max_spread_pips: 2.0, min_stop_pips: 5, max_spread_r: 0.25, start: 1.085, sigma: 0.00007, base_spread_pips: 0.7, seed: 23 },
  GBPUSD: { symbol: 'GBPUSD', asset_class: 'fx_major', digits: 5, pip_size: 0.0001, pip_value_per_lot_usd: 10, spread_floor_pips: 1.2, max_spread_pips: 2.5, min_stop_pips: 6, max_spread_r: 0.25, start: 1.29, sigma: 0.00009, base_spread_pips: 0.9, seed: 37 },
  GBPJPY: { symbol: 'GBPJPY', asset_class: 'fx_cross', digits: 3, pip_size: 0.01, pip_value_per_lot_usd: 6.5, spread_floor_pips: 1.2, max_spread_pips: 3.0, min_stop_pips: 6, max_spread_r: 0.25, start: 192.4, sigma: 0.00011, base_spread_pips: 1.4, seed: 41 },
};
export const SYMBOLS = Object.keys(SYMBOL_CFG);

const sessionMult = (h) => (h < 7 ? 0.7 : h < 9 ? 1.4 : h < 12 ? 1.1 : h < 16 ? 1.5 : h < 21 ? 0.9 : 0.5);
const frac = (x) => x - Math.floor(x);
const cache = new Map();

function genSeries(sym) {
  const cfg = SYMBOL_CFG[sym], rng = rngFor('market:' + sym), ts = [];
  for (let t = START; t < DEMO_NOW + AHEAD_MIN * 60; t += 60) { const d = new Date(t * 1000), wd = d.getUTCDay(); if (wd === 0 || wd === 6 || (wd === 5 && d.getUTCHours() >= 21)) continue; ts.push(t); }
  const n = ts.length, t = Float64Array.from(ts), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), v = new Float64Array(n);
  const k = 10 ** cfg.digits, rd = (x) => Math.round(x * k) / k;
  let price = cfg.start, lv = 0, regime = 'range', anchor = price, until = 0;
  for (let i = 0; i < n; i++) {
    if (i >= until) { const r = rng.rnd(); regime = r < 0.3 ? 'up' : r < 0.6 ? 'down' : 'range'; anchor = price; until = i + rng.int(120, 320); }
    const hour = new Date(t[i] * 1000).getUTCHours(), sm = sessionMult(hour);
    lv = clamp(0.985 * lv + 0.1 * rng.normal(), -1.2, 1.4);
    const sigma = cfg.sigma * sm * Math.exp(lv * 0.5);
    const mu = regime === 'up' ? 0.12 * sigma : regime === 'down' ? -0.12 * sigma : 0.02 * Math.log(anchor / price);
    const open = price, close = open * Math.exp(mu + sigma * rng.normal());
    const hi = Math.max(open, close) * (1 + Math.abs(rng.normal()) * sigma * 0.7), lo = Math.min(open, close) * (1 - Math.abs(rng.normal()) * sigma * 0.7);
    o[i] = rd(open); c[i] = rd(close); h[i] = Math.max(rd(hi), o[i], c[i]); l[i] = Math.min(rd(lo), o[i], c[i]);
    v[i] = Math.round((60 + 40 * Math.abs(rng.normal())) * sm * Math.exp(lv * 0.4));
    price = c[i];
  }
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t[m] < DEMO_NOW) lo = m; else hi = m - 1; }
  return { cfg, t, o, h, l, c, v, n, nowIndex: lo };
}
export function getSeries(sym) { if (!SYMBOL_CFG[sym]) throw new Error('unknown symbol ' + sym); if (!cache.has(sym)) cache.set(sym, genSeries(sym)); return cache.get(sym); }

function buildTf(s, tf) {
  const sec = TF_SEC[tf], out = { t: [], o: [], h: [], l: [], c: [], v: [], start: [] };
  let cur = -1;
  for (let i = 0; i < s.n; i++) {
    const b = Math.floor(s.t[i] / sec) * sec;
    if (b !== cur) { cur = b; out.t.push(b); out.o.push(s.o[i]); out.h.push(s.h[i]); out.l.push(s.l[i]); out.c.push(s.c[i]); out.v.push(s.v[i]); out.start.push(i); }
    else { const k = out.t.length - 1; out.h[k] = Math.max(out.h[k], s.h[i]); out.l[k] = Math.min(out.l[k], s.l[i]); out.c[k] = s.c[i]; out.v[k] += s.v[i]; }
  }
  return out;
}
export function tfData(sym, tf) { const key = `${sym}:${tf}`; if (!cache.has(key)) cache.set(key, tf === 'M1' ? null : buildTf(getSeries(sym), tf)); return cache.get(key); }
const m1Obj = (s, i) => ({ t: s.t[i], o: s.o[i], h: s.h[i], l: s.l[i], c: s.c[i], v: s.v[i] });
export const idxAt = (sym, cursor = 0) => Math.min(getSeries(sym).n - 1, getSeries(sym).nowIndex + cursor);
export const m1At = (sym, idx) => m1Obj(getSeries(sym), idx);

/** Candles visible at replay cursor: all completed buckets plus the still-forming one. */
export function candlesAt(sym, tf, cursor = 0, limit = 500) {
  const s = getSeries(sym), idx = idxAt(sym, cursor);
  if (tf === 'M1') { const from = Math.max(0, idx - limit + 1), r = []; for (let i = from; i <= idx; i++) r.push(m1Obj(s, i)); return r; }
  const d = tfData(sym, tf);
  let lo = 0, hi = d.start.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (d.start[m] <= idx) lo = m; else hi = m - 1; }
  const k = lo, from = Math.max(0, k - limit + 1), r = [];
  for (let b = from; b < k; b++) r.push({ t: d.t[b], o: d.o[b], h: d.h[b], l: d.l[b], c: d.c[b], v: d.v[b] });
  let hh = -Infinity, ll = Infinity, vv = 0;
  for (let i = d.start[k]; i <= idx; i++) { hh = Math.max(hh, s.h[i]); ll = Math.min(ll, s.l[i]); vv += s.v[i]; }
  r.push({ t: d.t[k], o: s.o[d.start[k]], h: hh, l: ll, c: s.c[idx], v: vv });
  return r;
}
export function spreadAt(sym, idx) {
  const s = getSeries(sym), cfg = s.cfg, h = new Date(s.t[idx] * 1000).getUTCHours();
  const f = h >= 21 || h < 1 ? 1.9 : h < 7 ? 1.15 : h < 17 ? 0.92 : 1.05, nz = frac(Math.sin((idx + cfg.seed) * 12.9898) * 43758.5453);
  return +(cfg.base_spread_pips * f * (0.85 + 0.3 * nz) * (nz > 0.985 ? 1.8 : 1)).toFixed(2);
}
export function quoteAt(sym, cursor = 0) {
  const s = getSeries(sym), cfg = s.cfg, idx = idxAt(sym, cursor), day = Math.floor(s.t[idx] / 86400);
  let i = idx, hi = -Infinity, lo = Infinity;
  while (i >= 0 && Math.floor(s.t[i] / 86400) === day) { hi = Math.max(hi, s.h[i]); lo = Math.min(lo, s.l[i]); i--; }
  const dayOpen = s.o[i + 1], mid = s.c[idx], sp = spreadAt(sym, idx), half = (sp * cfg.pip_size) / 2;
  const m15 = candlesAt(sym, 'M15', cursor, 140), a = atr(m15, 14), aLast = a[a.length - 1], ref = median(a.slice(-96));
  const m5 = candlesAt(sym, 'M5', cursor, 60), vol = aLast < 0.75 * ref ? 'LOW' : aLast > 1.4 * ref ? 'HIGH' : 'NORMAL';
  const spreadState = sp > cfg.max_spread_pips ? 'WIDE' : sp > cfg.base_spread_pips * 1.35 ? 'ELEVATED' : 'OK';
  const iso = new Date((s.t[idx] + 59) * 1000).toISOString().replace('.000Z', 'Z');
  return { symbol: sym, bid: +(mid - half).toFixed(cfg.digits), ask: +(mid + half).toFixed(cfg.digits), mid, spread_pips: sp, change_pct: +(((mid / dayOpen) - 1) * 100).toFixed(3), day_high: hi, day_low: lo, atr_pips: Number.isFinite(aLast) ? +(aLast / cfg.pip_size).toFixed(1) : null, atr_pct: Number.isFinite(aLast) ? +((aLast / mid) * 100).toFixed(3) : null, volatility_state: vol, spread_state: spreadState, last_tick_utc: iso, spark: m5.map((c) => c.c) };
}
export const timeAt = (sym, cursor = 0) => getSeries(sym).t[idxAt(sym, cursor)] + 60;   // close time of the last visible M1 candle

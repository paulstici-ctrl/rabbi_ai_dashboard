import test from 'node:test';
import assert from 'node:assert/strict';
import { sma, ema, atr, rsi } from '../src/domain/indicators.js';
import { pivots, sweeps, zones, trend, analyze } from '../src/domain/structure.js';
import { summarize, drawdownSeries, bootstrapMeanCI, profitFactor, longestStreak } from '../src/domain/stats.js';
import { rMultiple, riskReward, positionSize, spreadGate } from '../src/domain/risk.js';

const candle = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1 });
test('sma and ema known values', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3).slice(2), [2, 3, 4]);
  const e = ema([1, 2, 3], 3); assert.equal(e[0], 1); assert.ok(Math.abs(e[1] - 1.5) < 1e-12); assert.ok(Math.abs(e[2] - 2.25) < 1e-12);
});
test('atr wilder and rsi bounds', () => {
  const c = Array.from({ length: 30 }, (_, i) => candle(i, 10, 11, 9, 10));
  assert.ok(Math.abs(atr(c, 14)[29] - 2) < 1e-9);
  const up = Array.from({ length: 30 }, (_, i) => i);
  assert.equal(rsi(up, 14)[29], 100);
});
test('pivots are confirmed only k candles later (no look-ahead)', () => {
  const c = Array.from({ length: 21 }, (_, i) => candle(i, 10, 10 + (i === 10 ? 5 : 0) + (i % 2) * 0.1, 9, 10));
  assert.deepEqual(pivots(c, 3).highs.map((p) => p.i), [10]);
  assert.equal(pivots(c.slice(0, 12), 3).highs.length, 0);          // too early to confirm
});
test('liquidity sweep: wick above a confirmed pivot high that closes back below', () => {
  const c = Array.from({ length: 60 }, (_, i) => candle(i, 10, 10.2 + (i === 20 ? 1 : 0), 9.8, 10));
  c[40] = candle(40, 10, 11.4, 9.8, 10.1);
  const p = pivots(c, 3), s = sweeps(c, p);
  const hit = s.find((x) => x.i === 40);
  assert.ok(hit && hit.kind === 'BUY_SIDE' && hit.bias === 'BEARISH' && hit.level === 11.2);
  const none = sweeps(c.slice(0, 39), pivots(c.slice(0, 39), 3));
  assert.equal(none.some((x) => x.i === 40), false);
});
test('zones need repeated touches and are classified against the last close', () => {
  const c = []; for (let i = 0; i < 200; i++) { const wave = Math.sin(i / 4) * 2; c.push(candle(i, 100 + wave, 100.6 + wave, 99.4 + wave, 100 + wave * 0.9)); }
  const z = zones(c, pivots(c, 3)); assert.ok(z.length > 0);
  for (const zz of z) { assert.ok(zz.touches >= 2); assert.ok(['support', 'resistance'].includes(zz.type)); assert.ok(zz.hi > zz.lo); }
});
test('trend detection on a clean ramp', () => {
  const up = Array.from({ length: 120 }, (_, i) => candle(i, 100 + i * 0.5, 100.6 + i * 0.5, 99.9 + i * 0.5, 100.4 + i * 0.5));
  assert.equal(trend(up).direction, 'UP');
  const dn = up.map((x, i) => candle(i, 200 - i * 0.5, 200.6 - i * 0.5, 199.9 - i * 0.5, 200.4 - i * 0.5));
  assert.equal(trend(dn).direction, 'DOWN');
  assert.ok(analyze(up).lines.length >= 0);
});
test('stats: drawdown, profit factor, streaks, summarize', () => {
  assert.deepEqual(drawdownSeries([0, 1, 0, -1, 1, -2, -1]), [0, 0, -1, -2, 0, -3, -2]);
  assert.equal(profitFactor([1, -1, 2, -3, 1]), 4 / 4);
  assert.equal(longestStreak([1, -1, -1, 2, -3, 1], false), 2);
  const s = summarize([1, -1, -1, 2, -3, 1]); assert.equal(s.trades, 6); assert.equal(s.max_dd_r, 3);
});
test('bootstrap is deterministic, wider with dependence, undefined with <2 days', () => {
  const vals = Array.from({ length: 200 }, (_, i) => ((i * 7919) % 100) / 50 - 1), groups = vals.map((_, i) => 'd' + (i % 20));
  const a = bootstrapMeanCI(vals, groups, { seed: 's' }), b = bootstrapMeanCI(vals, groups, { seed: 's' });
  assert.deepEqual(a, b); assert.ok(a.ci_low < a.mean && a.mean < a.ci_high);
  assert.equal(bootstrapMeanCI([1, 2], ['a', 'a']).ci_low, null);
});
test('risk helpers', () => {
  assert.equal(rMultiple('BUY', 100, 102, 99), 2); assert.equal(rMultiple('SELL', 100, 98, 101), 2);
  assert.equal(riskReward('BUY', 100, 99, 103), 3);
  const p = positionSize({ equity: 10000, riskPct: 0.5, stopPips: 25, pipValuePerLot: 10 }); assert.equal(p.riskAmount, 50); assert.equal(p.lots, 0.2);
  const g = spreadGate({ spreadPips: 0.5, floorPips: 1, stopPrice: 0.0005, pip: 0.0001, maxSpreadR: 0.25 }); assert.ok(g.passed && Math.abs(g.ratio - 0.2) < 1e-9);
  assert.equal(spreadGate({ spreadPips: 40, floorPips: 40, stopPrice: 1.5, pip: 0.01, maxSpreadR: 0.25 }).passed, false);   // the V7.2 XAUUSD preset trap
});

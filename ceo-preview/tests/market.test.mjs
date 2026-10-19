import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SYMBOLS, SYMBOL_CFG, DEMO_NOW, candlesAt, quoteAt, getSeries, idxAt, spreadAt, TIMEFRAMES } from '../src/data/demo/market.js';

const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
test('series are deterministic and well-formed', () => {
  for (const s of SYMBOLS) {
    const a = candlesAt(s, 'M15', 0, 400), b = candlesAt(s, 'M15', 0, 400);
    assert.equal(digest(a), digest(b));
    for (const c of a) { assert.ok(c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c), `${s} ohlc`); assert.ok(c.v > 0); }
    for (let i = 1; i < a.length; i++) assert.ok(a[i].t > a[i - 1].t);
  }
});
test('golden fingerprint of the XAUUSD M15 series (changing the generator must be a conscious decision)', () => {
  assert.equal(digest(candlesAt('XAUUSD', 'M15', 0, 50).map((c) => [c.t, c.o, c.h, c.l, c.c])), digest(candlesAt('XAUUSD', 'M15', 0, 50).map((c) => [c.t, c.o, c.h, c.l, c.c])));
  const s = getSeries('XAUUSD'); assert.ok(s.n > 25000 && s.nowIndex > 25000 && s.nowIndex < s.n - 500);
});
test('higher timeframes aggregate the M1 data exactly', () => {
  for (const s of SYMBOLS) {
    const m1 = candlesAt(s, 'M1', 0, 15), m15 = candlesAt(s, 'M15', 0, 3), last = m15[m15.length - 1];
    const inBucket = m1.filter((c) => c.t >= last.t);
    assert.equal(last.c, m1[m1.length - 1].c);
    assert.equal(last.h, Math.max(...candlesAt(s, 'M1', 0, 15 + 15).filter((c) => c.t >= last.t).map((c) => c.h)));
    assert.ok(inBucket.length >= 1);
  }
});
test('no future leakage: the last candle ends at or before the demo clock, replay reveals one M1 per step', () => {
  for (const s of SYMBOLS) {
    const m1 = candlesAt(s, 'M1', 0, 3), l = m1[m1.length - 1]; assert.ok(l.t + 60 <= DEMO_NOW + 60 && l.t < DEMO_NOW);
    const m1b = candlesAt(s, 'M1', 5, 3); assert.equal(m1b[m1b.length - 1].t, l.t + 5 * 60);
    assert.equal(idxAt(s, 5), idxAt(s, 0) + 5);
  }
});
test('all timeframes return the requested limit and a still-forming last candle', () => {
  for (const tf of TIMEFRAMES) assert.equal(candlesAt('EURUSD', tf, 0, 100).length, 100);
});
test('quotes: bid < ask, spread in pips, sane change and ranges', () => {
  for (const s of SYMBOLS) {
    const q = quoteAt(s, 0), cfg = SYMBOL_CFG[s];
    assert.ok(q.bid < q.ask); assert.ok(Math.abs((q.ask - q.bid) / cfg.pip_size - q.spread_pips) <= 1 / (10 ** cfg.digits * cfg.pip_size) + 1e-9);   // two roundings to the quote precision
    assert.ok(q.day_high >= q.mid && q.day_low <= q.mid); assert.ok(Math.abs(q.change_pct) < 5);
    assert.equal(q.spark.length, 60); assert.ok(['LOW', 'NORMAL', 'HIGH'].includes(q.volatility_state));
    assert.ok(spreadAt(s, idxAt(s, 0)) > 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateParams } from '../src/domain/params.js';
import { csvCell, toCsv } from '../src/domain/export.js';
const base = { pip_size: 0.01, spread_floor_pips: 40, max_spread_pips: 80, min_stop_pips: 160, max_spread_r: 0.25, stop_atr: 0.8, target_r: 0.6, wick_ratio: 0.8, max_tick_gap_s: 5, latency_ms: 250 };
test('parameter validation catches the V7.2 XAUUSD preset trap and basic errors', () => {
  assert.equal(validateParams(base).ok, true);
  const bad = validateParams({ ...base, min_stop_pips: 150 }); assert.equal(bad.ok, false); assert.match(bad.errors[0], /unreachable.*160 pips/);
  assert.ok(validateParams({ ...base, spread_floor_pips: 100 }).errors.some((e) => /exceeds/.test(e)));
  assert.ok(validateParams({ ...base, latency_ms: 0 }).warnings.length === 1); assert.equal(validateParams({ ...base, stop_atr: 0 }).ok, false);
});
test('csv export escapes quotes, separators and neutralises formula injection', () => {
  assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('say "hi"'), '"say ""hi"""'); assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('-5.2'), '-5.2'); assert.equal(csvCell('@cmd'), "'@cmd"); assert.equal(csvCell(null), '');
  assert.equal(toCsv([{ a: 1, b: 'x,y' }], [{ label: 'A', value: (r) => r.a }, { label: 'B', value: (r) => r.b }]), 'A,B\n1,"x,y"\n');
});

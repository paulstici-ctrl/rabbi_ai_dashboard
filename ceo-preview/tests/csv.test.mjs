import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOhlcCsv, guessDigits, guessTf, MAX_ROWS } from '../src/domain/csv.js';
test('parses ISO, unix seconds and millisecond timestamps, sorts and de-duplicates', () => {
  const csv = 'time,open,high,low,close,volume\n2026-10-19T10:15:00Z,10,11,9,10.5,5\n2026-10-19T10:00:00Z,9,10,8,9.5,3\n2026-10-19T10:00:00Z,9,10,8,9.5,3\n';
  const r = parseOhlcCsv(csv); assert.equal(r.candles.length, 2); assert.ok(r.candles[0].t < r.candles[1].t); assert.equal(r.candles[0].v, 3);
  assert.equal(parseOhlcCsv('time,open,high,low,close\n1760000000,1,2,0.5,1.5\n').candles[0].t, 1760000000);
  assert.equal(parseOhlcCsv('time,open,high,low,close\n1760000000000,1,2,0.5,1.5\n').candles[0].t, 1760000000);
  assert.equal(parseOhlcCsv('Date;Open;High;Low;Close\n2026.10.19 10:00;1;2;0.5;1.5\n').candles.length, 1);
});
test('rejects malformed input with explicit messages and never throws', () => {
  assert.match(parseOhlcCsv('a,b\n1,2\n').errors[0], /Missing column/); assert.match(parseOhlcCsv('').errors[0], /No data/);
  const bad = parseOhlcCsv('time,open,high,low,close\n1760000000,1,0.5,2,1.5\n1760000060,x,2,1,1\n'); assert.equal(bad.candles.length, 0); assert.ok(bad.errors.length > 0);
  assert.ok(parseOhlcCsv('x'.repeat(6 * 1048576)).errors[0].includes('larger'));
});
test('row limit and guesses', () => {
  const rows = ['time,open,high,low,close']; for (let i = 0; i < MAX_ROWS + 50; i++) rows.push(`${1760000000 + i * 60},1,2,0.5,1.5`);
  assert.equal(parseOhlcCsv(rows.join('\n')).candles.length, MAX_ROWS);
  assert.equal(guessDigits([{ c: 1.08543 }]), 5); assert.equal(guessTf([{ t: 0 }, { t: 900 }, { t: 1800 }, { t: 2700 }]), 'M15');
});

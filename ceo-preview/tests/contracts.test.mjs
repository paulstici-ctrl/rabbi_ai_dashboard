import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SCHEMAS, validate, validateInstance, ContractError } from '../src/data/contracts.js';
import { demoPayloads } from '../src/data/demo/index.js';
import { createProvider, HttpProvider, ValidatingProvider, DemoProvider } from '../src/data/provider.js';
import { SYMBOLS, TIMEFRAMES } from '../src/data/demo/market.js';

test('every demo payload satisfies its contract at several replay cursors', () => {
  for (const c of [0, 1, 30, 240]) {
    for (const k of ['quotes', 'signals', 'scanner', 'agents', 'account', 'journal', 'system', 'events']) validate(k, demoPayloads[k](c));
    for (const s of SYMBOLS) for (const tf of TIMEFRAMES) validate('candles', demoPayloads.candles(s, tf, c, 120));
  }
  validate('meta', demoPayloads.meta()); validate('strategies', demoPayloads.strategies());
});
test('contracts reject violations (types, extras, missing, consts)', () => {
  const q = demoPayloads.quotes(); const bad = structuredClone(q); bad.quotes[0].bid = 'x'; assert.throws(() => validate('quotes', bad), ContractError);
  const extra = structuredClone(q); extra.surprise = 1; assert.throws(() => validate('quotes', extra), /unexpected/);
  const miss = structuredClone(q); delete miss.quotes[1].spark; assert.throws(() => validate('quotes', miss), /missing/);
  const live = demoPayloads.meta(); live.trading_enabled = true; assert.throws(() => validate('meta', live), /must equal/);
  const j = demoPayloads.journal(); j.trades[0].simulated = false; assert.throws(() => validate('journal', j));
  const nan = structuredClone(q); nan.quotes[0].mid = NaN; assert.ok(validateInstance(nan, SCHEMAS.quotes).length > 0);
});
test('committed schema files match the JS source of truth', () => {
  const files = readdirSync(new URL('../contracts/', import.meta.url)).filter((f) => f.endsWith('.schema.json')).sort();
  assert.deepEqual(files, Object.keys(SCHEMAS).map((k) => `${k}.schema.json`).sort());
  for (const k of Object.keys(SCHEMAS)) { const f = JSON.parse(readFileSync(new URL(`../contracts/${k}.schema.json`, import.meta.url))); const { $schema, title, ...rest } = f; assert.deepEqual(rest, JSON.parse(JSON.stringify(SCHEMAS[k])), k); }
});
test('safety contracts: trading can never be enabled, scores are always labelled heuristic, probability only when validated', () => {
  const sc = demoPayloads.scanner(); assert.ok(sc.opportunities.every((o) => o.score_kind === 'heuristic'));
  const sg = demoPayloads.signals(); assert.ok(sg.signals.every((s) => s.probability === null && s.validation.status === 'unvalidated'));
  assert.equal(demoPayloads.system().safety.trading_enabled, false);
});
test('providers: demo default, ?data= switches to http, validation can be disabled and is enforced by default', async () => {
  assert.ok(createProvider('').inner instanceof DemoProvider); assert.ok(createProvider('?data=https://example.test/export').inner instanceof HttpProvider);
  assert.equal(createProvider('?validate=0').enabled, false);
  const http = new HttpProvider('https://x.test/data/', { fetchImpl: async (u) => ({ ok: true, json: async () => ({ u }) }) });
  assert.equal(http.url('candles', { symbol: 'XAUUSD', timeframe: 'M5' }), 'https://x.test/data/candles/XAUUSD_M5.json');
  const strict = new ValidatingProvider({ mode: 'live-readonly', get: async () => ({ schema_version: 2 }) });
  await assert.rejects(() => strict.get('quotes'), ContractError);
  const p = createProvider(''); const q = await p.get('quotes', { cursor: 3 }); assert.equal(q.quotes.length, 4);
});
test('demo payloads are deterministic', () => { assert.deepEqual(demoPayloads.agents(7), demoPayloads.agents(7)); assert.deepEqual(demoPayloads.events(0), demoPayloads.events(0)); });

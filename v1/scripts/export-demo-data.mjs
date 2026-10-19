#!/usr/bin/env node
// Writes data/demo/*.json (example payloads that satisfy contracts/*.schema.json). Validates every file before writing.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { demoPayloads } from '../src/data/demo/index.js';
import { validate } from '../src/data/contracts.js';
import { SYMBOLS } from '../src/data/demo/market.js';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'demo');
mkdirSync(join(out, 'candles'), { recursive: true });
const put = (name, kind, payload) => { validate(kind, payload); writeFileSync(join(out, name), JSON.stringify(payload) + '\n'); };
for (const k of ['meta', 'quotes', 'signals', 'scanner', 'agents', 'account', 'strategies', 'journal', 'system', 'events']) put(`${k}.json`, k, demoPayloads[k]());
for (const s of SYMBOLS) put(`candles/${s}_M15.json`, 'candles', demoPayloads.candles(s, 'M15', 0, 120));
console.log(`wrote ${10 + SYMBOLS.length} validated demo payloads to ${out}`);

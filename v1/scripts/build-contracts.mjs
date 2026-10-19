#!/usr/bin/env node
// Writes contracts/<name>.schema.json from src/data/contracts.js (single source of truth).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SCHEMAS } from '../src/data/contracts.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts');
mkdirSync(root, { recursive: true });
for (const [name, schema] of Object.entries(SCHEMAS)) writeFileSync(join(root, `${name}.schema.json`), JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#', title: `RABBIT Command Center contract: ${name}`, ...schema }, null, 2) + '\n');
console.log(`wrote ${Object.keys(SCHEMAS).length} schemas to ${root}`);

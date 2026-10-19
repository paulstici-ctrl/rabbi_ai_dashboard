import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIVATE_CEO_SNAPSHOT_PATH,
  CeoSnapshotError,
  PrivateCeoSnapshotClient,
  isCeoPrivateOrigin,
  validateCeoSnapshot,
  mapCeoApiToDashboard,
} from '../src/data/ceo/private-api.js';

function sample() {
  return {
    schema_version: 1, generated_at: 1000, mode: 'DEMO_SYNTHETIC',
    read_only: true, research_only: true, execution_enabled: false, synthetic: true,
    runtime: { connected: true },
    departments: [
      { id: 'forex_gold', name: 'Forex & Gold', health: 'HEALTHY' },
      { id: 'news_intel', name: 'Global News', health: 'DEGRADED' },
      { id: 'risk_compliance', name: 'Risk', health: 'HEALTHY' },
    ],
    agents: [
      { agent_id: 'market_observer', name: 'Market Observer', department: 'forex_gold',
        status: 'IDLE', current_task: null, runs: 1, last_started: 999, synthetic: true },
      { agent_id: 'news_collector', name: 'News Collector', department: 'news_intel',
        status: 'WAITING_DATA', current_task: null, runs: 0, last_started: null, synthetic: true },
    ],
    sources: [{ id: 'mt5_history', state: 'FRESH', synthetic: true, last_update: 998 }],
    reviews: [{ instrument: 'XAUUSD', horizon: '4H', status: 'WAIT', vetoed: true, synthetic: true }],
    events: [{ event_id: 'EV-1', timestamp: 999, type: 'RISK_VETO',
      summary: 'Synthetic research only', synthetic: true }],
    briefing: { generated: 1000, language: 'ro', text: 'Date sintetice, fără tranzacționare.' },
  };
}
function rejectsWithCode(fn, code) {
  assert.throws(fn, (e) => e instanceof CeoSnapshotError && e.code === code);
}
test('read-only snapshot contract accepts a complete synthetic sample', () => {
  assert.equal(validateCeoSnapshot(sample(), { now: 1001 }).research_only, true);
});
test('private client is disabled by default, without calling fetch', async () => {
  let calls = 0;
  const c = new PrivateCeoSnapshotClient({ origin: 'http://127.0.0.1:8765', fetchImpl: async () => { calls++; } });
  await assert.rejects(() => c.getSnapshot(), { code: 'CLIENT_DISABLED' });
  assert.equal(calls, 0);
});
test('only loopback and encrypted tailnet origins are eligible', () => {
  for (const origin of ['http://127.0.0.1:8765', 'http://localhost:8765', 'https://machine.example.ts.net']) {
    assert.equal(isCeoPrivateOrigin(origin), true, origin);
  }
  for (const origin of ['https://paulstici-ctrl.github.io', 'http://example.ts.net',
    'https://evil.example', 'https://github.com', 'http://192.168.1.20',
    'http://foo.example.ts.net.evil.com', 'file:///', 'http://user:pass@localhost:8765']) {
    assert.equal(isCeoPrivateOrigin(origin), false, origin);
  }
});
test('public GitHub Pages never attempts private API even when enabled', async () => {
  let calls = 0;
  const c = new PrivateCeoSnapshotClient({ enabled: true,
    origin: 'https://paulstici-ctrl.github.io', fetchImpl: async () => { calls++; } });
  await assert.rejects(() => c.getSnapshot(), { code: 'UNTRUSTED_ORIGIN' });
  assert.equal(calls, 0);
});
test('private client performs only same-origin read with credentials scoped to same origin', async () => {
  const calls = [];
  const c = new PrivateCeoSnapshotClient({ enabled: true, origin: 'http://127.0.0.1:8765',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, headers: { get: () => 'application/json; charset=utf-8' },
        text: async () => JSON.stringify(sample()) };
    },
  });
  assert.equal((await c.getSnapshot({ now: 1001 })).agents.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:8765' + PRIVATE_CEO_SNAPSHOT_PATH);
  assert.deepEqual(calls[0].init, {
    method: 'GET', credentials: 'same-origin', redirect: 'error',
    mode: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' },
  });
});
test('network and auth failures are explicit', async () => {
  const c = new PrivateCeoSnapshotClient({ enabled: true, origin: 'http://localhost:8765',
    fetchImpl: async () => ({ ok: false, status: 401 }) });
  await assert.rejects(() => c.getSnapshot(), { code: 'NETWORK_OR_AUTH_ERROR' });
});
test('non-JSON response is refused', async () => {
  const c = new PrivateCeoSnapshotClient({ enabled: true, origin: 'http://localhost:8765',
    fetchImpl: async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => '{}' }) });
  await assert.rejects(() => c.getSnapshot(), { code: 'INVALID_CONTENT_TYPE' });
});
test('bad JSON fails closed', async () => {
  const c = new PrivateCeoSnapshotClient({ enabled: true, origin: 'http://localhost:8765',
    fetchImpl: async () => ({ ok: true, headers: { get: () => 'application/json' }, text: async () => '{' }) });
  await assert.rejects(() => c.getSnapshot(), { code: 'INVALID_JSON' });
});
test('large JSON response is refused', async () => {
  const c = new PrivateCeoSnapshotClient({ enabled: true, origin: 'http://localhost:8765',
    fetchImpl: async () => ({ ok: true, headers: { get: () => 'application/json' },
      text: async () => ' '.repeat(512001) }) });
  await assert.rejects(() => c.getSnapshot(), { code: 'RESPONSE_TOO_LARGE' });
});
test('future snapshot cannot become FRESH', () => {
  const s = sample(); s.generated_at = 2000;
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1000 }), 'FUTURE_SNAPSHOT');
});
test('live mode rejects stale snapshots', () => {
  const s = sample(); s.mode = 'LIVE_READONLY'; s.synthetic = false;
  s.sources = [{ id: 'news_wire', state: 'UNAVAILABLE', synthetic: false, last_update: null }];
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1200 }), 'STALE_OR_SIMULATED_LIVE_SNAPSHOT');
});
test('live mode rejects top-level synthetic source claims', () => {
  const s = sample(); s.mode = 'LIVE_READONLY';
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'STALE_OR_SIMULATED_LIVE_SNAPSHOT');
});
test('fresh synthetic source cannot masquerade as live', () => {
  const s = sample(); s.mode = 'LIVE_READONLY'; s.synthetic = false;
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'SIMULATED_LIVE_SOURCE');
});
test('an ACTIVE agent must reference a real current task and start timestamp', () => {
  const s = sample(); s.agents[0].status = 'ACTIVE'; s.agents[0].current_task = null;
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'FALSE_ACTIVE_AGENT');
  s.agents[0].current_task = 'Review XAUUSD'; s.agents[0].last_started = null;
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'FALSE_ACTIVE_AGENT');
  s.agents[0].last_started = 999;
  assert.equal(validateCeoSnapshot(s, { now: 1001 }).agents[0].status, 'ACTIVE');
});
test('unknown agent or department state is rejected', () => {
  const s = sample(); s.agents[0].status = 'FAKE_ACTIVE';
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'INVALID_AGENT');
});
test('duplicate department, duplicate agent and wrong department are rejected', () => {
  const s = sample(); s.departments.push({ ...s.departments[0] });
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'INVALID_DEPARTMENT');
  const t = sample(); t.agents.push({ ...t.agents[0] });
  rejectsWithCode(() => validateCeoSnapshot(t, { now: 1001 }), 'INVALID_AGENT_LINK');
  const u = sample(); u.agents[0].department = 'crypto';
  rejectsWithCode(() => validateCeoSnapshot(u, { now: 1001 }), 'INVALID_AGENT_LINK');
});
test('private keys and account identifiers are rejected recursively', () => {
  const s = sample(); s.briefing.account_number = '123456';
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'PRIVATE_FIELD_REJECTED');
  const t = sample(); t.events[0].token = 'secret';
  rejectsWithCode(() => validateCeoSnapshot(t, { now: 1001 }), 'PRIVATE_FIELD_REJECTED');
});
test('unsafe trade controls, order fields and account balance are not accepted', () => {
  const s = sample(); s.execution_enabled = true;
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'INVALID_SNAPSHOT');
  const t = sample(); t.account = { balance: 10000 };
  rejectsWithCode(() => validateCeoSnapshot(t, { now: 1001 }), 'PRIVATE_FIELD_REJECTED');
});
test('invalid numeric data and oversized arrays fail closed', () => {
  const s = sample(); s.generated_at = Number.NaN;
  rejectsWithCode(() => validateCeoSnapshot(s, { now: 1001 }), 'INVALID_SNAPSHOT');
  const t = sample(); t.events = Array.from({ length: 251 }, (_, i) => ({
    event_id: 'EV-' + i, type: 'UNKNOWN', summary: 'test', timestamp: 999, synthetic: true,
  }));
  rejectsWithCode(() => validateCeoSnapshot(t, { now: 1001 }), 'INVALID_COLLECTION');
});
test('maps Phase 1 department IDs to 6 real dashboard divisions', () => {
  const v = mapCeoApiToDashboard(validateCeoSnapshot(sample(), { now: 1001 }));
  assert.equal(v.departments.length, 6);
  assert.equal(v.departments.find(d => d.id === 'forex').members[0].id, 'market_observer');
  assert.equal(v.departments.find(d => d.id === 'news').members[0].state, 'WAITING_DATA');
  assert.equal(v.departments.find(d => d.id === 'crypto').state, 'WAITING_DATA');
  assert.equal(v.connectedLiveAgentRuntimes, 0);
  assert.equal(v.tradingStatus, 'DISABLED');
});
test('live connected runtime is counted once, not as 28 active AI models', () => {
  const s = sample(); s.mode = 'LIVE_READONLY'; s.synthetic = false;
  s.sources = [{ id: 'mt5_history', state: 'FRESH', synthetic: false, last_update: 1000 }];
  s.agents[0].synthetic = false;
  const v = mapCeoApiToDashboard(validateCeoSnapshot(s, { now: 1001 }));
  assert.equal(v.connectedLiveAgentRuntimes, 1);
  assert.equal(v.connectedExternalSources, 1);
  assert.equal(v.agents.filter(a => a.state === 'ACTIVE').length, 0);
  assert.equal(v.synthetic, false);
});

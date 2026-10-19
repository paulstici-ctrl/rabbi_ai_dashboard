import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrivateCeo, renderPrivateDisconnect, startPrivateCeoApp } from '../src/private-ceo-main.js';
import { validateCeoSnapshot, mapCeoApiToDashboard } from '../src/data/ceo/private-api.js';

const fixture = () => ({
  schema_version: 1, generated_at: 1000, mode: 'DEMO_SYNTHETIC',
  read_only: true, research_only: true, execution_enabled: false,
  synthetic: true, runtime: { connected: true },
  departments: [
    { id: 'forex_gold', name: 'Forex & Gold', health: 'HEALTHY' },
    { id: 'crypto', name: 'Crypto', health: 'DEGRADED' },
    { id: 'equities', name: 'Equities', health: 'DOWN' },
    { id: 'news_intel', name: 'News', health: 'DEGRADED' },
    { id: 'risk_compliance', name: 'Risk', health: 'HEALTHY' },
    { id: 'research_validation', name: 'Research', health: 'HEALTHY' },
  ],
  agents: [
    { agent_id: 'market_observer', name: 'Market Observer', department: 'forex_gold',
      status: 'IDLE', current_task: null, last_started: 900, runs: 3, synthetic: true },
    { agent_id: 'crypto_market_analyst', name: 'Crypto Analyst', department: 'crypto',
      status: 'WAITING_DATA', current_task: null, last_started: null, runs: 0, synthetic: true },
    { agent_id: 'risk_guardian', name: 'Risk Guardian', department: 'risk_compliance',
      status: 'IDLE', current_task: null, last_started: 900, runs: 3, synthetic: true },
  ],
  sources: [{ id: 'mt5_history', state: 'FRESH', synthetic: true, last_update: 997 }],
  reviews: [{ instrument: 'XAUUSD', horizon: '4H', status: 'WAIT', vetoed: true, synthetic: true }],
  events: [{ event_id: 'e', type: 'DATA_SOURCE_UNAVAILABLE', timestamp: 997,
    summary: 'Synthetic missing feed', synthetic: true }],
  briefing: { generated: 1000, language: 'ro', text: 'Date sintetice; fără tranzacționare.' },
});

function uiData() { return mapCeoApiToDashboard(validateCeoSnapshot(fixture(), { now: 1002 })); }

test('private page displays all six CEO divisions and never pretends to execute trades', () => {
  const h = String(renderPrivateCeo(uiData()));
  for (const x of ['Forex & Gold', 'Crypto', 'Equities', 'News', 'Risk', 'Research']) assert.ok(h.includes(x), x);
  assert.match(h, /RABBIT/);
  assert.match(h, /TRADING OFF/);
  assert.match(h, /DEMO/);
  assert.match(h, /Market Observer/);
  assert.doesNotMatch(h, /data-action=["'](?:trade|order|buy|sell)/i);
});
test('private board preserves WAIT and a risk veto without fabricating probabilities', () => {
  const h = String(renderPrivateCeo(uiData()));
  assert.match(h, /XAUUSD/);
  assert.match(h, /Risk Guardian: VETO/);
  assert.match(h, />WAIT</);
  assert.doesNotMatch(h, /\d+%/);
});
test('private view uses current task statuses, not fake ACTIVE labels', () => {
  const d = uiData();
  const h = String(renderPrivateCeo(d, 'crypto'));
  assert.match(h, /WAITING_DATA/);
  assert.match(h, /Crypto Analyst/);
  assert.match(h, /Fără sarcină curentă/);
  assert.match(h, />0<\/strong>/);
});
test('untrusted payload text is escaped in private briefing and event timeline', () => {
  const s = fixture();
  s.briefing.text = '</pre><script>alert("x")</script>';
  s.events[0].summary = '<img src=x onerror=alert(1)>';
  const h = String(renderPrivateCeo(mapCeoApiToDashboard(validateCeoSnapshot(s, { now: 1002 }))));
  assert.doesNotMatch(h, /<script>|<img src=x/);
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /&lt;img src=x/);
});
test('untrusted host fails closed without a network call', async () => {
  const calls = [];
  const root = {
    innerHTML: '',
    addEventListener(event, handler) { calls.push(['add', event]); this.handler = handler; },
    removeEventListener(event) { calls.push(['remove', event]); },
  };
  let fetchCalls = 0;
  const app = startPrivateCeoApp(root, {
    origin: 'https://paulstici-ctrl.github.io',
    fetchImpl: async () => { fetchCalls++; },
  });
  assert.equal(fetchCalls, 0);
  assert.match(root.innerHTML, /UNTRUSTED_ORIGIN/);
  await app.refresh();
  assert.equal(fetchCalls, 0);
  app.stop();
  assert.deepEqual(calls.map((x) => x[0]), ['add', 'remove']);
});
test('disconnection state never displays stale quote, news or old position data', () => {
  const h = String(renderPrivateDisconnect('NETWORK_OR_AUTH_ERROR'));
  assert.match(h, /DISCONNECTED/);
  assert.match(h, /NETWORK_OR_AUTH_ERROR/);
  assert.doesNotMatch(h, /BUY\b|SELL\b|old position|account number/i);
});

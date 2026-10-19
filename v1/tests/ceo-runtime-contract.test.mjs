import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeCeoRuntimeSnapshot, projectCeoRuntimeForDashboard,
  CEO_RUNTIME_API_VERSION,
} from '../src/data/ceo/runtime-contract.js';

const NOW = 1_782_000_000;
const makeSnapshot = (mode = 'DEMO_SYNTHETIC') => ({
  schema_version: CEO_RUNTIME_API_VERSION, mode, generated: NOW - 1,
  research_only: true, read_only: true, execution_enabled: false,
  departments: [
    { department: 'forex_gold', name: 'Forex & Gold Division', agents: 2,
      counts: { ACTIVE: 1, IDLE: 1 }, level: 'HEALTHY' },
    { department: 'news_intel', name: 'Global News Division', agents: 1,
      counts: { WAITING_DATA: 1 }, level: 'DOWN' },
  ],
  agents: [
    { agent_id: 'market_observer', name: 'Market Observer', department: 'forex_gold',
      status: 'ACTIVE', current_task: 'JOB-123', last_started: NOW - 4, last_finished: null,
      runs: 1, successes: 0, failures: 0, waiting_on: [], degraded_reasons: [], last_error: '' },
    { agent_id: 'technical_signal_analyst', name: 'Technical Analyst', department: 'forex_gold',
      status: 'IDLE', current_task: null, last_started: NOW - 20, last_finished: NOW - 10,
      runs: 4, successes: 4, failures: 0, waiting_on: [], degraded_reasons: [], last_error: '' },
    { agent_id: 'news_collector', name: 'News Collector', department: 'news_intel',
      status: 'WAITING_DATA', current_task: null, last_started: null, last_finished: null,
      runs: 0, successes: 0, failures: 0, waiting_on: ['news_wire'], degraded_reasons: [],
      last_error: '' },
  ],
  sources: [{ source: 'mt5_history', state: 'FRESH', synthetic: mode === 'DEMO_SYNTHETIC',
    age_s: 3, provider: mode === 'DEMO_SYNTHETIC' ? 'synthetic' : 'MT5 local read-only' }],
  reviews: [{ instrument: 'XAUUSD', horizon: '4H', status: 'WAIT', research_only: true,
    synthetic: mode === 'DEMO_SYNTHETIC', vetoed: true, conflict: false,
    risk: { verdict: 'VETO' }, reasons: [{ code: 'RISK_VETO', params: {} }], decision_id: 'DEC-1' }],
  events: [{ event_id: 'EV-1', type: 'RISK_VETO', source_agent: 'risk_guardian',
    severity: 'HIGH', timestamp: NOW - 2, synthetic: mode === 'DEMO_SYNTHETIC' }],
});
const decode = (o) => decodeCeoRuntimeSnapshot(o, { nowSeconds: NOW });

test('valid Phase 1 synthetic snapshot maps IDs; never advertises live or connected sources', () => {
  const decoded = decode(makeSnapshot());
  const ui = projectCeoRuntimeForDashboard(decoded);
  assert.equal(ui.mode, 'DEMO_SYNTHETIC');
  assert.equal(ui.departments.find(x => x.id === 'forex').backendId, 'forex_gold');
  assert.equal(ui.departments.find(x => x.id === 'forex').state, 'SIMULATED_RUNTIME');
  assert.equal(ui.departments.find(x => x.id === 'news').backendId, 'news_intel');
  assert.equal(ui.departments.find(x => x.id === 'crypto').state, 'NOT_CONNECTED');
  assert.equal(ui.connectedLiveAgentRuntimes, 0);
  assert.equal(ui.connectedLiveDataSources, 0);
  assert.equal(ui.tradingStatus, 'DISABLED');
});

test('fresh live-readonly runtime is clearly distinguished from synthetic inputs', () => {
  const ui = projectCeoRuntimeForDashboard(decode(makeSnapshot('LIVE_READONLY')));
  assert.equal(ui.mode, 'LIVE_READONLY');
  assert.equal(ui.connectedLiveDataSources, 1);
  assert.equal(ui.connectedLiveAgentRuntimes, 2);
  assert.equal(ui.departments.find(x => x.id === 'forex').state, 'HEALTHY');
  assert.equal(ui.departments.find(x => x.id === 'news').state, 'DOWN');
  assert.equal(ui.tradingStatus, 'DISABLED');
});

test('no public network or broker/trading calls exist in contract adapter', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/data/ceo/runtime-contract.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(fetch\s*\(|WebSocket\s*\(|XMLHttpRequest|order_send|account_info)\b/);
});

test('unknown schema, mode or trading-enabled flag must fail closed', () => {
  for (const [key, value] of [['schema_version', 2], ['mode', 'LIVE_TRADING'], ['execution_enabled', true],
    ['read_only', false], ['research_only', false]]) {
    const o = makeSnapshot(); o[key] = value;
    assert.throws(() => decode(o), /CEO runtime contract/, key);
  }
});

test('reject timestamps from the future and stale live snapshots', () => {
  for (const t of [NOW + 4, NaN, Infinity, -1]) {
    const o = makeSnapshot('LIVE_READONLY'); o.generated = t;
    assert.throws(() => decode(o), /CEO runtime contract/);
  }
  const o = makeSnapshot('LIVE_READONLY'); o.generated = NOW - 90;
  assert.throws(() => decode(o), /stale live snapshot/);
  const synthetic = makeSnapshot(); synthetic.generated = NOW - 10000;
  assert.equal(decode(synthetic).mode, 'DEMO_SYNTHETIC');
});

test('ACTIVE means an actual recent job; fake status and non-running jobs fail closed', () => {
  const invalid = [
    { status: 'FAKE_ACTIVE' }, { status: 'ACTIVE', current_task: null },
    { status: 'ACTIVE', last_started: NOW - 3600 },
    { status: 'IDLE', current_task: 'FORGED TASK' },
    { status: 'ACTIVE', last_started: NOW + 4 },
  ];
  for (const change of invalid) {
    const o = makeSnapshot(); Object.assign(o.agents[0], change);
    assert.throws(() => decode(o), /CEO runtime contract/);
  }
});

test('unknown or duplicate department and agents are rejected', () => {
  const o1 = makeSnapshot(); o1.agents[1].agent_id = o1.agents[0].agent_id;
  assert.throws(() => decode(o1), /duplicate agent_id/);
  const o2 = makeSnapshot(); o2.agents[0].department = 'secret_account';
  assert.throws(() => decode(o2), /unknown agent department/);
  const o3 = makeSnapshot(); o3.departments[0].agents = 99;
  assert.throws(() => decode(o3), /inconsistent department counts/);
  const o4 = makeSnapshot(); o4.departments.pop();
  assert.throws(() => decode(o4), /unreported department/);
});

test('negative/future/invalid source freshness fails closed', () => {
  for (const age of [-5, NaN, Infinity]) {
    const o = makeSnapshot(); o.sources[0].age_s = age;
    assert.throws(() => decode(o), /CEO runtime contract/);
  }
  const o = makeSnapshot(); o.sources[0].state = 'PROBABLY_FRESH';
  assert.throws(() => decode(o), /invalid source state/);
});

test('reject uncalibrated probability and arbitrary calibration_ref', () => {
  const a = makeSnapshot(); a.reviews[0].probability = 0.82;
  assert.throws(() => decode(a), /uncalibrated probabilities/);
  const b = makeSnapshot(); b.reviews[0].calibration_ref = 'fake_model';
  assert.throws(() => decode(b), /uncalibrated probabilities/);
});

test('unknown sensitive upstream fields do not reach the projected dashboard', () => {
  const o = makeSnapshot('LIVE_READONLY');
  o.account_number = 'PRIVATE123';
  o.broker_password = 'SECRET';
  o.agents[0].account_balance = 999999;
  o.reviews[0].private_notes = 'SECRET';
  const result = projectCeoRuntimeForDashboard(decode(o));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE123|SECRET|999999/);
});

test('agent and review text is bounded, preventing unlimited messages or rendering', () => {
  const o = makeSnapshot(); o.agents[0].name = 'X'.repeat(101);
  assert.throws(() => decode(o), /CEO runtime contract/);
  const a = makeSnapshot(); a.events = Array(251).fill(a.events[0]);
  assert.throws(() => decode(a), /bounded array/);
});

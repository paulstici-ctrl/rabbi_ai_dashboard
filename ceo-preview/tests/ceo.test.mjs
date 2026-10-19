import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCeoSnapshot, buildCeoBoard, buildCeoBriefing, CEO_DEPARTMENTS, CEO_SYMBOLS } from '../src/data/ceo/model.js';
import ceo from '../src/ui/pages/ceo.js';

const fixtures = {
  agents: [{ id: 'observer', name: 'Observer', state: 'ACTIVE', task: 'Synthetic observation' },
           { id: 'guardian', name: 'Guardian', state: 'ACTIVE', task: 'Veto all execution' },
           { id: 'evaluator', name: 'Evaluator', state: 'IDLE', task: 'Awaiting validation' }],
  signals: [{ symbol: 'XAUUSD', timeframe: 'M15', action: 'BUY' },
            { symbol: 'GBPJPY', timeframe: 'H1', action: 'SELL' }],
  events: [{ id: 'e1', title: 'Example synthetic event', severity: 'info', t_utc: '2026-01-01T00:00:00Z' }],
  validationStatus: 'WAIT',
};
const snapshot = () => buildCeoSnapshot(fixtures);

test('six stable department IDs and four original symbols', () => {
  assert.deepEqual(CEO_DEPARTMENTS.map((d) => d.id), ['forex', 'crypto', 'equities', 'news', 'risk', 'research']);
  assert.deepEqual(CEO_SYMBOLS, ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY']);
});
test('no external news, crypto or stock division falsely claims connected', () => {
  const s = snapshot();
  for (const id of ['crypto', 'equities', 'news']) {
    const d = s.departments.find((x) => x.id === id);
    assert.equal(d.state, 'NOT_CONNECTED');
    assert.equal(d.members.length, 0);
  }
  assert.equal(s.connectedNewsSources, 0);
  assert.equal(s.connectedLiveAgentRuntimes, 0);
});
test('legacy agent ACTIVE is explicitly classified as simulated', () => {
  const s = snapshot();
  assert.equal(s.departments.find((d) => d.id === 'forex').state, 'DEMO');
  assert.equal(s.departments.find((d) => d.id === 'forex').members[0].state, 'ACTIVE');
  assert.equal(s.mode, 'DEMO');
});
test('unknown runtime status does not become ACTIVE', () => {
  const s = buildCeoSnapshot({ agents: [{ id: 'observer', state: 'FAKE_ACTIVE' }] });
  assert.equal(s.agents[0].state, 'UNKNOWN');
});
test('board shows demo candidate but always research only and risk veto', () => {
  const board = buildCeoBoard(snapshot(), 'XAUUSD');
  assert.match(board.researchLabel, /BUY CANDIDATE/);
  assert.match(board.risk, /VETO/);
  assert.match(board.conclusion, /DO NOT EXECUTE/);
  assert.match(board.news, /WAITING_DATA/);
});
test('unknown market symbol cannot be injected into board', () => {
  const board = buildCeoBoard(snapshot(), 'BTCUSD');
  assert.equal(board.symbol, 'XAUUSD');
});
test('H1 signal is not mistaken for M15', () => {
  const board = buildCeoBoard(snapshot(), 'GBPJPY');
  assert.match(board.researchLabel, /WAIT/);
});
test('empty payloads fail to unconnected/waiting states', () => {
  const s = buildCeoSnapshot();
  assert.equal(s.departments.find((d) => d.id === 'risk').state, 'WAITING_DATA');
  assert.equal(buildCeoBoard(s).conclusion, 'RESEARCH ONLY · DO NOT EXECUTE');
});
test('briefing refuses to fabricate news or probabilities', () => {
  const copy = buildCeoBriefing(snapshot()).map((x) => x.body).join(' ');
  assert.match(copy, /No verified news sources/);
  assert.match(copy, /Execution disabled/);
  assert.doesNotMatch(copy, /\b[0-9]+%\b/);
});
test('malicious upstream text is escaped in department detail', () => {
  const d = { agents: { agents: [{ id: 'observer', name: '<script>alert(1)</script>', state: 'ACTIVE' }] } };
  const ctx = { d, s: { query: {} } };
  const markup = String(ceo.regions.departmentDetail.render(ctx));
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
});
test('CEO page provides six regions plus hero, all with no trade actions', () => {
  assert.equal(ceo.id, 'ceo');
  assert.ok(ceo.regions.departments);
  assert.ok(ceo.regions.board);
  assert.ok(ceo.regions.news);
  assert.ok(!Object.keys(ceo.actions).some((name) => /trade|order|execute|buy|sell/i.test(name)));
});

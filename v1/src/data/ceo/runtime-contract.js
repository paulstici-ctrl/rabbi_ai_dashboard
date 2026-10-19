/**
 * RABBIT CEO Phase 2 local-runtime contract decoder (no fetch/network code).
 * This module never enables live data or trades. The public /v1 and /ceo-preview
 * pages are DEMO-only; an authenticated local-only host must inject this payload.
 */
export const CEO_RUNTIME_API_VERSION = 1;
export const CEO_MAX_SNAPSHOT_AGE_S = 30;

const MODES = new Set(['DEMO_SYNTHETIC', 'LIVE_READONLY']);
const STATES = new Set(['ACTIVE', 'IDLE', 'WAITING_DATA', 'DEGRADED', 'ERROR', 'DISABLED']);
const HEALTH = new Set(['HEALTHY', 'DEGRADED', 'DOWN']);
const SOURCE_STATES = new Set(['FRESH', 'STALE', 'UNAVAILABLE']);
const REVIEW = new Set(['BULLISH', 'BEARISH', 'NEUTRAL', 'WAIT']);
const SEVERITIES = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const EXPECTED = Object.freeze([
  { backend: 'forex_gold', ui: 'forex', name: 'Forex & Gold' },
  { backend: 'crypto', ui: 'crypto', name: 'Crypto Intelligence' },
  { backend: 'equities', ui: 'equities', name: 'Stocks & Indices' },
  { backend: 'news_intel', ui: 'news', name: 'Global News' },
  { backend: 'risk_compliance', ui: 'risk', name: 'Risk & Compliance' },
  { backend: 'research_validation', ui: 'research', name: 'Research Lab' },
]);

function fail(message) { throw new TypeError('CEO runtime contract: ' + message); }
function object(v, label) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(label + ' must be an object');
  return v;
}
function array(v, label, max = 128) {
  if (!Array.isArray(v) || v.length > max) fail(label + ' must be a bounded array');
  return v;
}
function text(v, label, max = 240) {
  if (typeof v !== 'string' || v.length > max) fail(label + ' must be a string <= ' + max);
  return v;
}
function number(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(label + ' must be finite');
  return v;
}
function integer(v, label, max = 10_000_000) {
  if (!Number.isSafeInteger(v) || v < 0 || v > max) fail(label + ' must be nonnegative integer');
  return v;
}
function optionalTime(v, label, now) {
  if (v == null) return null;
  const t = number(v, label);
  if (t < 0 || t > now + 2) fail(label + ' out of range');
  return t;
}
function enumValue(v, accepted, label) {
  if (!accepted.has(v)) fail('invalid ' + label);
  return v;
}

export function decodeCeoRuntimeSnapshot(payload, { nowSeconds = Date.now() / 1000, maxAgeSeconds = CEO_MAX_SNAPSHOT_AGE_S } = {}) {
  const p = object(payload, 'snapshot');
  const now = number(nowSeconds, 'clock');
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0 || maxAgeSeconds > 600) fail('maxAgeSeconds');
  if (p.schema_version !== CEO_RUNTIME_API_VERSION) fail('unsupported schema_version');
  const mode = enumValue(p.mode, MODES, 'mode');
  if (p.research_only !== true || p.read_only !== true || p.execution_enabled !== false)
    fail('requires research_only=true, read_only=true, execution_enabled=false');
  const generated = number(p.generated, 'generated');
  if (generated < 0 || generated > now + 2) fail('future/negative generated timestamp');
  if (mode === 'LIVE_READONLY' && now - generated > maxAgeSeconds) fail('stale live snapshot');

  const rawAgents = array(p.agents, 'agents', 128);
  const ids = new Set();
  const agents = rawAgents.map((raw, i) => {
    const a = object(raw, 'agent ' + i), id = text(a.agent_id, 'agent_id', 70);
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(id) || ids.has(id)) fail('bad or duplicate agent_id');
    ids.add(id);
    const department = text(a.department, 'department', 50);
    if (!EXPECTED.some(d => d.backend === department)) fail('unknown agent department');
    const status = enumValue(a.status, STATES, 'agent status');
    const currentTask = a.current_task == null ? null : text(a.current_task, 'current_task');
    const lastStarted = optionalTime(a.last_started, 'last_started', now);
    const lastFinished = optionalTime(a.last_finished, 'last_finished', now);
    if (status === 'ACTIVE' && (!currentTask || lastStarted == null || now - lastStarted > 300))
      fail('ACTIVE agent without a recent running task');
    if (status !== 'ACTIVE' && currentTask) fail('non-ACTIVE agent claims a running task');
    return {
      id, name: text(a.name, 'agent name', 100), department, state: status,
      task: currentTask || '', lastStarted, lastFinished,
      runs: integer(a.runs, 'runs'), successes: integer(a.successes, 'successes'),
      failures: integer(a.failures, 'failures'),
      waitingOn: array(a.waiting_on, 'waiting_on', 24).map(v => text(v, 'waiting_on', 80)),
      degradedReasons: array(a.degraded_reasons, 'degraded_reasons', 24).map(v => text(v, 'degraded reason', 180)),
      lastError: text(a.last_error, 'last_error', 300),
    };
  });
  const departmentsSeen = new Set();
  const departments = array(p.departments, 'departments', 12).map((raw) => {
    const d = object(raw, 'department'), id = text(d.department, 'department ID', 50);
    if (!EXPECTED.some(x => x.backend === id) || departmentsSeen.has(id)) fail('unknown or duplicate department');
    departmentsSeen.add(id);
    const reportedCount = integer(d.agents, 'department agent count', 128);
    const counts = object(d.counts, 'department counts');
    const safeCounts = {};
    for (const status of STATES) safeCounts[status] = counts[status] == null ? 0 : integer(counts[status], 'department count');
    if (Object.values(safeCounts).reduce((a, b) => a + b, 0) !== reportedCount)
      fail('inconsistent department counts');
    return { id, name: text(d.name, 'department name', 100), agentCount: reportedCount,
      level: enumValue(d.level, HEALTH, 'department health'), counts: safeCounts };
  });
  const departmentIds = new Set(departments.map(d => d.id));
  if (agents.some(a => !departmentIds.has(a.department))) fail('agent belongs to an unreported department');

  const sources = array(p.sources, 'sources', 128).map((raw) => {
    const s = object(raw, 'source');
    const state = enumValue(s.state, SOURCE_STATES, 'source state');
    if (typeof s.synthetic !== 'boolean') fail('source.synthetic must be boolean');
    const age = s.age_s == null ? null : number(s.age_s, 'source.age_s');
    if (age != null && age < -2) fail('future source timestamp');
    return { id: text(s.source, 'source', 100), state, synthetic: s.synthetic,
      ageSeconds: age, provider: s.provider == null ? '' : text(s.provider, 'provider', 100) };
  });
  const reviews = array(p.reviews, 'reviews', 128).map((raw) => {
    const r = object(raw, 'review');
    if (r.research_only !== true || typeof r.synthetic !== 'boolean') fail('review provenance required');
    if ((Object.prototype.hasOwnProperty.call(r, 'probability') && r.probability !== null) ||
        Object.prototype.hasOwnProperty.call(r, 'calibration_ref')) fail('uncalibrated probabilities forbidden');
    const risk = object(r.risk, 'review risk');
    return {
      instrument: text(r.instrument, 'review instrument', 30), horizon: text(r.horizon, 'review horizon', 10),
      status: enumValue(r.status, REVIEW, 'review status'), synthetic: r.synthetic,
      vetoed: r.vetoed === true, conflict: r.conflict === true,
      riskVerdict: risk.verdict == null ? null : text(risk.verdict, 'risk verdict', 24),
      reasonCodes: array(r.reasons, 'review reasons', 32).map(v => text(object(v, 'reason').code, 'reason code', 100)),
      decisionId: text(r.decision_id, 'decision id', 100),
    };
  });
  const events = array(p.events, 'events', 250).map((raw) => {
    const e = object(raw, 'event');
    if (typeof e.synthetic !== 'boolean') fail('event synthetic flag missing');
    return {
      id: text(e.event_id, 'event ID', 100), type: text(e.type, 'event type', 100),
      sourceAgent: text(e.source_agent, 'event source', 100),
      severity: enumValue(e.severity, SEVERITIES, 'event severity'),
      timestamp: optionalTime(e.timestamp, 'event timestamp', now), synthetic: e.synthetic,
    };
  });
  return {
    schemaVersion: CEO_RUNTIME_API_VERSION, mode, generated, readOnly: true,
    researchOnly: true, executionEnabled: false,
    agents, departments, sources, reviews, events,
  };
}

/**
 * Crosses the exact Python Phase 1 department IDs to current seventh-page IDs.
 * This projection does not contact a server and never pretends a missing dept is live.
 */
export function projectCeoRuntimeForDashboard(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== CEO_RUNTIME_API_VERSION) fail('decoded snapshot required');
  const simulated = snapshot.mode === 'DEMO_SYNTHETIC';
  const byId = new Map(snapshot.departments.map(d => [d.id, d]));
  const departments = EXPECTED.map(d => {
    const row = byId.get(d.backend);
    const members = snapshot.agents.filter(a => a.department === d.backend);
    return {
      id: d.ui, backendId: d.backend, name: row?.name || d.name,
      state: !row ? 'NOT_CONNECTED' : simulated ? 'SIMULATED_RUNTIME' : row.level,
      members, note: !row ? 'No registered department in runtime.' :
        simulated ? 'Python jobs ran against synthetic fixtures, not live markets.' :
        'Real Python runtime. Check source freshness and agent tasks individually.',
    };
  });
  return {
    mode: snapshot.mode, readOnly: true, generated: snapshot.generated,
    tradingStatus: 'DISABLED', departments, agents: snapshot.agents,
    reviews: snapshot.reviews, events: snapshot.events,
    connectedLiveAgentRuntimes: simulated ? 0 : snapshot.agents.filter(a => a.runs > 0).length,
    connectedLiveDataSources: simulated ? 0 : snapshot.sources.filter(s => !s.synthetic && s.state === 'FRESH').length,
    connectedNewsSources: simulated ? 0 : snapshot.sources.filter(s => !s.synthetic && s.state === 'FRESH' && /news|macro/i.test(s.id)).length,
  };
}

/**
 * RABBIT CEO Phase 2 dashboard data boundary.
 * This module does NOT activate networking on the public GitHub Pages preview.
 * Only a future explicitly approved private deployment can construct the client
 * with { enabled: true }. It sends GET requests to the SAME ORIGIN only.
 *
 * Backend contract: docs/ceo/PHASE2_DASHBOARD_CONTRACT.md (private repo).
 */
export const PRIVATE_CEO_SNAPSHOT_PATH = '/api/ceo/v1/snapshot';
export const CEO_BACKEND_DEPARTMENTS = Object.freeze({
  forex_gold: 'forex',
  crypto: 'crypto',
  equities: 'equities',
  news_intel: 'news',
  risk_compliance: 'risk',
  research_validation: 'research',
});
export const CEO_BACKEND_AGENT_STATES = Object.freeze([
  'ACTIVE', 'IDLE', 'WAITING_DATA', 'DEGRADED', 'ERROR', 'DISABLED',
]);
export const CEO_BACKEND_MODES = Object.freeze(['DEMO_SYNTHETIC', 'LIVE_READONLY']);
const STATES = new Set(CEO_BACKEND_AGENT_STATES);
const MODES = new Set(CEO_BACKEND_MODES);
const SOURCE_STATES = new Set(['FRESH', 'STALE', 'UNAVAILABLE']);
const RESEARCH_STATES = new Set(['BULLISH', 'BEARISH', 'NEUTRAL', 'WAIT']);
const DEPARTMENTS = new Set(Object.keys(CEO_BACKEND_DEPARTMENTS));
const SENSITIVE_KEY = /^(?:account|account_id|account_number|balance|equity|margin|password|token|secret|api_key|authorization|cookie|credential|private_key|order|order_send|positions?|trades?)$/i;

export class CeoSnapshotError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CeoSnapshotError';
    this.code = code;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function finiteTime(value) {
  return Number.isFinite(value) && value > 0;
}
function requireList(value, limit) {
  return Array.isArray(value) && value.length <= limit;
}
function assertNoSensitiveFields(value, depth = 0) {
  if (depth > 15) throw new CeoSnapshotError('NESTING_LIMIT');
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new CeoSnapshotError('ARRAY_LIMIT');
    value.forEach((item) => assertNoSensitiveFields(item, depth + 1));
  } else if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new CeoSnapshotError('PRIVATE_FIELD_REJECTED');
      assertNoSensitiveFields(item, depth + 1);
    }
  }
}

function assertAgent(agent) {
  if (!isObject(agent) || typeof agent.agent_id !== 'string' ||
      !/^[a-z][a-z0-9_]{1,40}$/.test(agent.agent_id) ||
      typeof agent.name !== 'string' || agent.name.length > 160 ||
      !DEPARTMENTS.has(agent.department) || !STATES.has(agent.status) ||
      (agent.current_task !== null && typeof agent.current_task !== 'string') ||
      !Number.isSafeInteger(agent.runs) || agent.runs < 0 ||
      typeof agent.synthetic !== 'boolean') {
    throw new CeoSnapshotError('INVALID_AGENT');
  }
  if (agent.status === 'ACTIVE' && (!agent.current_task || !finiteTime(agent.last_started))) {
    throw new CeoSnapshotError('FALSE_ACTIVE_AGENT');
  }
}

export function validateCeoSnapshot(snapshot, { now = Date.now() / 1000, maxAgeSeconds = 30 } = {}) {
  if (!isObject(snapshot) || snapshot.schema_version !== 1 || !MODES.has(snapshot.mode) ||
      snapshot.read_only !== true || snapshot.execution_enabled !== false ||
      snapshot.research_only !== true || !finiteTime(snapshot.generated_at)) {
    throw new CeoSnapshotError('INVALID_SNAPSHOT');
  }
  if (!Number.isFinite(now) || snapshot.generated_at > now + 5) {
    throw new CeoSnapshotError('FUTURE_SNAPSHOT');
  }
  if (snapshot.mode === 'LIVE_READONLY' && (now - snapshot.generated_at > maxAgeSeconds ||
      snapshot.synthetic === true)) {
    throw new CeoSnapshotError('STALE_OR_SIMULATED_LIVE_SNAPSHOT');
  }
  if (!requireList(snapshot.departments, 6) || !requireList(snapshot.agents, 40) ||
      !requireList(snapshot.sources, 80) || !requireList(snapshot.reviews, 150) ||
      !requireList(snapshot.events, 250)) {
    throw new CeoSnapshotError('INVALID_COLLECTION');
  }
  if (!isObject(snapshot.runtime) || typeof snapshot.runtime.connected !== 'boolean') {
    throw new CeoSnapshotError('INVALID_RUNTIME');
  }
  const seenDepartments = new Set();
  for (const d of snapshot.departments) {
    if (!isObject(d) || !DEPARTMENTS.has(d.id) || seenDepartments.has(d.id) ||
        typeof d.name !== 'string' || !['HEALTHY', 'DEGRADED', 'DOWN'].includes(d.health)) {
      throw new CeoSnapshotError('INVALID_DEPARTMENT');
    }
    seenDepartments.add(d.id);
  }
  const seenAgents = new Set();
  for (const a of snapshot.agents) {
    assertAgent(a);
    if (seenAgents.has(a.agent_id) || !seenDepartments.has(a.department)) {
      throw new CeoSnapshotError('INVALID_AGENT_LINK');
    }
    seenAgents.add(a.agent_id);
  }
  for (const source of snapshot.sources) {
    if (!isObject(source) || typeof source.id !== 'string' || source.id.length > 100 ||
        !SOURCE_STATES.has(source.state) || typeof source.synthetic !== 'boolean' ||
        !(source.last_update === null || finiteTime(source.last_update))) {
      throw new CeoSnapshotError('INVALID_SOURCE');
    }
    if (snapshot.mode === 'LIVE_READONLY' && source.state === 'FRESH' && source.synthetic) {
      throw new CeoSnapshotError('SIMULATED_LIVE_SOURCE');
    }
  }
  for (const r of snapshot.reviews) {
    if (!isObject(r) || typeof r.instrument !== 'string' || r.instrument.length > 30 ||
        !RESEARCH_STATES.has(r.status) || typeof r.vetoed !== 'boolean' ||
        typeof r.synthetic !== 'boolean') {
      throw new CeoSnapshotError('INVALID_REVIEW');
    }
  }
  for (const e of snapshot.events) {
    if (!isObject(e) || typeof e.event_id !== 'string' ||
        typeof e.type !== 'string' || typeof e.summary !== 'string' ||
        !finiteTime(e.timestamp) || typeof e.synthetic !== 'boolean') {
      throw new CeoSnapshotError('INVALID_EVENT');
    }
  }
  if (snapshot.briefing !== null &&
      (!isObject(snapshot.briefing) || !finiteTime(snapshot.briefing.generated) ||
       !['ro', 'en'].includes(snapshot.briefing.language) ||
       typeof snapshot.briefing.text !== 'string' ||
       snapshot.briefing.text.length > 30000)) {
    throw new CeoSnapshotError('INVALID_BRIEFING');
  }
  assertNoSensitiveFields(snapshot);
  return snapshot;
}

export function isCeoPrivateOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return false;
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    const tailnet = url.hostname.endsWith('.ts.net') && url.hostname.length > '.ts.net'.length;
    return (local && ['http:', 'https:'].includes(url.protocol)) ||
           (tailnet && url.protocol === 'https:');
  } catch {
    return false;
  }
}

/**
 * Read-only transport. Network access is OPT-IN, unavailable on GitHub Pages,
 * same-origin only, and subject to backend authentication and authorization.
 * Callers must never place session tokens or private URLs in query parameters.
 */
export class PrivateCeoSnapshotClient {
  constructor({ enabled = false, origin = globalThis.location?.origin || '',
                fetchImpl = globalThis.fetch } = {}) {
    this.enabled = enabled;
    this.origin = origin;
    this.fetchImpl = fetchImpl;
  }
  async getSnapshot({ now = Date.now() / 1000 } = {}) {
    if (!this.enabled) throw new CeoSnapshotError('CLIENT_DISABLED');
    if (!isCeoPrivateOrigin(this.origin)) throw new CeoSnapshotError('UNTRUSTED_ORIGIN');
    if (typeof this.fetchImpl !== 'function') throw new CeoSnapshotError('FETCH_UNAVAILABLE');
    const url = new URL(PRIVATE_CEO_SNAPSHOT_PATH, this.origin);
    const res = await this.fetchImpl(url.href, {
      method: 'GET', credentials: 'same-origin', redirect: 'error',
      mode: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' },
    });
    if (!res || res.ok !== true) throw new CeoSnapshotError('NETWORK_OR_AUTH_ERROR');
    if (!String(res.headers?.get?.('content-type') || '').toLowerCase().includes('application/json')) {
      throw new CeoSnapshotError('INVALID_CONTENT_TYPE');
    }
    // Reject oversized responses before parsing (Content-Length is advisory).
    const data = await res.text();
    if (data.length > 512000) throw new CeoSnapshotError('RESPONSE_TOO_LARGE');
    let decoded;
    try { decoded = JSON.parse(data); }
    catch { throw new CeoSnapshotError('INVALID_JSON'); }
    return validateCeoSnapshot(decoded, { now });
  }
}

export function mapCeoApiToDashboard(snapshot) {
  const byDept = new Map(snapshot.departments.map((d) => [d.id, d]));
  const agents = snapshot.agents.map((a) => ({
    id: a.agent_id, name: a.name, department: CEO_BACKEND_DEPARTMENTS[a.department],
    state: a.status, task: a.current_task || '',
    lastStarted: a.last_started ?? null, runs: a.runs, synthetic: a.synthetic,
  }));
  const departments = Object.entries(CEO_BACKEND_DEPARTMENTS).map(([id, uiId]) => {
    const department = byDept.get(id);
    const members = agents.filter((a) => a.department === uiId);
    return {
      id: uiId, backendId: id, name: department?.name || id, members,
      state: !department ? 'WAITING_DATA' : department.health,
      source: snapshot.mode, synthetic: snapshot.mode === 'DEMO_SYNTHETIC',
      note: department
        ? (snapshot.mode === 'DEMO_SYNTHETIC' ? 'Synthetic CEO runtime; no live market data.' :
           'Read-only CEO runtime. Source provenance is shown per agent.')
        : 'Department unavailable in this snapshot.',
    };
  });
  return {
    mode: snapshot.mode, readOnly: true, synthetic: snapshot.mode === 'DEMO_SYNTHETIC',
    departments, agents, sources: snapshot.sources,
    reviews: snapshot.reviews, events: snapshot.events,
    briefing: snapshot.briefing, generatedAt: snapshot.generated_at,
    tradingStatus: 'DISABLED', connectedExternalSources: snapshot.sources.filter((s) => s.state === 'FRESH' && !s.synthetic).length,
    connectedLiveAgentRuntimes: snapshot.mode === 'LIVE_READONLY' && snapshot.runtime.connected ? 1 : 0,
    connectedNewsSources: snapshot.sources.filter((s) => s.id.includes('news') && s.state === 'FRESH' && !s.synthetic).length,
  };
}

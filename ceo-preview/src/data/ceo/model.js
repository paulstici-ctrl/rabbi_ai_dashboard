// CEO prototype adapter. Only consumes existing V1 synthetic/demo payloads.
// No network access, news ingestion, account data, trading or autonomous agents.
export const CEO_SYMBOLS = Object.freeze(['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY']);

export const CEO_DEPARTMENTS = Object.freeze([
  { id: 'forex', name: 'Forex & Gold', short: 'FX', caption: 'Structure, liquidity & macro', agents: ['observer', 'analyst'], phase: 'DEMO' },
  { id: 'crypto', name: 'Crypto Intelligence', short: '₿', caption: 'Spot, derivatives & on-chain', agents: [], phase: 'PLANNED' },
  { id: 'equities', name: 'Stocks & Indices', short: 'EQ', caption: 'Indices, earnings & sectors', agents: [], phase: 'PLANNED' },
  { id: 'news', name: 'Global News', short: 'NW', caption: 'Sources, verification & macro', agents: [], phase: 'PLANNED' },
  { id: 'risk', name: 'Risk & Compliance', short: 'RK', caption: 'Independent research veto', agents: ['guardian'], phase: 'DEMO' },
  { id: 'research', name: 'Research Lab', short: 'RL', caption: 'Validation & paper statistics', agents: ['evaluator', 'performance'], phase: 'DEMO' },
]);

export const CEO_DEPARTMENT_IDS = Object.freeze(CEO_DEPARTMENTS.map((d) => d.id));

const STATES = new Set(['ACTIVE', 'IDLE', 'WAITING_DATA', 'DEGRADED', 'ERROR', 'DISABLED', 'BLOCKED']);
export const normalizeAgentState = (state) => STATES.has(state) ? state : 'UNKNOWN';

const normalAgent = (a) => ({
  id: String(a.id || ''),
  name: String(a.name || a.id || 'Unnamed agent'),
  state: normalizeAgentState(a.state),
  task: String(a.task || 'No task reported'),
});

/**
 * Produces a clear boundary between V1 demo payloads and the future CEO Phase 1 API.
 * Any V1 agent state is explicitly labelled demo, not evidence of a running AI process.
 */
export function buildCeoSnapshot({ agents = [], signals = [], events = [], validationStatus = 'WAIT', tradingEnabled = false } = {}) {
  const safeAgents = Array.isArray(agents) ? agents.filter((a) => a && typeof a === 'object').map(normalAgent) : [];
  const byId = new Map(safeAgents.map((a) => [a.id, a]));
  const departments = CEO_DEPARTMENTS.map((dept) => {
    const members = dept.agents.flatMap((id) => byId.has(id) ? [byId.get(id)] : []);
    return {
      ...dept,
      state: dept.phase === 'PLANNED' ? 'NOT_CONNECTED' : members.length ? 'DEMO' : 'WAITING_DATA',
      members,
      note: dept.phase === 'PLANNED' ? 'No data adapter or runtime is connected.' : 'Legacy V1 simulated agents only — no operational CEO runtime.',
    };
  });
  const safeSignals = Array.isArray(signals) ? signals.filter((s) => s && CEO_SYMBOLS.includes(s.symbol) && s.timeframe === 'M15') : [];
  const safeEvents = Array.isArray(events) ? events.filter((e) => e && typeof e.title === 'string').slice(0, 5).map((e) => ({
    id: String(e.id || ''), title: e.title, severity: ['info', 'warn', 'error', 'ok'].includes(e.severity) ? e.severity : 'info',
    source: 'V1 synthetic event', time: typeof e.t_utc === 'string' ? e.t_utc : '',
  })) : [];
  const status = tradingEnabled ? 'UNKNOWN — VERIFY EXECUTION SETTINGS' : 'DISABLED (DEMO)';
  return {
    mode: 'DEMO', readOnly: true, modelVersion: 1, departments, agents: safeAgents,
    signals: safeSignals, events: safeEvents, validationStatus: String(validationStatus),
    tradingStatus: status, connectedExternalSources: 0,
    connectedLiveAgentRuntimes: 0, connectedNewsSources: 0,
    plannedDepartments: departments.filter((d) => d.phase === 'PLANNED').length,
  };
}

export function buildCeoBoard(snapshot, symbol = 'XAUUSD') {
  const selected = CEO_SYMBOLS.includes(symbol) ? symbol : CEO_SYMBOLS[0];
  const signal = snapshot.signals.find((s) => s.symbol === selected);
  const action = ['BUY', 'SELL', 'WAIT'].includes(signal?.action) ? signal.action : 'WAIT';
  return {
    symbol: selected,
    researchLabel: action === 'WAIT' ? 'WAIT (synthetic research)' : `${action} CANDIDATE (synthetic research)`,
    technical: signal ? `M15 illustrative signal: ${action}; unvalidated, no forecast probability.` : 'No eligible M15 synthetic signal was provided.',
    macro: 'WAITING_DATA — no verified macro data adapter.',
    news: 'WAITING_DATA — no verified news feed or impact model.',
    risk: 'VETO — real trading remains disabled; no validated live execution.',
    conclusion: 'RESEARCH ONLY · DO NOT EXECUTE',
  };
}

export function buildCeoBriefing(snapshot) {
  const demos = snapshot.departments.filter((d) => d.state === 'DEMO').length;
  return [
    { title: 'System overview', body: `${demos} departments display V1 simulated activity; ${snapshot.plannedDepartments} departments are not connected.` },
    { title: 'News intelligence', body: 'No verified news sources connected. No real-world event impact estimates are available.' },
    { title: 'Validation', body: `Legacy research validation: ${snapshot.validationStatus}. This is not a live strategy approval.` },
    { title: 'Trading control', body: snapshot.tradingStatus === 'DISABLED (DEMO)' ? 'Execution disabled. No orders or position changes are possible here.' : 'Execution setting is unexpected — verify controls before connecting.' },
  ];
}

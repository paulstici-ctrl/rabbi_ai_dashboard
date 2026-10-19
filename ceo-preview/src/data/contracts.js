// JSON contracts between the Python/MT5 engine and the Command Center. Single source of truth:
// `node scripts/build-contracts.mjs` writes contracts/*.schema.json from these definitions.
const S = {
  str: { type: 'string' }, num: { type: 'number' }, int: { type: 'integer' }, bool: { type: 'boolean' },
  enum: (v) => ({ type: 'string', enum: v }),
  nul: (s) => ({ ...s, type: [].concat(s.type, 'null'), ...(s.enum ? { enum: [...s.enum, null] } : {}) }),
  arr: (items, max = 5000) => ({ type: 'array', items, maxItems: max }),
  obj: (props, required) => ({ type: 'object', properties: props, required: required || Object.keys(props), additionalProperties: false }),
};
const { str, num, int, bool, nul, arr, obj } = S;
const header = { schema_version: { type: 'integer', const: 1 }, mode: S.enum(['demo', 'live-readonly']), generated_utc: str, as_of_utc: str, source: str };
const doc = (extra) => obj({ ...header, ...extra });
const TF = S.enum(['M1', 'M5', 'M15', 'H1', 'H4']);
const SYM = str, SIDE = S.enum(['BUY', 'SELL']);
const stats = obj({ trades: int, mean_r: nul(num), ci_low: nul(num), ci_high: nul(num), win_rate: nul(num), profit_factor: nul(num), max_dd_r: nul(num) });
const decision = obj({ id: str, t_utc: str, symbol: nul(str), verdict: str, summary: str, explanation: arr(str, 20), confidence: nul(num) });

export const SCHEMAS = {
  meta: doc({
    trading_enabled: { type: 'boolean', const: false }, engine: obj({ baseline: str, simulator: str, validation: S.enum(['WAIT', 'PROVISIONAL', 'VALIDATED']) }),
    timeframes: arr(TF, 10), disclaimers: arr(str, 10),
    symbols: arr(obj({ symbol: str, asset_class: str, digits: int, pip_size: num, pip_value_per_lot_usd: num, spread_floor_pips: num, max_spread_pips: num, min_stop_pips: num, max_spread_r: num }), 50),
  }),
  quotes: doc({ quotes: arr(obj({ symbol: SYM, bid: num, ask: num, mid: num, spread_pips: num, change_pct: num, day_high: num, day_low: num, atr_pips: nul(num), atr_pct: nul(num), volatility_state: S.enum(['LOW', 'NORMAL', 'HIGH']), spread_state: S.enum(['OK', 'ELEVATED', 'WIDE']), last_tick_utc: str, spark: arr(num, 120) }), 50) }),
  candles: doc({ symbol: SYM, timeframe: TF, candles: arr(obj({ t: int, o: num, h: num, l: num, c: num, v: num }), 5000) }),
  signals: doc({ signals: arr(obj({ id: str, symbol: SYM, timeframe: TF, action: S.enum(['BUY', 'SELL', 'WAIT']), created_utc: str, entry: nul(num), stop_loss: nul(num), take_profit: nul(num), risk_reward: nul(num), probability: nul(num), validation: obj({ status: S.enum(['unvalidated', 'validated']), source: nul(str) }), note: str, reasons: arr(obj({ kind: S.enum(['pro', 'con', 'info']), text: str }), 20), checks: arr(obj({ name: str, passed: bool, detail: str }), 20) }), 100) }),
  scanner: doc({ opportunities: arr(obj({ id: str, symbol: SYM, timeframe: TF, setup: str, direction: S.enum(['BUY', 'SELL', 'NEUTRAL']), score: num, score_kind: { type: 'string', const: 'heuristic' }, status: S.enum(['WATCH', 'ARMED', 'BLOCKED']), note: str }), 200) }),
  agents: doc({
    agents: arr(obj({ id: str, name: str, role: str, state: S.enum(['ACTIVE', 'IDLE', 'BLOCKED', 'ERROR']), task: str, uptime_s: int, last_heartbeat_utc: str, metrics: arr(obj({ label: str, value: str }), 20), decisions: arr(decision, 100), log: arr(obj({ t_utc: str, level: S.enum(['INFO', 'WARN', 'ERROR']), msg: str }), 300) }), 20),
    messages: arr(obj({ t_utc: str, from: str, to: str, topic: str }), 200),
  }),
  account: doc({
    account: obj({ label: str, currency: str, initial: num, equity: num, day_pnl: num, week_pnl: num, drawdown_pct: num, max_drawdown_pct: num, risk_per_trade_pct: num, open_positions: arr(obj({ id: str, symbol: SYM, side: SIDE, entry: num, stop_loss: num, take_profit: num, opened_utc: str, floating_r: num }), 50), exposure: arr(obj({ symbol: SYM, risk_r: num, share_pct: num }), 50), limits: obj({ daily_loss_pct: num, max_drawdown_pct: num, max_open_positions: int, risk_per_trade_pct: num }) }),
    equity_curve: arr(obj({ t: int, equity: num, drawdown_pct: num }), 5000), recent_outcomes: arr(S.enum(['W', 'L', 'B']), 100),
  }),
  strategies: doc({
    strategies: arr(obj({ id: str, name: str, pattern: str, action: S.enum(['NORMAL', 'REVERSE']), horizon_s: int, regime: str, status: S.enum(['REJECTED', 'WAIT', 'ELIGIBLE']), p_adj: nul(num), splits: obj({ train: stats, validation: stats, test: obj({ status: S.enum(['NOT_EVALUATED', 'EVALUATED']), trades: nul(int), mean_r: nul(num) }) }), equity: obj({ t: arr(int, 2000), r_cum: arr(num, 2000), split_index: arr(int, 2) }) }), 200),
    split_plan: obj({ train: obj({ from: str, to: str }), validation: obj({ from: str, to: str }), test: obj({ from: str, to: str }), embargo_days: int }),
    params: { type: 'object' }, gates: arr(obj({ name: str, passed: { type: ['boolean', 'null'] }, detail: str }), 20),
  }),
  journal: doc({
    trades: arr(obj({ id: str, symbol: SYM, side: SIDE, strategy_id: str, opened_utc: str, closed_utc: nul(str), entry: num, exit: nul(num), stop_loss: num, take_profit: num, result_r: nul(num), exit_reason: nul(S.enum(['TARGET', 'STOP', 'TIME'])), risk_pct: num, simulated: { type: 'boolean', const: true }, agent_decision_id: str, tags: arr(str, 10), note: str }), 2000),
    decisions: arr(obj({ id: str, t_utc: str, agent: str, symbol: nul(str), verdict: str, summary: str, outcome: str }), 2000),
  }),
  system: doc({
    mt5: obj({ status: S.enum(['CONNECTED', 'DISCONNECTED', 'ERROR']), mode: str, server: nul(str), last_check_utc: str, note: str }),
    feeds: arr(obj({ symbol: SYM, ticks_per_s: num, last_tick_age_s: num, gap_share: num, spread_median_pips: num, spread_quality: S.enum(['PASS', 'WARN', 'FAIL']), status: S.enum(['HEALTHY', 'DEGRADED', 'DOWN']) }), 50),
    ci: arr(obj({ workflow: str, status: S.enum(['success', 'failure', 'running', 'pending']), branch: str, commit: str, finished_utc: nul(str), duration_s: nul(int) }), 50),
    versions: arr(obj({ component: str, version: str, state: str }), 30),
    validation: obj({ status: S.enum(['WAIT', 'PROVISIONAL', 'VALIDATED']), reasons: arr(str, 20) }),
    logs: arr(obj({ t_utc: str, level: S.enum(['INFO', 'WARN', 'ERROR']), source: str, msg: str }), 1000),
    safety: obj({ trading_enabled: { type: 'boolean', const: false }, live_orders: int, kill_switch: str }),
  }),
  events: doc({ events: arr(obj({ id: str, t_utc: str, type: S.enum(['data', 'signal', 'risk', 'agent', 'ci', 'system']), severity: S.enum(['info', 'warn', 'error', 'ok']), title: str, detail: str, symbol: nul(str) }), 1000) }),
};

const isType = (v, n) => (n === 'number' ? typeof v === 'number' && Number.isFinite(v) : n === 'integer' ? Number.isInteger(v) : n === 'null' ? v === null : n === 'array' ? Array.isArray(v) : n === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : typeof v === n);
export function validateInstance(v, s, path = '$') {
  const err = [];
  if (s.type) { const ts = [].concat(s.type); if (!ts.some((t) => isType(v, t))) return [`${path}: expected ${ts.join('|')}, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`]; }
  if (s.enum && !s.enum.includes(v)) err.push(`${path}: ${JSON.stringify(v)} not in enum`);
  if ('const' in s && v !== s.const) err.push(`${path}: must equal ${JSON.stringify(s.const)}`);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of s.required || []) if (!(k in v)) err.push(`${path}: missing "${k}"`);
    if (s.additionalProperties === false) for (const k of Object.keys(v)) if (!(k in (s.properties || {}))) err.push(`${path}: unexpected "${k}"`);
    for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) err.push(...validateInstance(v[k], sub, `${path}.${k}`));
  }
  if (Array.isArray(v)) {
    if (s.maxItems != null && v.length > s.maxItems) err.push(`${path}: more than ${s.maxItems} items`);
    if (s.items) for (let i = 0; i < v.length && err.length < 20; i++) err.push(...validateInstance(v[i], s.items, `${path}[${i}]`));
  }
  return err;
}
export class ContractError extends Error { constructor(kind, errors) { super(`Contract violation in "${kind}": ${errors.slice(0, 3).join('; ')}`); this.kind = kind; this.errors = errors; } }
export function validate(kind, payload) { const s = SCHEMAS[kind]; if (!s) throw new Error(`unknown contract ${kind}`); const e = validateInstance(payload, s); if (e.length) throw new ContractError(kind, e); return payload; }
export const makeHeader = (asOfUnix, mode = 'demo', source = 'demo-generator') => ({ schema_version: 1, mode, generated_utc: new Date(asOfUnix * 1000).toISOString().replace('.000Z', 'Z'), as_of_utc: new Date(asOfUnix * 1000).toISOString().replace('.000Z', 'Z'), source });

// Simulated trades, paper account and strategy-lab results. Everything here is SYNTHETIC and deterministic:
// trades are walked over the generated M1 candles, so journal entries match what the charts show.
import { rngFor } from '../../core/prng.js';
import { SYMBOLS, SYMBOL_CFG, getSeries, tfData, DEMO_NOW, spreadAt, idxAt } from './market.js';
import { atr } from '../../domain/indicators.js';
import { summarize, bootstrapMeanCI, mean, bhAdjust, normalCdf } from '../../domain/stats.js';
import { rMultiple, floatingR } from '../../domain/risk.js';
import { unixToIso } from '../../core/format.js';

export const INITIAL_EQUITY = 10000, RISK_PCT = 0.25;
export const DEMO_LAB_SEED = 'lab7';   // chosen so the demo shows modest, noisy, non-significant results (see tests)
export const STRATEGIES = [
  { id: 'S01', pattern: 'THREE_BAR_MOMENTUM', action: 'NORMAL', horizon_s: 30, regime: 'RANGE', tag: 'momentum' },
  { id: 'S02', pattern: 'THREE_BAR_MOMENTUM', action: 'REVERSE', horizon_s: 60, regime: 'TREND_UP', tag: 'momentum' },
  { id: 'S03', pattern: 'THREE_RED_GREEN_WICK', action: 'NORMAL', horizon_s: 60, regime: 'RANGE', tag: 'wick' },
  { id: 'S04', pattern: 'THREE_GREEN_RED_WICK', action: 'NORMAL', horizon_s: 120, regime: 'VOLATILE', tag: 'wick' },
  { id: 'S05', pattern: 'SWEEP_RECLAIM', action: 'NORMAL', horizon_s: 60, regime: 'RANGE', tag: 'sweep' },
  { id: 'S06', pattern: 'EMA_PULLBACK', action: 'NORMAL', horizon_s: 120, regime: 'TREND_UP', tag: 'pullback' },
  { id: 'S07', pattern: 'THREE_BAR_MOMENTUM', action: 'NORMAL', horizon_s: 120, regime: 'TREND_DOWN', tag: 'momentum' },
  { id: 'S08', pattern: 'THREE_RED_GREEN_WICK', action: 'REVERSE', horizon_s: 30, regime: 'RANGE', tag: 'wick' },
  { id: 'S09', pattern: 'SWEEP_RECLAIM', action: 'NORMAL', horizon_s: 120, regime: 'VOLATILE', tag: 'sweep' },
  { id: 'S10', pattern: 'EMA_PULLBACK', action: 'NORMAL', horizon_s: 60, regime: 'TREND_DOWN', tag: 'pullback' },
];
export const strategyName = (s) => `${s.pattern} · ${s.action} · ${s.horizon_s}s · ${s.regime}`;
const HORIZON_MIN = { 30: 15, 60: 30, 120: 60 };

let _atr = null;
function m15Atr(sym) {
  if (!_atr) _atr = {};
  if (!_atr[sym]) { const d = tfData(sym, 'M15'); _atr[sym] = { start: d.start, a: atr(d.t.map((t, i) => ({ t, h: d.h[i], l: d.l[i], c: d.c[i] })), 14) }; }
  return _atr[sym];
}
function bucketBefore(start, idx) { let lo = 0, hi = start.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (start[m] <= idx) lo = m; else hi = m - 1; } return lo; }

/** Walk one simulated trade over the M1 candles starting after `idx`. Stop is checked before target (conservative). */
export function simulateTrade(sym, idx, side, targetR, horizonMin) {
  const s = getSeries(sym), cfg = s.cfg, pip = cfg.pip_size, A = m15Atr(sym), kb = bucketBefore(A.start, idx);
  const a = A.a[kb - 1];
  if (!Number.isFinite(a)) return null;
  const stop = Math.max(0.8 * a, cfg.min_stop_pips * pip), sp = Math.max(spreadAt(sym, idx), cfg.spread_floor_pips) * pip, mid = s.c[idx];
  const buy = side === 'BUY', entry = buy ? mid + sp / 2 : mid - sp / 2;
  const sl = buy ? entry - stop : entry + stop, tp = buy ? entry + targetR * stop : entry - targetR * stop;
  let exitIdx = Math.min(s.n - 1, idx + horizonMin), reason = 'TIME', exit = null;
  for (let j = idx + 1; j <= Math.min(s.n - 1, idx + horizonMin); j++) {
    const lowB = s.l[j] - sp / 2, highB = s.h[j] - sp / 2, highA = s.h[j] + sp / 2, lowA = s.l[j] + sp / 2;
    if (buy ? lowB <= sl : highA >= sl) { exitIdx = j; reason = 'STOP'; exit = sl; break; }
    if (buy ? highB >= tp : lowA <= tp) { exitIdx = j; reason = 'TARGET'; exit = tp; break; }
  }
  if (exit == null) exit = buy ? s.c[exitIdx] - sp / 2 : s.c[exitIdx] + sp / 2;
  const k = 10 ** cfg.digits, rd = (x) => Math.round(x * k) / k;
  return { symbol: sym, side, entryIdx: idx, exitIdx, entry: rd(entry), exit: rd(exit), stop_loss: rd(sl), take_profit: rd(tp), exit_reason: reason, result_r: +rMultiple(side, rd(entry), rd(exit), rd(sl)).toFixed(3), opened_unix: s.t[idx] + 60, closed_unix: s.t[exitIdx] + 60 };
}

let _trades = null;
export function allTrades() {
  if (_trades) return _trades;
  const rng = rngFor('journal'), out = [], weights = [['XAUUSD', 0.34], ['EURUSD', 0.22], ['GBPUSD', 0.22], ['GBPJPY', 0.22]];
  const pickSym = () => { let r = rng.rnd(), acc = 0; for (const [s, w] of weights) { acc += w; if (r <= acc) return s; } return 'XAUUSD'; };
  const nowIdx = getSeries('XAUUSD').nowIndex;
  for (let k = 0; k < 120; k++) {
    const sym = pickSym(), idx = rng.int(1600, nowIdx - 240), st = rng.pick(STRATEGIES), tr = simulateTrade(sym, idx, rng.chance(0.5) ? 'BUY' : 'SELL', rng.pick([0.6, 1.0, 1.5]), HORIZON_MIN[st.horizon_s]);
    if (tr) out.push({ ...tr, strategy_id: st.id, tag: st.tag });
  }
  for (const [sym, side, hm, sid] of [['XAUUSD', 'BUY', 60, 'S06'], ['GBPJPY', 'SELL', 30, 'S05']]) {   // two positions that are still open at the demo clock
    for (let back = 40; back >= 1; back--) { const tr = simulateTrade(sym, nowIdx - back, side, 1.0, hm); if (tr && tr.exitIdx > nowIdx + 2) { out.push({ ...tr, strategy_id: sid, tag: STRATEGIES.find((x) => x.id === sid).tag, open_demo: true }); break; } }
  }
  out.sort((a, b) => a.opened_unix - b.opened_unix);
  out.forEach((t, i) => { t.id = `T-${String(i + 1).padStart(4, '0')}`; t.decision_id = `DEC-${String(i + 1).padStart(4, '0')}`; });
  return (_trades = out);
}
const idxFor = (t, cursor) => idxAt(t.symbol, cursor);
export const isClosedAt = (t, cursor) => t.exitIdx <= idxFor(t, cursor);
export const isOpenAt = (t, cursor) => t.entryIdx <= idxFor(t, cursor) && t.exitIdx > idxFor(t, cursor);
export const isVisibleAt = (t, cursor) => t.entryIdx <= idxFor(t, cursor);

export function tradeToContract(t, cursor) {
  const closed = isClosedAt(t, cursor), st = STRATEGIES.find((x) => x.id === t.strategy_id);
  return { id: t.id, symbol: t.symbol, side: t.side, strategy_id: t.strategy_id, opened_utc: unixToIso(t.opened_unix), closed_utc: closed ? unixToIso(t.closed_unix) : null, entry: t.entry, exit: closed ? t.exit : null, stop_loss: t.stop_loss, take_profit: t.take_profit, result_r: closed ? t.result_r : null, exit_reason: closed ? t.exit_reason : null, risk_pct: RISK_PCT, simulated: true, agent_decision_id: t.decision_id, tags: [t.tag, t.symbol.toLowerCase(), 'paper'], note: `Simulated on M1 candles (${strategyName(st)}). Stop checked before target; spread floor applied.` };
}
export function journalAt(cursor = 0) {
  const trades = allTrades().filter((t) => isVisibleAt(t, cursor));
  return { trades: trades.map((t) => tradeToContract(t, cursor)), decisions: trades.map((t) => ({ id: t.decision_id, t_utc: unixToIso(t.opened_unix - 60), agent: 'Risk Guardian', symbol: t.symbol, verdict: 'APPROVED (paper)', summary: `${t.side} ${t.symbol} ${strategyName(STRATEGIES.find((x) => x.id === t.strategy_id))}: risk ${RISK_PCT}% within limits`, outcome: isClosedAt(t, cursor) ? `${t.exit_reason} ${t.result_r >= 0 ? '+' : ''}${t.result_r}R` : 'open' })) };
}

export function accountAt(cursor = 0) {
  const all = allTrades().filter((t) => isVisibleAt(t, cursor)), closed = all.filter((t) => isClosedAt(t, cursor)).sort((a, b) => a.closed_unix - b.closed_unix), open = all.filter((t) => !isClosedAt(t, cursor));
  const riskAmt = INITIAL_EQUITY * RISK_PCT / 100, now = DEMO_NOW + cursor * 60, curve = [{ t: Math.floor(Date.UTC(2026, 8, 21) / 1000), equity: INITIAL_EQUITY, drawdown_pct: 0 }];
  let eq = INITIAL_EQUITY, peak = INITIAL_EQUITY, maxDd = 0;
  for (const t of closed) { eq += t.result_r * riskAmt; peak = Math.max(peak, eq); const dd = ((peak - eq) / peak) * 100; maxDd = Math.max(maxDd, dd); curve.push({ t: t.closed_unix, equity: +eq.toFixed(2), drawdown_pct: +dd.toFixed(3) }); }
  const positions = open.map((t) => { const s = getSeries(t.symbol), idx = idxAt(t.symbol, cursor), sp = Math.max(spreadAt(t.symbol, idx), s.cfg.spread_floor_pips) * s.cfg.pip_size, mark = t.side === 'BUY' ? s.c[idx] - sp / 2 : s.c[idx] + sp / 2; return { id: t.id, symbol: t.symbol, side: t.side, entry: t.entry, stop_loss: t.stop_loss, take_profit: t.take_profit, opened_utc: unixToIso(t.opened_unix), floating_r: +floatingR({ side: t.side, entry: t.entry, stop_loss: t.stop_loss }, mark).toFixed(3) }; });
  const floating = positions.reduce((a, p) => a + p.floating_r * riskAmt, 0), equity = eq + floating;
  peak = Math.max(peak, equity); const ddNow = ((peak - equity) / peak) * 100; maxDd = Math.max(maxDd, ddNow);
  curve.push({ t: now, equity: +equity.toFixed(2), drawdown_pct: +ddNow.toFixed(3) });
  const dayStart = Math.floor(now / 86400) * 86400, pnlSince = (t0) => closed.filter((t) => t.closed_unix >= t0).reduce((a, t) => a + t.result_r * riskAmt, 0) + floating;
  const bySym = {}; positions.forEach((p) => { bySym[p.symbol] = (bySym[p.symbol] || 0) + 1; });
  const total = Object.values(bySym).reduce((a, b) => a + b, 0) || 1;
  return { account: { label: 'PAPER (simulated)', currency: 'USD', initial: INITIAL_EQUITY, equity: +equity.toFixed(2), day_pnl: +pnlSince(dayStart).toFixed(2), week_pnl: +pnlSince(now - 7 * 86400).toFixed(2), drawdown_pct: +ddNow.toFixed(3), max_drawdown_pct: +maxDd.toFixed(3), risk_per_trade_pct: RISK_PCT, open_positions: positions, exposure: Object.entries(bySym).map(([symbol, n]) => ({ symbol, risk_r: n, share_pct: +((n / total) * 100).toFixed(1) })), limits: { daily_loss_pct: 1.0, max_drawdown_pct: 8, max_open_positions: 3, risk_per_trade_pct: RISK_PCT } }, equity_curve: curve, recent_outcomes: closed.slice(-24).map((t) => (Math.abs(t.result_r) < 0.05 ? 'B' : t.result_r > 0 ? 'W' : 'L')) };
}

const SPLITS = { train: ['2026-09-21', '2026-10-06'], validation: ['2026-10-08', '2026-10-13'], test: ['2026-10-15', '2026-10-16'] };
export function strategiesAt(seed = DEMO_LAB_SEED) {
  const rng = rngFor(seed), rows = [];
  STRATEGIES.forEach((st, i) => {
    const overfit = i === 4 || i === 7, nT = rng.int(70, 120), nV = rng.int(24, 40);
    const muT = overfit ? 0.05 + 0.03 * rng.rnd() : -0.17 + 0.1 * rng.normal(), muV = i === 7 ? 0.03 : overfit ? -0.1 + 0.05 * rng.normal() : muT + 0.07 * rng.normal();   // S08: a weak near-miss that still fails FDR
    const gen = (n, mu) => Array.from({ length: n }, () => Math.max(-1.6, Math.min(1.6, mu + 0.95 * rng.normal())));
    const rT = gen(nT, muT), rV = gen(nV, muV), days = (n, p) => Array.from({ length: n }, (_, k) => `${p}${Math.floor(k / 6)}`);
    const sT = summarize(rT), sV = summarize(rV), bT = bootstrapMeanCI(rT, days(nT, 't'), { seed: 'bt' + st.id }), bV = bootstrapMeanCI(rV, days(nV, 'v'), { seed: 'bv' + st.id });
    const sd = Math.sqrt(rV.reduce((a, x) => a + (x - sV.mean_r) ** 2, 0) / (nV - 1)), p = 1 - normalCdf(sV.mean_r / (sd / Math.sqrt(nV)));
    const cum = []; let c = 0; [...rT, ...rV].forEach((r) => { c += r; cum.push(+c.toFixed(3)); });
    const t0 = Date.UTC(2026, 8, 21) / 1000, step = Math.floor((Date.UTC(2026, 9, 14) / 1000 - t0) / cum.length);
    rows.push({ _p: p, row: { id: st.id, name: strategyName(st), pattern: st.pattern, action: st.action, horizon_s: st.horizon_s, regime: st.regime, status: 'REJECTED', p_adj: null,
      splits: { train: { trades: nT, mean_r: +sT.mean_r.toFixed(3), ci_low: +bT.ci_low.toFixed(3), ci_high: +bT.ci_high.toFixed(3), win_rate: +sT.win_rate.toFixed(3), profit_factor: +sT.profit_factor.toFixed(3), max_dd_r: +sT.max_dd_r.toFixed(2) }, validation: { trades: nV, mean_r: +sV.mean_r.toFixed(3), ci_low: +bV.ci_low.toFixed(3), ci_high: +bV.ci_high.toFixed(3), win_rate: +sV.win_rate.toFixed(3), profit_factor: +sV.profit_factor.toFixed(3), max_dd_r: +sV.max_dd_r.toFixed(2) }, test: { status: 'NOT_EVALUATED', trades: null, mean_r: null } },
      equity: { t: cum.map((_, k) => t0 + k * step), r_cum: cum, split_index: [nT, nT + nV] } } });
  });
  const adj = bhAdjust(rows.map((r) => r._p));
  rows.forEach((r, i) => { r.row.p_adj = +adj[i].toFixed(3); const sp = r.row.splits; r.row.status = r.row.p_adj <= 0.1 && sp.train.mean_r > 0 && sp.validation.mean_r > 0 ? 'ELIGIBLE' : sp.train.mean_r > 0 ? 'WAIT' : 'REJECTED'; });
  const params = {}; SYMBOLS.forEach((s) => { const c = SYMBOL_CFG[s]; params[s] = { pip_size: c.pip_size, spread_floor_pips: c.spread_floor_pips, max_spread_pips: c.max_spread_pips, min_stop_pips: c.min_stop_pips, max_spread_r: c.max_spread_r, stop_atr: 0.8, target_r: 0.6, horizons_s: [30, 60, 120], wick_ratio: 0.8, max_tick_gap_s: 5, latency_ms: 250 }; });
  return { strategies: rows.map((r) => r.row), split_plan: { ...Object.fromEntries(Object.entries(SPLITS).map(([k, v]) => [k, { from: v[0], to: v[1] }])), embargo_days: 1 }, params, gates: [{ name: 'Spread data quality', passed: true, detail: 'demo feed: zero-spread share within limit' }, { name: 'FDR-controlled validation (q = 0.10)', passed: false, detail: `0 of ${rows.length} candidates eligible` }, { name: 'Frozen test split', passed: null, detail: 'evaluated once, only for eligible candidates' }, { name: 'Forward DEMO evidence', passed: null, detail: 'not started' }] };
}

/** Deterministic DEMO backtest: shows how costs and geometry shift expectancy. Not a real engine run. */
export function runDemoBacktest(p) {
  const key = JSON.stringify(p), rng = rngFor('bt:' + key), stopPips = Math.max(p.min_stop_pips, 1), costR = p.spread_floor_pips / stopPips;
  const unreachable = costR > p.max_spread_r + 1e-12, n = 90, edge = 0.03 * rng.normal();
  const rs = unreachable ? [] : Array.from({ length: n }, () => Math.max(-1.6, Math.min(1.6, -costR + edge + 0.95 * rng.normal())));
  const s = summarize(rs), days = rs.map((_, k) => 'd' + Math.floor(k / 6)), b = bootstrapMeanCI(rs, days, { seed: 'ci:' + key });
  return { synthetic: true, cost_r: costR, unreachable_stop: unreachable, warning: unreachable ? `min_stop_pips=${p.min_stop_pips} is unreachable: floor/min_stop = ${(costR * 100).toFixed(0)}% > max_spread_r = ${(p.max_spread_r * 100).toFixed(0)}%` : null, trades: rs.length, mean_r: unreachable ? null : s.mean_r, ci_low: b.ci_low, ci_high: b.ci_high, win_rate: unreachable ? null : s.win_rate, profit_factor: unreachable ? null : s.profit_factor, max_dd_r: unreachable ? null : s.max_dd_r, r_cum: rs.reduce((a, r) => (a.push((a.at(-1) || 0) + r), a), []) };
}
export const demoMeanR = () => mean(allTrades().filter((t) => t.closed_unix <= DEMO_NOW).map((t) => t.result_r));

// Signals, opportunity scanner, AI-agent state and activity events, all derived from the demo market.
import { SYMBOLS, SYMBOL_CFG, DEMO_NOW, candlesAt, quoteAt, getSeries, idxAt, tfData } from './market.js';
import { STRATEGIES, allTrades, journalAt, accountAt, strategiesAt, strategyName } from './trading.js';
import { evaluateSignal } from '../../domain/signals.js';
import { analyze, pivots, sweeps } from '../../domain/structure.js';
import { atr } from '../../domain/indicators.js';
import { summarize } from '../../domain/stats.js';
import { unixToIso, fmtTime } from '../../core/format.js';
import { rngFor } from '../../core/prng.js';

const nowAt = (cursor) => DEMO_NOW + cursor * 60;
export function signalsAt(cursor = 0) {
  const out = [];
  for (const sym of SYMBOLS) for (const tf of ['M15', 'H1']) {
    const q = quoteAt(sym, cursor), cfg = SYMBOL_CFG[sym];
    out.push(evaluateSignal({ cfg, candles: candlesAt(sym, tf, cursor, 220), spreadPips: q.spread_pips, nowUnix: nowAt(cursor), timeframe: tf }));
  }
  return out;
}
export function scannerAt(cursor = 0) {
  const opps = [];
  for (const sym of SYMBOLS) for (const tf of ['M5', 'M15', 'H1']) {
    const c = candlesAt(sym, tf, cursor, 220), an = analyze(c), n = c.length, px = c[n - 1].c, a = atr(c, 14)[n - 1], q = quoteAt(sym, cursor), cfg = SYMBOL_CFG[sym];
    const near = an.zones.map((z) => ({ z, d: Math.min(Math.abs(px - z.lo), Math.abs(px - z.hi)) / a })).sort((x, y) => x.d - y.d)[0];
    const sw = an.sweeps.filter((s) => n - 1 - s.i <= 6).sort((x, y) => y.i - x.i)[0];
    let setup = null, direction = 'NEUTRAL', score = 0, note = '';
    if (sw) { setup = 'Liquidity sweep'; direction = sw.bias === 'BULLISH' ? 'BUY' : 'SELL'; score = 55 + Math.min(25, sw.wickAtr * 20); note = `${sw.kind === 'SELL_SIDE' ? 'Sell' : 'Buy'}-side sweep ${n - 1 - sw.i} candle(s) ago`; }
    else if (near && near.d < 0.6) { setup = near.z.type === 'support' ? 'Testing support' : 'Testing resistance'; direction = near.z.type === 'support' ? 'BUY' : 'SELL'; score = 35 + near.z.touches * 6 + (0.6 - near.d) * 20; note = `${near.z.touches} touches, ${near.d.toFixed(2)} ATR away`; }
    else if (an.trend.direction !== 'RANGE') { setup = 'Trend continuation'; direction = an.trend.direction === 'UP' ? 'BUY' : 'SELL'; score = 25 + an.trend.strength * 30; note = `${an.trend.structure}, strength ${(an.trend.strength * 100).toFixed(0)}%`; }
    if (!setup) continue;
    const stop = Math.max(0.8 * a, cfg.min_stop_pips * cfg.pip_size), ratio = Math.max(q.spread_pips, cfg.spread_floor_pips) * cfg.pip_size / stop;
    const blocked = ratio > cfg.max_spread_r;
    opps.push({ id: `OPP-${sym}-${tf}`, symbol: sym, timeframe: tf, setup, direction, score: Math.round(Math.min(85, score)), score_kind: 'heuristic', status: blocked ? 'BLOCKED' : sw ? 'ARMED' : 'WATCH', note: blocked ? `${note}; spread gate ${(ratio * 100).toFixed(0)}% of stop` : note });
  }
  return opps.sort((a, b) => b.score - a.score);
}

const AGENTS = [
  { id: 'observer', name: 'Market Observer', role: 'Reads feeds, detects regime, structure and liquidity sweeps' },
  { id: 'analyst', name: 'Signal Analyst', role: 'Turns structure into BUY / SELL / WAIT candidates with explanations' },
  { id: 'guardian', name: 'Risk Guardian', role: 'Independent veto: spread gate, limits, validation status' },
  { id: 'evaluator', name: 'Strategy Evaluator', role: 'Runs validation: day-block bootstrap, FDR, frozen test discipline' },
  { id: 'performance', name: 'Performance Analyst', role: 'Tracks paper results, drawdown and cost hurdle' },
];
const iso = (u) => unixToIso(u);
export function agentsAt(cursor = 0) {
  const now = nowAt(cursor), sigs = signalsAt(cursor), opps = scannerAt(cursor), acc = accountAt(cursor), jr = journalAt(cursor), lab = strategiesAt();
  const closed = jr.trades.filter((t) => t.result_r != null), sum = summarize(closed.map((t) => t.result_r));
  const an = Object.fromEntries(SYMBOLS.map((s) => [s, analyze(candlesAt(s, 'M15', cursor, 220))]));
  const actionable = sigs.filter((s) => s.action !== 'WAIT');
  const rng = rngFor('agents');
  const mk = (id, n) => `${id}-${String(n).padStart(3, '0')}`;
  const obsDecisions = SYMBOLS.map((s, i) => ({ id: mk('OBS', i + 1), t_utc: iso(now - 60 * (i + 1) * 3), symbol: s, verdict: an[s].regime, summary: `${s} regime ${an[s].regime}; trend ${an[s].trend.direction} (${an[s].trend.structure})`, explanation: [`${an[s].zones.length} active S/R zones`, `${an[s].sweeps.filter((x) => candlesAt(s, 'M15', cursor, 220).length - 1 - x.i <= 12).length} sweep(s) in the last 12 candles`, 'Pivots confirmed 3 candles after they form (no look-ahead)'], confidence: null }));
  const sigDecisions = sigs.filter((s) => s.timeframe === 'M15').map((s, i) => ({ id: mk('SIG', i + 1), t_utc: iso(now - 60 * (i + 1) * 4), symbol: s.symbol, verdict: s.action, summary: s.action === 'WAIT' ? `${s.symbol} M15: WAIT` : `${s.symbol} M15: ${s.action} candidate, R:R ${s.risk_reward}`, explanation: s.reasons.map((r) => r.text), confidence: null }));
  const guardDecisions = (actionable.length ? actionable : sigs.slice(0, 2)).slice(0, 5).map((s, i) => ({ id: mk('RSK', i + 1), t_utc: iso(now - 60 * (i + 1) * 4 + 20), symbol: s.symbol, verdict: s.action === 'WAIT' ? 'NO ACTION' : 'VETO (research mode)', summary: s.action === 'WAIT' ? `${s.symbol}: nothing to approve` : `${s.symbol} ${s.action} candidate vetoed`, explanation: s.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`), confidence: null }));
  const evDecisions = lab.strategies.slice(0, 5).map((s, i) => ({ id: mk('EVL', i + 1), t_utc: iso(now - 3600 * (i + 1)), symbol: null, verdict: s.status, summary: `${s.id} ${s.name}: ${s.status}`, explanation: [`validation mean ${s.splits.validation.mean_r}R (CI ${s.splits.validation.ci_low} to ${s.splits.validation.ci_high})`, `FDR-adjusted p = ${s.p_adj} (needs <= 0.10)`, 'Test split stays frozen until a candidate is eligible'], confidence: null }));
  const perfDecisions = [{ id: mk('PRF', 1), t_utc: iso(now - 1800), symbol: null, verdict: 'REPORT', summary: `Paper results: ${closed.length} trades, mean ${sum.mean_r.toFixed(3)}R, win rate ${(sum.win_rate * 100).toFixed(0)}%`, explanation: [`profit factor ${sum.profit_factor.toFixed(2)}, max drawdown ${sum.max_dd_r.toFixed(1)}R`, 'Mean R is below zero: consistent with the spread/stop cost hurdle (research finding)', 'Scenarios are simulations, not executed trades'], confidence: null }, { id: mk('PRF', 2), t_utc: iso(now - 7200), symbol: null, verdict: 'ALERT', summary: `Drawdown ${acc.account.drawdown_pct.toFixed(1)}% of ${acc.account.limits.max_drawdown_pct}% limit`, explanation: ['Within limits', 'Risk Guardian notified'], confidence: null }];
  const logs = (prefix, lines) => lines.map(([dt, level, msg]) => ({ t_utc: iso(now - dt), level, msg: `${prefix} ${msg}` }));
  const st = (id) => ({ observer: 'ACTIVE', analyst: 'ACTIVE', guardian: 'ACTIVE', evaluator: 'IDLE', performance: 'ACTIVE' }[id]);
  const detail = {
    observer: { task: `Scanning ${SYMBOLS.length} symbols x 3 timeframes`, metrics: [['Symbols watched', '4'], ['Regimes', SYMBOLS.map((s) => `${s} ${an[s].regime}`).join(', ')], ['Opportunities flagged', String(opps.length)], ['Scan interval', '10 s (demo)']], decisions: obsDecisions, log: logs('observer', [[20, 'INFO', 'scan complete: 12 market views'], [320, 'INFO', `regime refresh: ${SYMBOLS.map((s) => an[s].regime).join('/')}`], [900, 'WARN', 'GBPJPY spread above 1.35x baseline for 4 min'], [1800, 'INFO', 'pivot confirmation lag = 3 candles']]) },
    analyst: { task: 'Evaluating M15 and H1 structure', metrics: [['Signals now', `${actionable.length} actionable / ${sigs.length - actionable.length} WAIT`], ['Validated edge', 'none'], ['Probability shown', 'never (no validated data)']], decisions: sigDecisions, log: logs('analyst', [[40, 'INFO', `${sigs.length} signals evaluated`], [640, 'INFO', 'spread gate applied to every candidate'], [1500, 'WARN', 'no validated edge: signals are illustrative']]) },
    guardian: { task: 'Gatekeeping every candidate', metrics: [['Open paper positions', `${acc.account.open_positions.length} / ${acc.account.limits.max_open_positions}`], ['Drawdown', `${acc.account.drawdown_pct.toFixed(2)}% of ${acc.account.limits.max_drawdown_pct}%`], ['Risk per trade', `${acc.account.risk_per_trade_pct}%`], ['Trading', 'DISABLED (research build)']], decisions: guardDecisions, log: logs('guardian', [[30, 'INFO', 'limits OK: daily loss, drawdown, open positions'], [700, 'WARN', 'vetoed candidate: execution disabled'], [2400, 'INFO', 'kill switch engaged by default']]) },
    evaluator: { task: 'Idle: waiting for the next data window', metrics: [['Candidates', '144 in V7.2 family'], ['Eligible', '0'], ['FDR level q', '0.10'], ['Frozen test', 'not evaluated']], decisions: evDecisions, log: logs('evaluator', [[1800, 'INFO', 'candidate table recomputed (day-block bootstrap, 400 resamples)'], [1810, 'INFO', 'BH-FDR applied over the declared family'], [3600, 'WARN', 'no candidate passed validation']]) },
    performance: { task: 'Updating paper statistics', metrics: [['Trades (paper)', String(closed.length)], ['Mean R', sum.mean_r.toFixed(3)], ['Win rate', `${(sum.win_rate * 100).toFixed(0)}%`], ['Profit factor', sum.profit_factor.toFixed(2)]], decisions: perfDecisions, log: logs('performance', [[60, 'INFO', 'equity curve updated'], [3000, 'INFO', 'cost hurdle: mean R below zero']]) },
  };
  const agents = AGENTS.map((a, i) => ({ ...a, state: st(a.id), task: detail[a.id].task, uptime_s: 86400 * 3 + 3600 * (i + 2) + (cursor * 60), last_heartbeat_utc: iso(now - (3 + i * 2)), metrics: detail[a.id].metrics.map(([label, value]) => ({ label, value })), decisions: detail[a.id].decisions, log: detail[a.id].log }));
  const messages = [['observer', 'analyst', 'regime update'], ['analyst', 'guardian', 'signal candidate'], ['guardian', 'analyst', 'veto: validation missing'], ['evaluator', 'performance', 'candidate table'], ['performance', 'guardian', 'drawdown report'], ['observer', 'guardian', 'spread alert']].map(([from, to, topic], i) => ({ t_utc: iso(now - 45 * (i + 1)), from, to, topic }));
  return { agents, messages };
}

export function eventsAt(cursor = 0) {
  const now = nowAt(cursor), ev = [];
  for (const sym of SYMBOLS) {
    const c = candlesAt(sym, 'M5', cursor, 400), sw = sweeps(c, pivots(c, 3));
    for (const s of sw.filter((x) => c.length - 1 - x.i <= 96)) ev.push({ id: `EV-${sym}-${c[s.i].t}`, t_utc: iso(c[s.i].t + 300), type: 'data', severity: 'info', title: `${sym} ${s.kind === 'SELL_SIDE' ? 'sell-side' : 'buy-side'} liquidity sweep`, detail: `M5, level ${s.level}, bias ${s.bias}`, symbol: sym });
  }
  for (const t of allTrades()) {
    if (t.entryIdx <= idxAt(t.symbol, cursor)) ev.push({ id: `EV-${t.id}-o`, t_utc: iso(t.opened_unix), type: 'risk', severity: 'info', title: `Paper ${t.side} ${t.symbol} opened`, detail: `${t.id}: risk 0.25%, SL ${t.stop_loss}`, symbol: t.symbol });
    if (t.exitIdx <= idxAt(t.symbol, cursor)) ev.push({ id: `EV-${t.id}-c`, t_utc: iso(t.closed_unix), type: 'risk', severity: t.result_r > 0 ? 'ok' : 'warn', title: `Paper ${t.symbol} closed ${t.exit_reason}`, detail: `${t.id}: ${t.result_r >= 0 ? '+' : ''}${t.result_r}R`, symbol: t.symbol });
  }
  const scripted = [[420, 'ci', 'ok', 'CI: safety (ubuntu-latest) passed', 'branch develop'], [900, 'system', 'warn', 'MT5 link not configured (demo)', 'history-only mode planned'], [2400, 'agent', 'info', 'Strategy Evaluator recomputed candidate table', '0 of 10 eligible'], [5400, 'ci', 'ok', 'CI: baseline guard passed', 'V7.2 files unchanged']];
  scripted.forEach(([dt, type, severity, title, detail], i) => ev.push({ id: `EV-SCR-${i}`, t_utc: iso(now - dt), type, severity, title, detail, symbol: null }));
  return ev.filter((e) => Date.parse(e.t_utc) / 1000 <= now).sort((a, b) => (a.t_utc < b.t_utc ? 1 : -1)).slice(0, 80);
}

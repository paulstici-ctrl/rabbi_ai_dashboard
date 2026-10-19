// Demo rule engine: turns market structure into BUY / SELL / WAIT with explanations.
// It is an ILLUSTRATION of how a signal card is built, NOT a validated strategy: probability stays null.
import { atr, closes, ema, last } from './indicators.js';
import { analyze } from './structure.js';
import { riskReward, spreadGate } from './risk.js';

const RULE_NOTE = 'Illustrative rule engine. No validated edge exists (research verdict WAIT), so no probability is shown.';

export function evaluateSignal({ cfg, candles, spreadPips, nowUnix, timeframe = 'M15' }) {
  const n = candles.length, pip = cfg.pip_size;
  const base = { id: `SIG-${cfg.symbol}-${timeframe}-${nowUnix}`, symbol: cfg.symbol, timeframe, created_utc: new Date(nowUnix * 1000).toISOString().replace('.000Z', 'Z'), probability: null, validation: { status: 'unvalidated', source: null }, note: RULE_NOTE };
  const a = atr(candles, 14)[n - 1];
  if (n < 80 || !Number.isFinite(a)) return { ...base, action: 'WAIT', entry: null, stop_loss: null, take_profit: null, risk_reward: null, reasons: [{ kind: 'con', text: 'Not enough candles to evaluate structure.' }], checks: [{ name: 'Data', passed: false, detail: `${n} candles loaded` }] };
  const an = analyze(candles), px = last(candles).c, e20 = last(ema(closes(candles), 20));
  const stopBase = Math.max(0.8 * a, cfg.min_stop_pips * pip);
  const gate = spreadGate({ spreadPips, floorPips: cfg.spread_floor_pips, stopPrice: stopBase, pip, maxSpreadR: cfg.max_spread_r });
  const recent = an.sweeps.filter((s) => n - 1 - s.i <= 8).sort((x, y) => y.i - x.i)[0];
  const pullback = Math.abs(px - e20) <= 0.6 * a;
  let side = null; const reasons = [];
  if (recent) { side = recent.bias === 'BULLISH' ? 'BUY' : 'SELL'; reasons.push({ kind: 'pro', text: `${recent.kind === 'SELL_SIDE' ? 'Sell-side' : 'Buy-side'} liquidity sweep ${n - 1 - recent.i} candle(s) ago, closed back ${recent.bias === 'BULLISH' ? 'above' : 'below'} ${recent.level.toFixed(cfg.digits)}.` }); }
  else if (an.trend.direction === 'UP' && pullback) { side = 'BUY'; reasons.push({ kind: 'pro', text: `Uptrend (${an.trend.structure}) with a pullback to the 20-EMA.` }); }
  else if (an.trend.direction === 'DOWN' && pullback) { side = 'SELL'; reasons.push({ kind: 'pro', text: `Downtrend (${an.trend.structure}) with a pullback to the 20-EMA.` }); }
  else reasons.push({ kind: 'info', text: `No trigger: regime ${an.regime}, trend ${an.trend.direction}, no recent sweep.` });
  reasons.push({ kind: 'info', text: `ATR(14) = ${(a / pip).toFixed(0)} pips; stop distance ${(stopBase / pip).toFixed(0)} pips.` });
  const checks = [
    { name: 'Spread gate', passed: gate.passed, detail: `effective spread ${gate.effectivePips.toFixed(1)} pips = ${(gate.ratio * 100).toFixed(0)}% of stop (limit ${(cfg.max_spread_r * 100).toFixed(0)}%)` },
    { name: 'Structure trigger', passed: !!side, detail: side ? 'sweep or trend pullback found' : 'none found' },
    { name: 'Validated edge', passed: false, detail: 'No strategy has passed FDR-controlled validation' },
    { name: 'Execution', passed: false, detail: 'Trading disabled in this build (research only)' },
  ];
  if (!side) return { ...base, action: 'WAIT', entry: null, stop_loss: null, take_profit: null, risk_reward: null, reasons, checks };
  if (!gate.passed) { reasons.push({ kind: 'con', text: `Blocked: spread would consume ${(gate.ratio * 100).toFixed(0)}% of the stop (limit ${(cfg.max_spread_r * 100).toFixed(0)}%).` }); return { ...base, action: 'WAIT', entry: null, stop_loss: null, take_profit: null, risk_reward: null, reasons, checks }; }
  const buy = side === 'BUY', entry = px;
  let sl = buy ? Math.min(entry - stopBase, ...(recent ? [recent.level - 0.25 * a] : [])) : Math.max(entry + stopBase, ...(recent ? [recent.level + 0.25 * a] : []));
  const risk = Math.abs(entry - sl);
  const opp = an.zones.filter((z) => (buy ? z.lo > entry + risk : z.hi < entry - risk)).sort((x, y) => (buy ? x.lo - y.lo : y.hi - x.hi))[0];
  const tp = opp ? (buy ? opp.lo : opp.hi) : (buy ? entry + 1.5 * risk : entry - 1.5 * risk);
  reasons.push({ kind: 'info', text: opp ? `Target at the nearest ${buy ? 'resistance' : 'support'} zone.` : 'No opposing zone found: target set to 1.5R.' });
  return { ...base, action: side, entry, stop_loss: sl, take_profit: tp, risk_reward: +riskReward(side, entry, sl, tp).toFixed(2), reasons, checks };
}

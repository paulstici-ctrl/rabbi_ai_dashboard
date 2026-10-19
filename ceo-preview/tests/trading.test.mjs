import test from 'node:test';
import assert from 'node:assert/strict';
import { allTrades, journalAt, accountAt, strategiesAt, runDemoBacktest, simulateTrade, INITIAL_EQUITY } from '../src/data/demo/trading.js';
import { getSeries } from '../src/data/demo/market.js';
import { bhAdjust } from '../src/domain/stats.js';

test('trades are deterministic and consistent with the candle path', () => {
  const a = allTrades(), b = allTrades(); assert.equal(a.length, b.length); assert.ok(a.length >= 100);
  for (const t of a) {
    assert.ok(['TARGET', 'STOP', 'TIME'].includes(t.exit_reason)); assert.ok(t.closed_unix >= t.opened_unix);
    if (t.exit_reason === 'STOP') assert.ok(t.result_r < -0.9 && t.result_r > -1.3, `${t.id} ${t.result_r}`);
    if (t.exit_reason === 'TARGET') assert.ok(t.result_r > 0.5);
    assert.ok(t.side === 'BUY' ? t.stop_loss < t.entry && t.take_profit > t.entry : t.stop_loss > t.entry && t.take_profit < t.entry);
  }
});
test('two simulated positions are open at the demo clock and none is hidden or leaked', () => {
  const j = journalAt(0), open = j.trades.filter((t) => t.closed_utc === null);
  assert.equal(open.length, 2); assert.ok(open.every((t) => t.exit === null && t.result_r === null && t.simulated === true));
  assert.equal(j.decisions.length, j.trades.length);
});
test('replaying forward can only add trades and close open ones', () => {
  const n0 = journalAt(0).trades.length, n1 = journalAt(120).trades.length; assert.ok(n1 >= n0);
  assert.ok(journalAt(240).trades.filter((t) => t.closed_utc !== null).length >= journalAt(0).trades.filter((t) => t.closed_utc !== null).length);
});
test('paper account is internally consistent and honest about costs', () => {
  const a = accountAt(0), acc = a.account;
  assert.equal(acc.initial, INITIAL_EQUITY); assert.ok(acc.max_drawdown_pct >= acc.drawdown_pct); assert.ok(acc.open_positions.length === 2);
  const last = a.equity_curve.at(-1); assert.ok(Math.abs(last.equity - acc.equity) < 0.01);
  const closed = journalAt(0).trades.filter((t) => t.result_r != null); const mean = closed.reduce((s, t) => s + t.result_r, 0) / closed.length;
  assert.ok(mean < 0.15, 'demo trades must not paint an unrealistically profitable picture; mean R=' + mean);
  assert.ok(a.recent_outcomes.every((x) => 'WLB'.includes(x)));
});
test('strategies: nothing is eligible, test split is not evaluated, FDR adjusted p in [0,1]', () => {
  const s = strategiesAt(); assert.equal(s.strategies.length, 10);
  for (const r of s.strategies) { assert.notEqual(r.status, 'ELIGIBLE'); assert.equal(r.splits.test.status, 'NOT_EVALUATED'); assert.ok(r.p_adj >= 0 && r.p_adj <= 1); assert.ok(r.splits.train.ci_low < r.splits.train.ci_high); }
  assert.deepEqual(strategiesAt(), s);
  assert.deepEqual(bhAdjust([0.001, 0.02, 0.04, 0.5]).map((x) => +x.toFixed(4)), [0.004, 0.04, 0.0533, 0.5]);
});
test('lab demo is honest: status rule is consistent, nothing eligible, no rosy equity curves', () => {
  const rows = strategiesAt().strategies;
  for (const r of rows) {
    const elig = r.p_adj <= 0.1 && r.splits.train.mean_r > 0 && r.splits.validation.mean_r > 0;
    assert.equal(r.status === 'ELIGIBLE', elig, r.id); assert.ok(Math.abs(r.equity.r_cum.at(-1)) < 60, r.id + ' curve');
    assert.ok(r.splits.train.mean_r < 0.3 && r.splits.validation.mean_r < 0.3, r.id + ' mean R');
  }
  assert.ok(Math.max(...rows.map((r) => r.equity.r_cum.at(-1))) < 15, 'no strategy ends above +15R');
  assert.ok(rows.some((r) => r.splits.train.mean_r > 0 && r.splits.validation.mean_r < 0), 'demo includes an overfit illustration');
});
test('demo backtest reacts to the unreachable-stop trap and is deterministic', () => {
  const base = { pip_size: 0.01, spread_floor_pips: 40, max_spread_pips: 80, min_stop_pips: 150, max_spread_r: 0.25, stop_atr: 0.8, target_r: 0.6, horizons_s: [30, 60, 120], wick_ratio: 0.8, max_tick_gap_s: 5, latency_ms: 250 };
  const bad = runDemoBacktest(base); assert.equal(bad.unreachable_stop, true); assert.ok(bad.warning.includes('unreachable')); assert.equal(bad.trades, 0);
  const ok = runDemoBacktest({ ...base, min_stop_pips: 160 }); assert.equal(ok.unreachable_stop, false); assert.deepEqual(ok, runDemoBacktest({ ...base, min_stop_pips: 160 }));
  assert.ok(ok.mean_r < 0.1 && ok.synthetic === true);
});
test('simulateTrade refuses to start without ATR history', () => { assert.equal(simulateTrade('EURUSD', 5, 'BUY', 1, 15), null); });

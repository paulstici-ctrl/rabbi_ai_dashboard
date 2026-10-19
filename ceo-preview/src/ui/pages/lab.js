// Strategy Lab: strategy table, equity curves with train/validation/frozen-test bands, comparison, per-symbol parameters, demo backtest.
import { html, raw } from '../../core/dom.js';
import { fmtNum, fmtSigned, signClass, fmtPct } from '../../core/format.js';
import { panel, chip, stat, table, kv, stateChip, seg, btn, bar, empty, demoBadge } from '../components/index.js';
import { LineChart } from '../charts/line-chart.js';
import { validateParams } from '../../domain/params.js';

const COLORS = ['#5ee7ff', '#8b7bff', '#ffb347', '#2ee6a6', '#ff5577', '#4da3ff'];
const PARAM_FIELDS = [['spread_floor_pips', 'Spread floor (pips)', 0.1], ['max_spread_pips', 'Max spread (pips)', 0.1], ['min_stop_pips', 'Min stop (pips)', 1], ['max_spread_r', 'Max spread / stop', 0.01], ['stop_atr', 'Stop (× ATR)', 0.05], ['target_r', 'Target (R)', 0.1], ['wick_ratio', 'Wick ratio', 0.05], ['max_tick_gap_s', 'Max tick gap (s)', 0.5], ['latency_ms', 'Latency (ms)', 50]];
const st = { sel: ['S08', 'S06'], focus: 'S08', symbol: 'XAUUSD', params: null, bt: null, sort: { key: 'val', dir: 'desc' } };
let chart = null, btChart = null;
const strat = (ctx) => ctx.s.strategies?.strategies || [];
const byId = (ctx, id) => strat(ctx).find((s) => s.id === id);
const ci = (b) => (b.ci_low == null ? '' : `[${fmtNum(b.ci_low)}, ${fmtNum(b.ci_high)}]`);
const sortVal = { val: (s) => s.splits.validation.mean_r, train: (s) => s.splits.train.mean_r, p: (s) => s.p_adj, id: (s) => s.id };
function ciBar(b) { if (b.ci_low == null) return ''; const pos = (v) => Math.max(0, Math.min(100, ((v + 1) / 2) * 100)); return html`<div class="ci" title="mean ${fmtNum(b.mean_r)} R, 95% CI ${ci(b)}"><i class="ci__zero"></i><b class="ci__w" data-l="${pos(b.ci_low)}" data-w="${Math.max(1, pos(b.ci_high) - pos(b.ci_low))}"></b><b class="ci__m" data-l="${pos(b.mean_r)}"></b></div>`; }

const regions = {
  table: { deps: ['ui'], render: (ctx) => {
    const rows = [...strat(ctx)].sort((a, b) => (sortVal[st.sort.key](a) - sortVal[st.sort.key](b)) * (st.sort.dir === 'asc' ? 1 : -1) || a.id.localeCompare(b.id));
    return table({ rows, rowId: (r) => r.id, sortKey: st.sort.key, sortDir: st.sort.dir, rowClass: (r) => (r.id === st.focus ? 'is-focus' : ''), columns: [
      { key: 'cmp', label: 'Cmp', render: (r) => html`<input type="checkbox" aria-label="Compare ${r.id}" data-action="l-compare" data-value="${r.id}" ${raw(st.sel.includes(r.id) ? 'checked' : '')}/>` },
      { key: 'id', label: 'Strategy', sortable: true, render: (r) => html`<a href="#" data-action="l-focus" data-value="${r.id}"><b>${r.id}</b></a> <span class="dim small">${r.pattern.replace(/_/g, ' ').toLowerCase()} · ${r.action.toLowerCase()} · ${r.horizon_s}s · ${r.regime.replace('_', ' ').toLowerCase()}</span>` },
      { key: 'train', label: 'Train R', align: 'right', sortable: true, render: (r) => html`<span class="mono ${signClass(r.splits.train.mean_r)}">${fmtSigned(r.splits.train.mean_r, 3)}</span>` },
      { key: 'val', label: 'Valid. R', align: 'right', sortable: true, render: (r) => html`<span class="mono ${signClass(r.splits.validation.mean_r)}">${fmtSigned(r.splits.validation.mean_r, 3)}</span>` },
      { key: 'p', label: 'p (FDR)', align: 'right', sortable: true, render: (r) => html`<span class="mono">${r.p_adj.toFixed(3)}</span>` },
      { key: 'st', label: 'Status', render: (r) => stateChip(r.status) },
    ] });
  } },
  chart: { deps: [], render: () => html`<div class="lab-chart" data-lab-chart></div>` },
  splits: { deps: ['ui'], render: (ctx) => {
    const s = byId(ctx, st.focus), plan = ctx.s.strategies?.split_plan; if (!s) return empty('Select a strategy');
    const row = (name, b, dates) => ({ name, b, dates });
    const rows = [row('TRAIN', s.splits.train, `${plan.train.from} → ${plan.train.to}`), row('VALIDATION', s.splits.validation, `${plan.validation.from} → ${plan.validation.to}`)];
    return html`<div class="lbl">// ${s.id} · ${s.name}</div>${table({ rows, columns: [{ key: 'n', label: 'Split', render: (r) => html`<b>${r.name}</b><div class="dim small">${r.dates}</div>` }, { key: 't', label: 'Trades', align: 'right', render: (r) => r.b.trades }, { key: 'm', label: 'Mean R', align: 'right', render: (r) => html`<span class="mono ${signClass(r.b.mean_r)}">${fmtSigned(r.b.mean_r, 3)}</span><div class="dim small mono">${ci(r.b)}</div>` }, { key: 'w', label: 'Win', align: 'right', render: (r) => fmtPct(r.b.win_rate * 100, 0).replace('+', '') }, { key: 'pf', label: 'PF', align: 'right', render: (r) => fmtNum(r.b.profit_factor) }, { key: 'dd', label: 'Max DD', align: 'right', render: (r) => `${r.b.max_dd_r}R` }] })}
      <div class="split-test"><b>TEST</b> <span class="dim small">${plan.test.from} → ${plan.test.to}</span> ${chip('FROZEN · NOT EVALUATED', 'violet')}<span class="dim small"> evaluated once, only for eligible candidates (embargo ${plan.embargo_days} day between splits)</span></div>
      <div class="lbl mt">// VALIDATION GATES</div><div class="checks">${ctx.s.strategies.gates.map((g) => html`<div class="check ${g.passed === true ? 'check--ok' : g.passed === false ? 'check--no' : 'check--na'}"><i>${g.passed === true ? '✓' : g.passed === false ? '✕' : '…'}</i><b>${g.name}</b><span class="dim small">${g.detail}</span></div>`)}</div>`;
  } },
  compare: { deps: ['ui'], render: (ctx) => {
    const rows = st.sel.map((id) => byId(ctx, id)).filter(Boolean);
    if (!rows.length) return empty('Tick strategies in the table to compare them');
    return html`${table({ rows, columns: [{ key: 'id', label: 'Strategy', render: (r) => html`<i class="swatch" data-bg="${COLORS[st.sel.indexOf(r.id) % COLORS.length]}"></i><b>${r.id}</b>` }, { key: 'ci', label: 'Validation mean R · 95% CI', render: (r) => html`${ciBar(r.splits.validation)}<span class="dim small mono">${fmtSigned(r.splits.validation.mean_r, 3)} ${ci(r.splits.validation)}</span>` }, { key: 'w', label: 'Win', align: 'right', render: (r) => fmtPct(r.splits.validation.win_rate * 100, 0).replace('+', '') }, { key: 'pf', label: 'PF', align: 'right', render: (r) => fmtNum(r.splits.validation.profit_factor) }, { key: 'dd', label: 'DD', align: 'right', render: (r) => `${r.splits.validation.max_dd_r}R` }, { key: 'p', label: 'p (FDR)', align: 'right', render: (r) => r.p_adj.toFixed(3) }] })}<p class="foot">A confidence interval that includes 0 means the result is indistinguishable from no edge. With a family of ${strat(ctx).length} candidates, p-values are FDR-adjusted (q = 0.10).</p>`;
  } },
  params: { deps: ['plab'], render: (ctx) => {
    const p = st.params?.[st.symbol]; if (!p) return '';
    return html`<div class="params-head">${seg('l-symbol', ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY'], st.symbol)}</div><div class="params">${PARAM_FIELDS.map(([k, label, step]) => html`<label>${label}<input type="number" step="${step}" value="${p[k]}" data-input="l-param" data-key="${k}"/></label>`)}</div><div data-validation>${validationHtml()}</div><div class="params-actions">${btn('Run demo backtest', 'l-run', { variant: 'primary' })}${btn('Reset parameters', 'l-reset', { variant: 'ghost' })}</div>`;
  } },
  backtest: { deps: ['bt'], render: () => {
    const r = st.bt; if (!r) return html`<p class="dim small">Run a demo backtest to see how costs and geometry move expectancy. Results are deterministic and synthetic: a teaching tool, not an engine run.</p>`;
    if (r.unsupported) return html`<div class="notice notice--amber">Backtests run in the Python engine. This data source is read-only.</div>`;
    return html`<div class="bt"><div class="bt__h">${demoBadge('SYNTHETIC BACKTEST')}<b>${st.symbol}</b><span class="dim small">cost hurdle ${(r.cost_r * 100).toFixed(0)}% of stop</span></div>${r.warning ? html`<div class="notice notice--red">${r.warning}</div>` : html`<div class="kpis kpis--s">${stat({ label: 'TRADES', value: r.trades })}${stat({ label: 'MEAN R', value: fmtSigned(r.mean_r, 3), tone: signClass(r.mean_r) })}${stat({ label: '95% CI', value: `${fmtNum(r.ci_low)} … ${fmtNum(r.ci_high)}` })}${stat({ label: 'WIN RATE', value: fmtPct(r.win_rate * 100, 0).replace('+', '') })}${stat({ label: 'PROFIT FACTOR', value: fmtNum(r.profit_factor) })}${stat({ label: 'MAX DD', value: `${fmtNum(r.max_dd_r, 1)}R` })}</div><div class="bt__chart" data-bt-chart></div>`}</div>`;
  } },
};
function validationHtml() {
  const v = validateParams(st.params[st.symbol]);
  return html`${v.errors.map((e) => html`<div class="notice notice--red">✕ ${e}</div>`)}${v.warnings.map((w) => html`<div class="notice notice--amber">! ${w}</div>`)}${v.ok && !v.warnings.length ? html`<div class="notice notice--green">✓ Parameters consistent. Cost hurdle ≈ ${(v.costR * 100).toFixed(0)}% of the stop per trade.</div>` : ''}<div class="dim small">Cost hurdle: a zero-edge strategy loses about spread ÷ stop per trade.</div>`;
}
function drawChart(ctx) {
  if (!chart) return;
  const s = byId(ctx, st.focus), plan = ctx.s.strategies?.split_plan; if (!s) return;
  const series = st.sel.map((id, k) => { const x = byId(ctx, id); return x && { id, name: id, color: COLORS[k % COLORS.length], width: id === st.focus ? 2.2 : 1.4, points: x.equity.t.map((t, i) => [t, x.equity.r_cum[i]]), fill: id === st.focus && st.sel.length === 1 }; }).filter(Boolean);
  const f = byId(ctx, st.focus), t = f.equity.t, [a, b] = f.equity.split_index, end = t.at(-1), step = t[1] - t[0];
  chart.setSeries(series); chart.setBands([{ x0: t[0], x1: t[Math.min(a, t.length - 1)], color: '#5ee7ff', label: 'TRAIN' }, { x0: t[Math.min(a, t.length - 1)], x1: end, color: '#8b7bff', label: 'VALIDATION' }, { x0: end, x1: end + step * 18, color: '#ffb347', label: 'TEST · FROZEN' }]);
}
export default {
  id: 'lab', title: 'Strategy Lab', regions, needs: ['strategies'],
  layout: (r) => html`<div class="lb"><div class="lb__table">${panel({ title: 'STRATEGIES', sub: 'candidates · V7.2 family (demo)', actions: demoBadge(), body: r.table, className: 'p-flush' })}</div>
    <div class="lb__chart">${panel({ title: 'EQUITY CURVES', sub: 'cumulative R · train / validation / frozen test', body: r.chart, hero: true })}</div>
    <div class="lb__splits">${panel({ title: 'SPLITS & GATES', sub: 'chronological, with embargo', body: r.splits })}</div>
    <div class="lb__compare">${panel({ title: 'COMPARE', sub: 'selected strategies', body: r.compare, className: 'p-flush' })}</div>
    <div class="lb__params">${panel({ title: 'PARAMETERS PER SYMBOL', sub: 'edit locally · validated like the engine', body: r.params })}${panel({ title: 'BACKTEST', sub: 'demo', body: r.backtest })}</div></div>`,
  mount(el, ctx) {
    const s = ctx.s.strategies; if (!st.params) st.params = JSON.parse(JSON.stringify(s.params));
    chart = new LineChart(el.querySelector('[data-lab-chart]'), { yFormat: (v) => `${v.toFixed(1)}R`, xFormat: (x) => new Date(x * 1000).toISOString().slice(5, 10) });
    ctx.refresh(['plab']); drawChart(ctx);
    return () => { chart?.destroy(); btChart?.destroy(); chart = btChart = null; };
  },
  afterRegion(name, el, ctx) { if (name === 'backtest') { btChart?.destroy(); btChart = null; const host = el.querySelector('[data-bt-chart]'); if (host && st.bt?.r_cum) { btChart = new LineChart(host, { compact: true, yFormat: (v) => v.toFixed(0) }); btChart.setSeries([{ id: 'bt', name: 'R', color: '#8b7bff', points: st.bt.r_cum.map((v, i) => [i, v]), fill: true }]); } } },
  actions: {
    'l-focus': (ctx, el, e) => { e.preventDefault(); st.focus = el.dataset.value; if (!st.sel.includes(st.focus)) st.sel = [...st.sel.slice(-3), st.focus]; ctx.refresh(['ui']); drawChart(ctx); },
    'l-compare': (ctx, el) => { const id = el.dataset.value; st.sel = st.sel.includes(id) ? st.sel.filter((x) => x !== id) : [...st.sel.slice(-3), id]; if (!st.sel.includes(st.focus) && st.sel.length) st.focus = st.sel[st.sel.length - 1]; ctx.refresh(['ui']); drawChart(ctx); },
    sort: (ctx, el) => { const k = el.dataset.sort; st.sort = { key: k, dir: st.sort.key === k && st.sort.dir === 'desc' ? 'asc' : 'desc' }; ctx.refresh(['ui']); },
    row: () => {},
    'l-symbol': (ctx, el) => { st.symbol = el.dataset.value; ctx.refresh(['plab']); },
    'l-reset': (ctx) => { st.params[st.symbol] = JSON.parse(JSON.stringify(ctx.s.strategies.params[st.symbol])); ctx.refresh(['plab']); },
    'l-run': async (ctx) => { const v = validateParams(st.params[st.symbol]); st.bt = await ctx.provider.runBacktest({ ...st.params[st.symbol] }); ctx.refresh(['bt']); ctx.toast(v.ok ? 'Demo backtest finished (synthetic)' : 'Parameters rejected by the consistency check', v.ok ? 'info' : 'warn'); },
  },
  inputs: { 'l-param': (ctx, el) => { st.params[st.symbol][el.dataset.key] = Number(el.value); document.querySelector('[data-validation]').innerHTML = validationHtml(); } },
};

// Trading Terminal: advanced candlestick chart, structure tools, signal with explanation, level planner (view-only).
import { html, raw, esc } from '../../core/dom.js';
import { fmtPrice, fmtPct, fmtNum, fmtTime, fmtDateTime, signClass, isoToUnix } from '../../core/format.js';
import { panel, chip, seg, toggle, btn, stat, stateChip, actionChip, table, kv, empty, demoBadge } from '../components/index.js';
import { icon } from '../icons.js';
import { CandleChart } from '../charts/candle-chart.js';
import { analyze } from '../../domain/structure.js';
import { positionSize, pipsBetween } from '../../domain/risk.js';
import { parseOhlcCsv, guessDigits, guessTf } from '../../domain/csv.js';
import { C } from '../charts/theme.js';

const SYMS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY'], TFS = ['M1', 'M5', 'M15', 'H1', 'H4'], LIMIT = { M1: 1000, M5: 800, M15: 600, H1: 400, H4: 160 };
const LAYER_DEFS = [['ema', 'EMA'], ['zones', 'S/R'], ['lines', 'Trend'], ['sweeps', 'Sweeps'], ['levels', 'Levels'], ['markers', 'Trades'], ['volume', 'Vol']];
const st = { symbol: 'XAUUSD', tf: 'M15', layers: { ema: true, zones: true, lines: true, sweeps: true, levels: true, markers: true, volume: true }, imported: null, analysis: null, candles: [], risk: { equity: 10000, pct: 0.25 } };
let api = null;
const sigFor = (ctx) => { const tf = st.tf === 'H1' || st.tf === 'H4' ? 'H1' : 'M15'; return ctx.d.signals?.signals.find((s) => s.symbol === st.symbol && s.timeframe === tf); };
const cfg = (ctx) => ctx.cfg(st.symbol) || { digits: 2, pip_size: 0.01, pip_value_per_lot_usd: 1 };
const dgt = (ctx) => (st.imported ? st.imported.digits : cfg(ctx).digits);

const regions = {
  toolbar: { deps: ['ui'], render: (ctx) => html`<div class="toolbar">${seg('t-symbol', SYMS, st.symbol)}${seg('t-tf', TFS, st.imported ? st.imported.tf : st.tf)}<span class="toolbar__sep"></span><div class="toolbar__layers" role="group" aria-label="Chart layers">${LAYER_DEFS.map(([k, l]) => toggle('t-layer', k, l, st.layers[k]))}</div><span class="grow"></span>${btn('Reset view', 't-reset', { variant: 'ghost', icon: icon('reset', 14) })}<label class="btn btn--ghost" title="CSV columns: time,open,high,low,close. Stays in your browser.">${icon('upload', 14)}Import CSV<input type="file" accept=".csv,text/csv" hidden data-change="csv"/></label>${st.imported ? btn('Remove import', 't-clear', { variant: 'ghost' }) : ''}</div>${st.imported ? html`<div class="notice notice--amber">Showing <b>${st.imported.name}</b> (${st.imported.candles.length} candles, local file, nothing uploaded). Structure tools run on this data; the signal panel keeps using the demo feed.</div>` : ''}` },
  chart: { deps: [], render: () => html`<div class="chart-host" data-chart></div>` },
  quote: { deps: ['quotes', 'ui'], render: (ctx) => {
    const q = ctx.d.quotes?.quotes.find((x) => x.symbol === st.symbol); if (!q) return '';
    const d = cfg(ctx).digits;
    return html`<div class="qhead"><div><div class="qhead__s">${st.symbol}</div><div class="qhead__p mono ${signClass(q.change_pct)}">${fmtPrice(q.mid, d)}</div></div><div class="qhead__g"><div><span class="lbl">BID</span><b class="mono">${fmtPrice(q.bid, d)}</b></div><div><span class="lbl">ASK</span><b class="mono">${fmtPrice(q.ask, d)}</b></div><div><span class="lbl">SPREAD</span><b class="mono">${q.spread_pips.toFixed(2)}</b> ${q.spread_state === 'OK' ? '' : stateChip(q.spread_state)}</div><div><span class="lbl">DAY</span><b class="mono ${signClass(q.change_pct)}">${fmtPct(q.change_pct)}</b></div><div><span class="lbl">ATR</span><b class="mono">${q.atr_pips ?? '—'}</b> ${stateChip(q.volatility_state)}</div></div></div>`;
  } },
  signal: { deps: ['signals', 'ui'], render: (ctx) => {
    const s = sigFor(ctx); if (!s) return empty('No signal data');
    const c = cfg(ctx), d = c.digits, pipsTo = (p) => (p == null ? '—' : `${pipsBetween(s.entry, p, c.pip_size).toFixed(0)} pips`);
    const icn = { pro: '▲', con: '▼', info: '•' };
    return html`<div class="sig sig--${s.action}"><div class="sig__top">${actionChip(s.action)}<b>${s.symbol}</b><span class="dim">${s.timeframe}</span><span class="grow"></span>${chip('ILLUSTRATIVE RULE', 'violet', s.note)}</div>
      ${s.action === 'WAIT' ? html`<div class="sig__wait">No trade. Reasons below.</div>` : table({ dense: true, rows: [['Entry', fmtPrice(s.entry, d), ''], ['Stop loss', fmtPrice(s.stop_loss, d), pipsTo(s.stop_loss)], ['Take profit', fmtPrice(s.take_profit, d), pipsTo(s.take_profit)], ['Risk / reward', `1 : ${s.risk_reward}`, '']], columns: [{ key: 'a', label: 'Level', render: (r) => r[0] }, { key: 'b', label: 'Price', align: 'right', render: (r) => html`<b class="mono">${r[1]}</b>` }, { key: 'c', label: 'Distance', align: 'right', render: (r) => html`<span class="dim mono">${r[2]}</span>` }] })}
      <div class="sig__prob"><span class="lbl">ESTIMATED PROBABILITY</span><b class="mono">N/A</b><span class="dim small">${s.validation.status === 'validated' ? '' : 'No validated data: probabilities are shown only for validated strategies.'}</span></div>
      <ul class="why">${s.reasons.map((r) => html`<li class="why__${r.kind}"><i>${icn[r.kind]}</i>${r.text}</li>`)}</ul>
      <div class="checks">${s.checks.map((k) => html`<div class="check ${k.passed ? 'check--ok' : 'check--no'}"><i>${k.passed ? '✓' : '✕'}</i><b>${k.name}</b><span class="dim small">${k.detail}</span></div>`)}</div></div>`;
  } },
  planner: { deps: ['ui'], render: (ctx) => {
    const s = sigFor(ctx), c = cfg(ctx);
    if (!s || s.action === 'WAIT') return html`<p class="dim small">The level planner needs an active BUY/SELL candidate. This calculator is view-only and never sends orders.</p>`;
    return html`<div class="planner"><label>Equity ($)<input type="number" min="100" step="100" value="${st.risk.equity}" data-input="p-equity"/></label><label>Risk per trade (%)<input type="number" min="0.05" max="2" step="0.05" value="${st.risk.pct}" data-input="p-pct"/></label></div><div data-planner-out>${plannerOut(ctx)}</div>`;
  } },
  structure: { deps: ['ui', 'analysis'], render: (ctx) => {
    const a = st.analysis; if (!a) return empty('Analysing…');
    const d = dgt(ctx), n = st.candles.length;
    return html`${kv([['Trend', html`${chip(a.trend.direction, a.trend.direction === 'UP' ? 'ok' : a.trend.direction === 'DOWN' ? 'err' : 'idle')} <span class="dim">${a.trend.structure}</span>`], ['Regime', chip(a.regime, a.regime === 'VOLATILE' ? 'warn' : 'info')], ['Trend strength', `${(a.trend.strength * 100).toFixed(0)}%`], ['Pivots (confirmed)', `${a.pivots.highs.length} highs · ${a.pivots.lows.length} lows`]])}
      <div class="lbl mt">// ZONES</div>${table({ rows: a.zones, columns: [{ key: 't', label: 'Type', render: (z) => chip(z.type === 'support' ? 'SUP' : 'RES', z.type === 'support' ? 'ok' : 'err') }, { key: 'r', label: 'Range', align: 'right', render: (z) => html`<span class="mono">${fmtPrice(z.lo, d)} – ${fmtPrice(z.hi, d)}</span>` }, { key: 'x', label: '×', align: 'right', render: (z) => z.touches }], empty: 'No zones with 2+ touches' })}
      <div class="lbl mt">// LIQUIDITY SWEEPS</div>${table({ rows: a.sweeps.slice(-5).reverse(), columns: [{ key: 'k', label: 'Side', render: (s) => chip(s.kind === 'SELL_SIDE' ? 'SELL-SIDE' : 'BUY-SIDE', s.bias === 'BULLISH' ? 'ok' : 'err') }, { key: 'l', label: 'Level', align: 'right', render: (s) => html`<span class="mono">${fmtPrice(s.level, d)}</span>` }, { key: 'a', label: 'Age', align: 'right', render: (s) => `${n - 1 - s.i} c` }], empty: 'No sweeps detected' })}`;
  } },
};
function plannerOut(ctx) {
  const s = sigFor(ctx), c = cfg(ctx); if (!s || s.action === 'WAIT') return '';
  const stopPips = pipsBetween(s.entry, s.stop_loss, c.pip_size), p = positionSize({ equity: st.risk.equity, riskPct: st.risk.pct, stopPips, pipValuePerLot: c.pip_value_per_lot_usd }), reward = p.riskAmount * s.risk_reward;
  return kv([['Risk amount', `$${fmtNum(p.riskAmount)}`], ['Stop distance', `${stopPips.toFixed(0)} pips`], ['Position size', Number.isFinite(p.lots) ? `${p.lots.toFixed(2)} lots` : '—'], ['Potential reward', `$${fmtNum(reward)} (${s.risk_reward}R)`], ['Pip value / lot', `$${c.pip_value_per_lot_usd} (demo constant)`]]);
}
function buildOverlays(ctx) {
  const a = st.analysis, c = st.candles; if (!a || !c.length) return {};
  const s = sigFor(ctx), ov = { zones: a.zones, lines: a.lines, sweeps: a.sweeps.filter((w) => w.i > c.length - 200), levels: [], markers: [], annotations: [] };
  if (!st.imported && s && s.action !== 'WAIT') ov.levels = [{ price: s.entry, label: 'ENTRY', color: C.cyan }, { price: s.stop_loss, label: 'SL', color: C.bear }, { price: s.take_profit, label: 'TP', color: C.bull }];
  const lastSweep = ov.sweeps.at(-1); if (lastSweep) ov.annotations.push({ i: lastSweep.i, text: lastSweep.kind === 'SELL_SIDE' ? 'SELL-SIDE SWEEP' : 'BUY-SIDE SWEEP' });
  if (!st.imported) {
    const idxOf = (t) => { let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m].t <= t) lo = m; else hi = m - 1; } return c[lo].t <= t ? lo : -1; };
    for (const t of (ctx.d.journal?.trades || []).filter((x) => x.symbol === st.symbol).slice(-60)) {
      const i = idxOf(isoToUnix(t.opened_utc)); if (i >= 0 && isoToUnix(t.opened_utc) >= c[0].t) ov.markers.push({ i, side: t.side, kind: 'entry', label: '' });
      if (t.closed_utc) { const j = idxOf(isoToUnix(t.closed_utc)); if (j >= 0 && isoToUnix(t.closed_utc) >= c[0].t) ov.markers.push({ i: j, side: t.side, kind: 'exit', label: '' }); }
    }
  }
  return ov;
}

export default {
  id: 'terminal', title: 'Trading Terminal', regions,
  layout: (r) => html`<div class="tm"><div class="tm__tools">${panel({ title: 'TERMINAL', sub: 'simulated feed · no orders', actions: demoBadge(), body: r.toolbar, className: 'p-tight' })}</div>
    <div class="tm__chart">${panel({ title: 'CHART', sub: 'drag · wheel/pinch zoom · tap = crosshair · double-click = reset', body: html`${r.quote}${r.chart}`, className: 'p-flush p-chart' })}</div>
    <div class="tm__side">${panel({ title: 'SIGNAL', sub: 'BUY / SELL / WAIT', body: r.signal, hero: true })}${panel({ title: 'LEVEL PLANNER', sub: 'view-only', body: r.planner })}${panel({ title: 'STRUCTURE', sub: 'no look-ahead', body: r.structure })}</div></div>`,
  mount(el, ctx) {
    const q = ctx.s.query; if (q.symbol && SYMS.includes(q.symbol)) st.symbol = q.symbol; if (q.tf && TFS.includes(q.tf)) st.tf = q.tf;
    const chart = new CandleChart(el.querySelector('[data-chart]'), { digits: dgt(ctx), tf: st.tf, layers: st.layers });
    async function update(reset = false) {
      st.candles = st.imported ? st.imported.candles : await ctx.candles(st.symbol, st.tf, LIMIT[st.tf]);
      chart.setOptions({ digits: dgt(ctx), tf: st.imported ? st.imported.tf : st.tf });
      chart.setData(st.candles, { reset }); st.analysis = analyze(st.candles); chart.setOverlays(buildOverlays(ctx)); chart.setLayers(st.layers); ctx.refresh(['analysis']);
    }
    api = { update, chart };
    const un = [ctx.bus.on('data', (k) => { if (k.includes('quotes') && !st.imported) update(false); else if (k.includes('signals')) chart.setOverlays(buildOverlays(ctx)); }), ctx.bus.on('reset', () => update(true))];
    update(true);
    return () => { un.forEach((f) => f()); chart.destroy(); api = null; };
  },
  actions: {
    't-symbol': (ctx, el) => { st.symbol = el.dataset.value; ctx.refresh(['ui', 'quotes', 'signals']); api?.update(true); },
    't-tf': (ctx, el) => { if (st.imported) return; st.tf = el.dataset.value; ctx.refresh(['ui']); api?.update(true); },
    't-layer': (ctx, el) => { st.layers[el.dataset.value] = !st.layers[el.dataset.value]; ctx.refresh(['ui']); api?.chart.setLayers(st.layers); },
    't-reset': () => api?.chart.resetView(),
    't-clear': (ctx) => { st.imported = null; ctx.refresh(['ui', 'quotes', 'signals']); api?.update(true); },
  },
  inputs: {
    csv: (ctx, el) => {
      const f = el.files?.[0]; if (!f) return;
      if (f.size > 5 * 1048576) { ctx.toast('File too large (max 5 MB)', 'error'); return; }
      f.text().then((txt) => { const r = parseOhlcCsv(txt); if (!r.candles.length) { ctx.toast(r.errors[0] || 'Could not read CSV', 'error'); return; } st.imported = { name: f.name, candles: r.candles, digits: guessDigits(r.candles), tf: guessTf(r.candles) }; ctx.refresh(['ui']); api?.update(true); ctx.toast(`Imported ${r.candles.length} candles locally${r.errors.length ? ` (${r.errors.length} issue(s))` : ''}`); });
    },
    'p-equity': (ctx, el) => { st.risk.equity = Math.max(100, Number(el.value) || 100); document.querySelector('[data-planner-out]').innerHTML = plannerOut(ctx); },
    'p-pct': (ctx, el) => { st.risk.pct = Math.min(2, Math.max(0.05, Number(el.value) || 0.25)); document.querySelector('[data-planner-out]').innerHTML = plannerOut(ctx); },
  },
};

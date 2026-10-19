// Trade Journal: simulated trades, statistics, filters, sortable table, AI decision history, CSV/JSON export, detail drawer.
import { html, raw, esc } from '../../core/dom.js';
import { fmtPrice, fmtNum, fmtSigned, fmtDateTime, fmtDuration, signClass, isoToUnix, fmtPct } from '../../core/format.js';
import { panel, chip, stat, table, seg, btn, kv, actionChip, empty, demoBadge } from '../components/index.js';
import { summarize } from '../../domain/stats.js';
import { toCsv, download } from '../../domain/export.js';
import { CandleChart } from '../charts/candle-chart.js';
import { C } from '../charts/theme.js';
import { icon } from '../icons.js';
import { DEMO_NOW } from '../../data/demo/market.js';

const PAGE = 15;
const st = { tab: 'trades', f: { symbol: 'ALL', side: 'ALL', result: 'ALL', reason: 'ALL', q: '' }, sort: { key: 'opened', dir: 'desc' }, page: 0, notes: null };
let drawerChart = null;
const loadNotes = () => { if (st.notes) return st.notes; try { st.notes = JSON.parse(localStorage.getItem('rabbit.notes') || '{}'); } catch { st.notes = {}; } return st.notes; };
const saveNotes = () => { try { localStorage.setItem('rabbit.notes', JSON.stringify(st.notes)); } catch { /* private mode */ } };
const SORTS = { opened: (t) => t.opened_utc, symbol: (t) => t.symbol, r: (t) => t.result_r ?? -99, id: (t) => t.id, strat: (t) => t.strategy_id };
function filtered(ctx) {
  const f = st.f, q = f.q.trim().toLowerCase();
  const rows = (ctx.d.journal?.trades || []).filter((t) => (f.symbol === 'ALL' || t.symbol === f.symbol) && (f.side === 'ALL' || t.side === f.side) && (f.reason === 'ALL' || t.exit_reason === f.reason || (f.reason === 'OPEN' && !t.closed_utc))
    && (f.result === 'ALL' || (f.result === 'WIN' && t.result_r > 0) || (f.result === 'LOSS' && t.result_r != null && t.result_r <= 0)) && (!q || `${t.id} ${t.symbol} ${t.strategy_id} ${t.tags.join(' ')} ${(loadNotes()[t.id] || '')}`.toLowerCase().includes(q)));
  const get = SORTS[st.sort.key]; rows.sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * (st.sort.dir === 'asc' ? 1 : -1));
  return rows;
}
const filtersUI = () => html`<div class="jf">${seg('j-symbol', ['ALL', 'XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY'], st.f.symbol, 'seg--tiny')}${seg('j-side', ['ALL', 'BUY', 'SELL'], st.f.side, 'seg--tiny')}${seg('j-result', ['ALL', 'WIN', 'LOSS'], st.f.result, 'seg--tiny')}${seg('j-reason', ['ALL', 'TARGET', 'STOP', 'TIME', 'OPEN'], st.f.reason, 'seg--tiny')}</div>`;

const regions = {
  filters: { deps: ['jfui'], render: () => filtersUI() },
  stats: { deps: ['journal', 'jf'], render: (ctx) => {
    const rows = filtered(ctx).filter((t) => t.result_r != null), s = summarize(rows.map((t) => t.result_r)), open = filtered(ctx).length - rows.length;
    if (!rows.length) return html`<div class="kpis kpis--s">${stat({ label: 'TRADES', value: 0, sub: `${open} open` })}</div>`;
    return html`<div class="kpis kpis--s">${stat({ label: 'CLOSED TRADES', value: s.trades, sub: `${open} open` })}${stat({ label: 'NET R', value: fmtSigned(s.net_r, 1, 'R'), tone: signClass(s.net_r) })}${stat({ label: 'MEAN R', value: fmtSigned(s.mean_r, 3), tone: signClass(s.mean_r), sub: 'per trade, after costs' })}${stat({ label: 'WIN RATE', value: `${(s.win_rate * 100).toFixed(1)}%` })}${stat({ label: 'PROFIT FACTOR', value: fmtNum(s.profit_factor) })}${stat({ label: 'MAX DRAWDOWN', value: `${fmtNum(s.max_dd_r, 1)}R`, tone: 'neg' })}${stat({ label: 'LONGEST LOSS STREAK', value: s.longest_loss_streak })}</div>`;
  } },
  table: { deps: ['journal', 'jf', 'jtab'], render: (ctx) => {
    if (st.tab === 'decisions') {
      const ids = new Set(filtered(ctx).map((t) => t.agent_decision_id)), rows = (ctx.d.journal?.decisions || []).filter((d) => ids.has(d.id)).slice().reverse().slice(0, 60);
      return table({ rows, rowId: (r) => r.id, columns: [{ key: 't', label: 'Time', render: (d) => html`<span class="mono dim">${fmtDateTime(isoToUnix(d.t_utc))}</span>` }, { key: 'a', label: 'Agent', render: (d) => d.agent }, { key: 's', label: 'Symbol', render: (d) => d.symbol }, { key: 'v', label: 'Verdict', render: (d) => chip(d.verdict, 'ok') }, { key: 'm', label: 'Decision', render: (d) => d.summary }, { key: 'o', label: 'Outcome', render: (d) => d.outcome }], empty: 'No decisions for these filters' });
    }
    const rows = filtered(ctx), pages = Math.max(1, Math.ceil(rows.length / PAGE)), pg = Math.min(st.page, pages - 1), view = rows.slice(pg * PAGE, pg * PAGE + PAGE);
    return html`${table({ rows: view, rowId: (r) => r.id, sortKey: st.sort.key, sortDir: st.sort.dir, columns: [
      { key: 'id', label: 'ID', sortable: true, render: (t) => html`<a href="#" data-action="j-open" data-value="${t.id}"><b>${t.id}</b></a>` },
      { key: 'opened', label: 'Opened (UTC)', sortable: true, render: (t) => html`<span class="mono">${fmtDateTime(isoToUnix(t.opened_utc))}</span>` },
      { key: 'symbol', label: 'Symbol', sortable: true, render: (t) => html`${t.symbol} ${actionChip(t.side)}` },
      { key: 'strat', label: 'Strategy', sortable: true, cls: 'hide-sm', render: (t) => t.strategy_id },
      { key: 'ep', label: 'Entry → Exit', align: 'right', cls: 'hide-sm', render: (t) => html`<span class="mono">${fmtPrice(t.entry, ctx.cfg(t.symbol).digits)} → ${t.exit == null ? '…' : fmtPrice(t.exit, ctx.cfg(t.symbol).digits)}</span>` },
      { key: 'r', label: 'Result', align: 'right', sortable: true, render: (t) => (t.result_r == null ? chip('OPEN', 'info') : html`<span class="mono ${signClass(t.result_r)}">${fmtSigned(t.result_r, 2, 'R')}</span>`) },
      { key: 'reason', label: 'Exit', render: (t) => (t.exit_reason ? chip(t.exit_reason, t.exit_reason === 'TARGET' ? 'ok' : t.exit_reason === 'STOP' ? 'err' : 'idle') : '') },
    ], empty: 'No trades match these filters' })}<div class="pager"><span class="dim small">${rows.length} trades · page ${pg + 1} / ${pages}</span><span class="grow"></span>${btn('Prev', 'j-prev', { variant: 'ghost' })}${btn('Next', 'j-next', { variant: 'ghost' })}</div>`;
  } },
};
const cols = (ctx) => [{ label: 'id', value: (t) => t.id }, { label: 'opened_utc', value: (t) => t.opened_utc }, { label: 'closed_utc', value: (t) => t.closed_utc }, { label: 'symbol', value: (t) => t.symbol }, { label: 'side', value: (t) => t.side }, { label: 'strategy_id', value: (t) => t.strategy_id }, { label: 'entry', value: (t) => t.entry }, { label: 'exit', value: (t) => t.exit }, { label: 'stop_loss', value: (t) => t.stop_loss }, { label: 'take_profit', value: (t) => t.take_profit }, { label: 'result_r', value: (t) => t.result_r }, { label: 'exit_reason', value: (t) => t.exit_reason }, { label: 'simulated', value: () => 'true' }, { label: 'note', value: (t) => loadNotes()[t.id] || '' }];
function doExport(ctx, kind) { const rows = filtered(ctx); if (kind === 'csv') download('rabbit-journal-simulated.csv', 'text/csv', toCsv(rows, cols(ctx))); else download('rabbit-journal-simulated.json', 'application/json', JSON.stringify({ simulated: true, exported_utc: new Date().toISOString(), filters: st.f, trades: rows }, null, 2)); ctx.toast(`Exported ${rows.length} simulated trades (${kind.toUpperCase()})`); }
const pickTf = (age) => (age < 14 * 3600 ? ['M1', 1000] : age < 2.6 * 86400 ? ['M5', 800] : age < 6 * 86400 ? ['M15', 600] : age < 15 * 86400 ? ['H1', 400] : null);
async function openDrawer(ctx, id) {
  const t = ctx.d.journal.trades.find((x) => x.id === id); if (!t) return;
  const notes = loadNotes(), d = ctx.cfg(t.symbol).digits, dec = ctx.d.journal.decisions.find((x) => x.id === t.agent_decision_id);
  ctx.overlay(html`<aside class="drawer" role="dialog" aria-modal="true" aria-label="Trade ${t.id}"><header class="drawer__h"><b>${t.id}</b> ${actionChip(t.side)} <span>${t.symbol}</span><span class="grow"></span>${chip('SIMULATED', 'demo')}<button class="iconbtn" data-action="j-close" aria-label="Close">${icon('close', 16)}</button></header>
    <div class="drawer__chart" data-drawer-chart></div>
    <div class="drawer__b">${kv([['Opened', fmtDateTime(isoToUnix(t.opened_utc))], ['Closed', t.closed_utc ? fmtDateTime(isoToUnix(t.closed_utc)) : 'open'], ['Duration', t.closed_utc ? fmtDuration(isoToUnix(t.closed_utc) - isoToUnix(t.opened_utc)) : '—'], ['Entry', fmtPrice(t.entry, d)], ['Stop loss', fmtPrice(t.stop_loss, d)], ['Take profit', fmtPrice(t.take_profit, d)], ['Exit', t.exit == null ? '—' : `${fmtPrice(t.exit, d)} (${t.exit_reason})`], ['Result', t.result_r == null ? 'open' : fmtSigned(t.result_r, 2, 'R')], ['Risk', `${t.risk_pct}% of paper equity`], ['Strategy', t.strategy_id], ['Tags', t.tags.join(', ')]])}
      <div class="lbl mt">// AI DECISION</div><p>${dec ? `${dec.agent}: ${dec.summary}` : '—'}</p><p class="dim small">${t.note}</p>
      <label class="lbl mt" for="note">// YOUR NOTE (stored only in this browser)</label><textarea id="note" rows="3" maxlength="500" data-input="j-note" data-id="${t.id}">${notes[t.id] || ''}</textarea></div></aside>`);
  const host = document.querySelector('[data-drawer-chart]'), age = DEMO_NOW + ctx.s.cursor * 60 - isoToUnix(t.opened_utc), tf = pickTf(age);
  if (!host) return;
  if (!tf) { host.innerHTML = '<div class="empty"><div class="empty__t">Trade is older than the chart window</div></div>'; return; }
  const candles = await ctx.candles(t.symbol, tf[0], tf[1]); drawerChart?.destroy();
  drawerChart = new CandleChart(host, { digits: d, tf: tf[0], compact: true, layers: { volume: false, ema: false, annotations: false } });
  const idxOf = (u) => { let k = 0; for (let i = 0; i < candles.length; i++) if (candles[i].t <= u) k = i; return k; }, i0 = idxOf(isoToUnix(t.opened_utc)), i1 = t.closed_utc ? idxOf(isoToUnix(t.closed_utc)) : candles.length - 1;
  drawerChart.setData(candles.slice(Math.max(0, i0 - 40), Math.min(candles.length, i1 + 30)), { reset: true });
  const off = Math.max(0, i0 - 40), sl = candles.slice(off, Math.min(candles.length, i1 + 30));
  drawerChart.setOverlays({ levels: [{ price: t.entry, label: 'ENTRY', color: C.cyan }, { price: t.stop_loss, label: 'SL', color: C.bear }, { price: t.take_profit, label: 'TP', color: C.bull }], markers: [{ i: i0 - off, side: t.side, kind: 'entry', label: '' }, ...(t.closed_utc ? [{ i: Math.min(sl.length - 1, i1 - off), side: t.side, kind: 'exit', label: '' }] : [])] });
}
export default {
  id: 'journal', title: 'Trade Journal', regions,
  layout: (r) => html`<div class="jr">${panel({ title: 'TRADE JOURNAL', sub: 'simulated paper trades only', actions: html`${demoBadge('SIMULATED')}${btn('CSV', 'j-export', { value: 'csv', variant: 'ghost', icon: icon('download', 14) })}${btn('JSON', 'j-export', { value: 'json', variant: 'ghost', icon: icon('download', 14) })}`, body: html`<div class="jr__bar"><input class="search" type="search" placeholder="Search id, symbol, tag, note…" data-input="j-q" aria-label="Search trades" value="${st.f.q}"/>${r.filters}</div>${r.stats}` , hero: true })}
    ${panel({ title: st.tab === 'trades' ? 'TRADES' : 'AI DECISIONS', sub: 'click an id for details', actions: seg('j-tab', [{ value: 'trades', label: 'Trades' }, { value: 'decisions', label: 'AI decisions' }], st.tab, 'seg--tiny'), body: r.table, className: 'p-flush' })}</div>`,
  mount(el, ctx) { if (ctx.s.query.export) { setTimeout(() => doExport(ctx, ctx.s.query.export === 'json' ? 'json' : 'csv'), 50); } return () => { drawerChart?.destroy(); drawerChart = null; }; },
  actions: {
    'j-symbol': (c, e) => setF(c, 'symbol', e), 'j-side': (c, e) => setF(c, 'side', e), 'j-result': (c, e) => setF(c, 'result', e), 'j-reason': (c, e) => setF(c, 'reason', e),
    'j-tab': (c, e) => { st.tab = e.dataset.value; st.page = 0; c.refresh(['jtab']); document.querySelector('.jr .panel:nth-of-type(2) .seg')?.querySelectorAll('.seg__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === st.tab))); },
    'j-prev': (c) => { st.page = Math.max(0, st.page - 1); c.refresh(['jf']); }, 'j-next': (c) => { st.page += 1; c.refresh(['jf']); },
    'j-export': (c, e) => doExport(c, e.dataset.value), 'j-open': (c, e, ev) => { ev.preventDefault(); openDrawer(c, e.dataset.value); }, 'j-close': (c) => { drawerChart?.destroy(); drawerChart = null; c.closeOverlay(); },
    sort: (c, e) => { const k = e.dataset.sort; st.sort = { key: k, dir: st.sort.key === k && st.sort.dir === 'desc' ? 'asc' : 'desc' }; c.refresh(['jf']); },
  },
  inputs: { 'j-q': (c, e) => { st.f.q = e.value; st.page = 0; c.refresh(['jf']); }, 'j-note': (c, e) => { loadNotes()[e.dataset.id] = e.value.slice(0, 500); saveNotes(); } },
};
function setF(ctx, key, el) { st.f[key] = el.dataset.value; st.page = 0; ctx.refresh(['jfui', 'jf']); }

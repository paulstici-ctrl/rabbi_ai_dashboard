// Overview / Command Center: multi-market tiles, watchlist, scanner, agents, equity, risk, activity.
import { html } from '../../core/dom.js';
import { fmtPrice, fmtMoney, fmtPct, fmtDuration, fmtTime, signClass, fmtSigned, ago, isoToUnix } from '../../core/format.js';
import { panel, chip, stat, stateChip, actionChip, spark, table, bar, winLoss, dot, demoBadge, sevVariant, empty } from '../components/index.js';
import { CandleChart } from '../charts/candle-chart.js';
import { LineChart } from '../charts/line-chart.js';
import { AgentFloor } from '../charts/agent-floor.js';
import { analyze } from '../../domain/structure.js';
import { DEMO_NOW } from '../../data/demo/market.js';

const SYMS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY'];
const sigOf = (ctx, sym) => ctx.d.signals?.signals.find((s) => s.symbol === sym && s.timeframe === 'M15');
const nowOf = (ctx) => (ctx.d.quotes ? Date.parse(ctx.d.quotes.as_of_utc) / 1000 : DEMO_NOW);

const regions = {
  kpis: { deps: ['account', 'agents', 'system'], render: (ctx) => {
    const a = ctx.d.account?.account, ag = ctx.d.agents?.agents || [], sys = ctx.d.system;
    if (!a) return empty('Loading account…');
    const online = ag.filter((x) => x.state === 'ACTIVE').length, risk = a.open_positions.length, ddRatio = a.drawdown_pct / a.limits.max_drawdown_pct;
    const cell = (label, value, sub, tone = '') => stat({ label, value, sub, tone });
    return html`<div class="kpis">
      ${cell('PAPER EQUITY', fmtMoney(a.equity), html`${fmtPct(((a.equity / a.initial) - 1) * 100)} vs ${fmtMoney(a.initial, '$', 0)} <i class="sim">SIMULATED</i>`, signClass(a.equity - a.initial))}
      ${cell('DAY P&L', fmtMoney(a.day_pnl), 'paper, incl. floating', signClass(a.day_pnl))}
      ${cell('DRAWDOWN', `${a.drawdown_pct.toFixed(2)}%`, `max ${a.max_drawdown_pct.toFixed(2)}% · limit ${a.limits.max_drawdown_pct}%`, ddRatio > 0.75 ? 'neg' : ddRatio > 0.5 ? 'amber' : '')}
      ${cell('RISK EXPOSURE', `${risk} / ${a.limits.max_open_positions}`, `${(risk * a.risk_per_trade_pct).toFixed(2)}% of equity at risk`)}
      ${cell('RISK GUARDIAN', html`${chip(ddRatio > 0.9 ? 'LIMIT' : 'OK', ddRatio > 0.9 ? 'err' : 'ok')}`, 'limits within bounds')}
      ${cell('AI AGENTS', `${online} / ${ag.length}`, 'online')}
      ${cell('VALIDATION', html`${stateChip(sys?.validation.status || 'WAIT')}`, '0 eligible strategies')}
      ${cell('TRADING', html`${chip('DISABLED', 'err')}`, 'research build')}
    </div>`;
  } },
  tiles: { deps: [], render: () => html`<div class="tiles">${SYMS.map((s) => html`<article class="tile" data-symbol="${s}" data-row="${s}" role="button" tabindex="0" aria-label="Open ${s} in terminal"><header class="tile__head" data-head></header><div class="tile__chart" data-chart></div><footer class="tile__foot" data-foot></footer></article>`)}</div>` },
  watchlist: { deps: ['quotes'], render: (ctx) => {
    const q = ctx.d.quotes?.quotes || [];
    return table({ rows: q, rowId: (r) => r.symbol, columns: [
      { key: 'symbol', label: 'Symbol', render: (r) => html`<a class="sym" href="#/terminal?symbol=${r.symbol}">${r.symbol}</a>` },
      { key: 'mid', label: 'Last', align: 'right', render: (r) => html`<span class="mono">${fmtPrice(r.mid, ctx.cfg(r.symbol)?.digits)}</span>` },
      { key: 'chg', label: 'Chg', align: 'right', render: (r) => html`<span class="mono ${signClass(r.change_pct)}">${fmtPct(r.change_pct)}</span>` },
      { key: 'atr', label: 'ATR', align: 'right', render: (r) => html`<span class="mono">${r.atr_pips ?? '—'}</span> ${stateChip(r.volatility_state)}` },
      { key: 'spr', label: 'Spread', align: 'right', render: (r) => html`<span class="mono">${r.spread_pips.toFixed(2)}</span> ${r.spread_state === 'OK' ? '' : stateChip(r.spread_state)}` },
      { key: 'sp', label: '', cls: 'hide-sm', render: (r) => spark(r.spark, { color: 'auto' }) },
    ] });
  } },
  scanner: { deps: ['scanner'], render: (ctx) => {
    const o = (ctx.d.scanner?.opportunities || []).slice(0, 6);
    return html`${table({ rows: o, rowId: (r) => r.id, columns: [
      { key: 'm', label: 'Market', render: (r) => html`<b>${r.symbol}</b> <span class="dim">${r.timeframe}</span>` },
      { key: 's', label: 'Setup', render: (r) => html`${r.setup}<div class="dim small">${r.note}</div>` },
      { key: 'd', label: 'Side', render: (r) => (r.direction === 'NEUTRAL' ? chip('—', 'idle') : actionChip(r.direction)) },
      { key: 'sc', label: 'Score*', render: (r) => bar({ value: r.score, tone: r.status === 'BLOCKED' ? 'amber' : 'cyan', label: String(r.score) }) },
      { key: 'st', label: 'Status', render: (r) => chip(r.status, r.status === 'ARMED' ? 'ok' : r.status === 'BLOCKED' ? 'err' : 'info') },
    ] })}<p class="foot">* heuristic rank of setup quality, <b>not a probability</b>. No strategy is validated.</p>`;
  } },
  agents: { deps: ['agents'], render: (ctx) => html`<div class="agent-strip">${(ctx.d.agents?.agents || []).map((a) => html`<a class="agent-mini" href="#/agents?agent=${a.id}">${dot({ ACTIVE: 'ok', IDLE: 'idle', BLOCKED: 'warn', ERROR: 'err' }[a.state])}<span class="agent-mini__n">${a.name}</span><span class="agent-mini__t">${a.task}</span></a>`)}</div>` },
  floor: { deps: [], render: () => html`<div class="floor" data-floor></div>` },
  equity: { deps: [], render: () => html`<div class="eq" data-eq></div>` },
  equityStats: { deps: ['account'], render: (ctx) => {
    const a = ctx.d.account; if (!a) return '';
    const ac = a.account, dd = ac.drawdown_pct, lim = ac.limits.max_drawdown_pct;
    return html`<div class="eqstats"><div><div class="lbl">// RECENT OUTCOMES (SIMULATED)</div>${winLoss(a.recent_outcomes)}</div><div class="eqstats__dd"><div class="lbl">// DRAWDOWN ENVELOPE <span class="dim">limit ${lim}% → kill switch</span></div>${bar({ value: dd, max: lim, tone: dd / lim > 0.75 ? 'red' : dd / lim > 0.5 ? 'amber' : 'cyan', label: `${dd.toFixed(2)}% of ${lim}%`, limitAt: lim })}</div></div>`;
  } },
  exposure: { deps: ['account', 'quotes'], render: (ctx) => {
    const a = ctx.d.account?.account; if (!a) return '';
    return html`${a.exposure.length ? a.exposure.map((e) => html`<div class="expo"><span><b>${e.symbol}</b> <span class="dim">${e.risk_r}R at risk</span></span>${bar({ value: e.share_pct, tone: 'violet', label: `${e.share_pct}%` })}</div>`) : empty('No open paper positions')}
      ${a.open_positions.length ? table({ rows: a.open_positions, rowId: (r) => r.id, columns: [{ key: 'id', label: 'Position', render: (r) => html`${r.symbol} ${actionChip(r.side)}` }, { key: 'e', label: 'Entry', align: 'right', render: (r) => html`<span class="mono">${fmtPrice(r.entry, ctx.cfg(r.symbol)?.digits)}</span>` }, { key: 'f', label: 'Floating', align: 'right', render: (r) => html`<span class="mono ${signClass(r.floating_r)}">${fmtSigned(r.floating_r, 2, 'R')}</span>` }] }) : ''}`;
  } },
  feed: { deps: ['events'], render: (ctx) => {
    const ev = (ctx.d.events?.events || []).slice(0, 14), now = nowOf(ctx);
    return html`<ul class="feed">${ev.map((e) => html`<li class="feed__i feed__i--${e.severity}"><span class="feed__t mono">${fmtTime(isoToUnix(e.t_utc))}</span>${chip(e.type, sevVariant(e.severity))}<span class="feed__m"><b>${e.title}</b><span class="dim small"> ${e.detail}</span></span></li>`)}</ul>`;
  } },
};

export default {
  id: 'overview', title: 'Overview', regions,
  layout: (r) => html`<div class="ov">
    <div class="ov__kpis">${r.kpis}</div>
    <div class="ov__main">
      ${panel({ title: 'MARKETS', sub: 'M15 · synthetic candles', actions: demoBadge(), body: r.tiles, className: 'p-flush ov-tiles' })}
      ${panel({ title: 'OPPORTUNITY SCANNER', sub: 'structure-based, heuristic', body: r.scanner, className: 'p-flush ov-scan' })}
      ${panel({ title: 'EQUITY · PAPER ACCOUNT', sub: 'simulated, not real money', actions: demoBadge('SIMULATED'), body: html`${r.equity}${r.equityStats}`, className: 'ov-eq' })}
    </div>
    <div class="ov__side">
      ${panel({ title: 'WATCHLIST', sub: 'price · volatility · spread', body: r.watchlist, className: 'p-flush ov-watch' })}
      ${panel({ title: 'AI AGENTS', sub: 'click a node', actions: html`<a class="btn btn--ghost" href="#/agents">Open</a>`, body: html`${r.agents}${r.floor}`, hero: true, className: 'ov-agents' })}
      ${panel({ title: 'RISK EXPOSURE', sub: 'open paper positions', body: r.exposure, className: 'ov-risk' })}
      ${panel({ title: 'ACTIVITY', sub: 'events & agent flow', body: r.feed, className: 'p-flush p-scroll ov-feed' })}
    </div>
  </div>`,
  mount(el, ctx) {
    const charts = {}, un = [];
    el.querySelectorAll('.tile').forEach((t) => { const s = t.dataset.symbol; charts[s] = new CandleChart(t.querySelector('[data-chart]'), { compact: true, digits: ctx.cfg(s).digits, tf: 'M15', layers: { volume: false, annotations: false } }); });
    const eq = new LineChart(el.querySelector('[data-eq]'), { zeroLine: false, yFormat: (v) => fmtMoney(v, '$', 0), xFormat: (x) => new Date(x * 1000).toISOString().slice(5, 10) });
    const floor = new AgentFloor(el.querySelector('[data-floor]'), { compact: true, onSelect: (id) => ctx.nav('/agents', { agent: id }) });
    async function updateTiles() {
      for (const s of SYMS) {
        const q = ctx.d.quotes?.quotes.find((x) => x.symbol === s), sg = sigOf(ctx, s), t = el.querySelector(`.tile[data-symbol="${s}"]`); if (!q || !t) continue;
        t.querySelector('[data-head]').innerHTML = html`<span class="tile__sym">${s}</span><span class="tile__px mono ${signClass(q.change_pct)}">${fmtPrice(q.mid, ctx.cfg(s).digits)}</span><span class="mono small ${signClass(q.change_pct)}">${fmtPct(q.change_pct)}</span><span class="grow"></span>${sg ? actionChip(sg.action) : ''}`;
        t.querySelector('[data-foot]').innerHTML = html`<span>ATR <b class="mono">${q.atr_pips ?? '—'}</b> pips</span><span>${stateChip(q.volatility_state)}</span><span>spr <b class="mono">${q.spread_pips.toFixed(2)}</b></span><span class="grow"></span><span class="dim">${fmtPrice(q.day_low, ctx.cfg(s).digits)} – ${fmtPrice(q.day_high, ctx.cfg(s).digits)}</span>`;
        const c = await ctx.candles(s, 'M15', 160), an = analyze(c);
        charts[s].setData(c); charts[s].setOverlays({ zones: an.zones.slice(0, 3), sweeps: an.sweeps.filter((w) => c.length - 1 - w.i < 60) });
      }
    }
    function updateEq() { const a = ctx.d.account; if (!a) return; const pts = a.equity_curve.map((p) => [p.t, p.equity]), peak = pts.reduce((b, p) => (p[1] > b[1] ? p : b), pts[0]), low = pts.reduce((b, p) => (p[1] < b[1] ? p : b), pts[0]); eq.setSeries([{ id: 'eq', name: 'Equity', color: '#5ee7ff', points: pts, fill: true }, { id: 'ini', name: 'Initial', color: '#52657a', dash: [4, 4], width: 1, points: [[pts[0][0], a.account.initial], [pts.at(-1)[0], a.account.initial]] }]); eq.setMarks([{ x: peak[0], y: peak[1], label: 'peak', color: '#2ee6a6' }, { x: low[0], y: low[1], label: 'lowest', color: '#ff5577' }]); }
    function updateFloor() { const ag = ctx.d.agents?.agents; if (ag) floor.setStates(Object.fromEntries(ag.map((a) => [a.id, a.state]))); }
    const onData = (kinds) => { if (kinds.includes('quotes')) updateTiles(); if (kinds.includes('account')) updateEq(); if (kinds.includes('agents')) updateFloor(); };
    un.push(ctx.bus.on('data', onData)); un.push(ctx.bus.on('reset', () => { updateTiles(); updateEq(); }));
    updateTiles(); updateEq(); updateFloor();
    return () => { un.forEach((f) => f()); Object.values(charts).forEach((c) => c.destroy()); eq.destroy(); floor.destroy(); };
  },
  actions: { row: (ctx, el) => ctx.nav('/terminal', { symbol: el.dataset.row }) },
};

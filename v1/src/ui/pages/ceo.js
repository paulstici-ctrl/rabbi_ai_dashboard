// RABBIT CEO: visually rich read-only intelligence overview, using V1 demo data only.
// An independent page: compatible with future Phase 1 schemas via the model adapter.
import { html } from '../../core/dom.js';
import { panel, chip, dot, stat, demoBadge, seg } from '../components/index.js';
import { buildCeoSnapshot, buildCeoBoard, buildCeoBriefing, CEO_SYMBOLS } from '../../data/ceo/model.js';

const view = { department: 'forex', symbol: 'XAUUSD' };
const snapshot = (ctx) => buildCeoSnapshot({
  agents: ctx.d.agents?.agents,
  signals: ctx.d.signals?.signals,
  events: ctx.d.events?.events,
  validationStatus: ctx.d.system?.validation?.status ?? 'WAIT',
  tradingEnabled: false,
});
const statusChip = (d) => chip(d.state === 'DEMO' ? 'DEMO · NOT LIVE' : d.state.replace('_', ' '),
  d.state === 'DEMO' ? 'demo' : 'idle');

const regions = {
  hero: { deps: [], render: () => html`<section class="ceo-hero" aria-label="RABBIT CEO">
    <div class="ceo-hero__copy">
      <div class="ceo-overline">RABBIT INTELLIGENCE CORPORATION <span class="ceo-pulse" aria-hidden="true"></span> CONCEPT / V1</div>
      <div class="ceo-hero__title"><span class="ceo-hero__glyph" aria-hidden="true">R</span><div><h1>RABBIT <em>CEO</em></h1><p>Central Intelligence &amp; Decision Command</p></div></div>
      <p class="ceo-hero__lead">A single command center for specialist research departments, independent risk review and explainable market intelligence.</p>
      <div class="ceo-hero__tags">${chip('SYNTHETIC DATA', 'demo')}${chip('NO NEWS CONNECTION', 'idle')}${chip('EXECUTION DISABLED', 'err')}</div>
    </div>
    <div class="ceo-orbit" aria-hidden="true"><div class="ceo-orbit__ring ceo-orbit__ring--outer"></div><div class="ceo-orbit__ring ceo-orbit__ring--inner"></div><div class="ceo-orbit__core">CEO</div><span class="ceo-orbit__node ceo-orbit__node--1">FX</span><span class="ceo-orbit__node ceo-orbit__node--2">CR</span><span class="ceo-orbit__node ceo-orbit__node--3">NW</span><span class="ceo-orbit__node ceo-orbit__node--4">RK</span></div>
  </section>` },
  metrics: { deps: ['agents', 'ui'], render: (ctx) => {
    const s = snapshot(ctx);
    return html`<div class="ceo-metrics">
      ${stat({ label: 'DEPARTMENTS', value: String(s.departments.length), sub: '3 demo / 3 not connected' })}
      ${stat({ label: 'LEGACY DEMO AGENTS', value: String(s.agents.length), sub: 'Synthetic activity only' })}
      ${stat({ label: 'LIVE CEO RUNTIMES', value: '0', sub: 'Awaiting Phase 1 integration' })}
      ${stat({ label: 'NEWS SOURCES', value: '0', sub: 'No news ingestion' })}
      ${stat({ label: 'TRADE EXECUTION', value: 'OFF', sub: 'Protected research prototype', tone: 'neg' })}
    </div>`;
  } },
  departments: { deps: ['agents', 'ui'], render: (ctx) => {
    const s = snapshot(ctx);
    return html`<div class="ceo-departments">${s.departments.map((d) => html`<button type="button" class="ceo-dept" data-action="ceo-dept" data-value="${d.id}" aria-pressed="${String(d.id === view.department)}">
      <span class="ceo-dept__mark" aria-hidden="true">${d.short}</span>
      <span class="ceo-dept__body"><b>${d.name}</b><span>${d.caption}</span><small>${d.members.length} V1 demo agent(s)</small></span>
      ${statusChip(d)}
    </button>`)}</div>`;
  } },
  departmentDetail: { deps: ['agents', 'ui'], render: (ctx) => {
    const s = snapshot(ctx), d = s.departments.find((x) => x.id === view.department) || s.departments[0];
    return html`<div class="ceo-detail">
      <div class="ceo-detail__head"><div><span class="lbl">// SELECTED DEPARTMENT</span><h3>${d.name}</h3><p class="dim">${d.note}</p></div>${statusChip(d)}</div>
      ${d.members.length ? html`<div class="ceo-agentlist">${d.members.map((a) => html`<div class="ceo-agentrow">
        <div>${dot(a.state === 'ACTIVE' ? 'ok' : a.state === 'ERROR' ? 'err' : 'idle')}<b>${a.name}</b><span class="dim">${a.task}</span></div>
        <span class="ceo-demostate">DEMO · ${a.state}</span>
      </div>`)}</div>` : html`<div class="ceo-empty"><b>No runtime connected</b><p>This division is planned. Its agents, data feeds and decision pipelines do not exist in this prototype.</p></div>`}
      <div class="ceo-detail__foot">Demo activities are not real AI jobs. CEO Phase 1 integration will replace these placeholders after review.</div>
    </div>`;
  } },
  board: { deps: ['signals', 'ui'], render: (ctx) => {
    const s = snapshot(ctx), b = buildCeoBoard(s, view.symbol);
    return html`<div class="ceo-board">
      <div class="ceo-board__tools"><span class="lbl">// ASSET REVIEW</span>${seg('ceo-symbol', CEO_SYMBOLS, view.symbol, 'seg--tiny')}</div>
      <div class="ceo-board__verdict">${chip('RESEARCH ONLY', 'warn')}<b>${b.symbol}</b><span>${b.researchLabel}</span></div>
      <div class="ceo-board__roles">
        <article><small>01 / TECHNICAL ANALYST</small><b>${b.technical}</b><span>Source: deterministic V1 synthetic signal</span></article>
        <article><small>02 / MACRO DESK</small><b>${b.macro}</b><span>Source: none connected</span></article>
        <article><small>03 / NEWS INTELLIGENCE</small><b>${b.news}</b><span>Source: none connected</span></article>
        <article class="ceo-board__risk"><small>04 / RISK GUARDIAN</small><b>${b.risk}</b><span>Independent execution veto</span></article>
      </div>
      <div class="ceo-board__final"><span class="lbl">CEO SUMMARY</span><strong>${b.conclusion}</strong><a class="btn btn--ghost" href="#/terminal?symbol=${b.symbol}">View demo chart →</a></div>
      <p class="ceo-explain">This is not a live board meeting, forecast or trade recommendation. No external model was called. No execution controls are available.</p>
    </div>`;
  } },
  briefing: { deps: ['agents', 'system', 'ui'], render: (ctx) => {
    const items = buildCeoBriefing(snapshot(ctx));
    return html`<ol class="ceo-briefing">${items.map((it, i) => html`<li><span class="ceo-briefing__n">0${i + 1}</span><div><b>${it.title}</b><p>${it.body}</p></div></li>`)}</ol>`;
  } },
  news: { deps: [], render: () => html`<div class="ceo-news-off"><div class="ceo-news-off__icon" aria-hidden="true">!</div><b>News Impact Radar unavailable</b><p>No verified news feed, macro calendar, sentiment model or impact forecast is connected.</p><span class="ceo-source">STATUS: WAITING_DATA · 0 SOURCES</span></div>` },
  activity: { deps: ['events'], render: (ctx) => {
    const e = snapshot(ctx).events;
    return html`<ul class="ceo-timeline">${e.length ? e.map((item) => html`<li><span class="ceo-timeline__dot"></span><div><b>${item.title}</b><small>${item.source} · ${item.severity.toUpperCase()}</small></div></li>`) : html`<li class="dim">No synthetic events available.</li>`}</ul>`;
  } },
};

export default {
  id: 'ceo', title: 'RABBIT CEO', regions,
  layout: (r) => html`<div class="ceo-page">
    ${r.hero}
    <div class="ceo-page__metrics">${r.metrics}</div>
    <section class="ceo-page__departments">${panel({ title: 'DEPARTMENTS', sub: 'select a division · simulated status', actions: demoBadge(), body: r.departments, className: 'p-tight' })}</section>
    <section class="ceo-page__detail">${panel({ title: 'DEPARTMENT MONITOR', sub: 'agent state and source provenance', body: r.departmentDetail })}</section>
    <section class="ceo-page__board">${panel({ title: 'AI BOARD MEETING', sub: 'synthetic evidence · no external AI calls', actions: chip('PREVIEW', 'brand'), body: r.board, hero: true })}</section>
    <section class="ceo-page__briefing">${panel({ title: 'EXECUTIVE BRIEFING', sub: 'generated from local V1 demo payloads', body: r.briefing })}</section>
    <section class="ceo-page__news">${panel({ title: 'GLOBAL NEWS INTELLIGENCE', sub: 'data access not configured', body: r.news })}</section>
    <section class="ceo-page__activity">${panel({ title: 'AUDIT TIMELINE', sub: 'synthetic activity, not real news', body: r.activity })}</section>
  </div>`,
  mount(_el, ctx) {
    if (ctx.s.query.department && ['forex', 'crypto', 'equities', 'news', 'risk', 'research'].includes(ctx.s.query.department)) view.department = ctx.s.query.department;
    if (CEO_SYMBOLS.includes(ctx.s.query.symbol)) view.symbol = ctx.s.query.symbol;
    ctx.refresh(['ui']);
    return () => {};
  },
  actions: {
    'ceo-dept': (ctx, el) => { view.department = el.dataset.value; ctx.refresh(['ui']); },
    'ceo-symbol': (ctx, el) => { view.symbol = el.dataset.value; ctx.refresh(['ui']); },
  },
};

// AI Agents: roster, per-agent state, decisions with explanations, journal log, message flow and the agent floor.
import { html } from '../../core/dom.js';
import { fmtDuration, fmtTimeS, fmtTime, isoToUnix, ago } from '../../core/format.js';
import { panel, chip, dot, stat, stateChip, kv, table, bar, empty, seg, demoBadge } from '../components/index.js';
import { AgentFloor } from '../charts/agent-floor.js';
import { DEMO_NOW } from '../../data/demo/market.js';

const st = { agent: 'guardian', tab: 'decisions', level: 'ALL' };
const DOT = { ACTIVE: 'ok', IDLE: 'idle', BLOCKED: 'warn', ERROR: 'err' };
let floor = null;
const agentOf = (ctx) => ctx.d.agents?.agents.find((a) => a.id === st.agent) || ctx.d.agents?.agents[0];
const nowOf = (ctx) => Date.parse(ctx.d.agents?.as_of_utc || '') / 1000 || DEMO_NOW;

const regions = {
  roster: { deps: ['agents', 'ui'], render: (ctx) => html`<div class="roster">${(ctx.d.agents?.agents || []).map((a) => html`<button type="button" class="acard" data-action="a-select" data-value="${a.id}" aria-pressed="${String(a.id === st.agent)}"><div class="acard__top">${dot(DOT[a.state])}<b>${a.name}</b><span class="grow"></span>${stateChip(a.state)}</div><div class="acard__task">${a.task}</div><div class="acard__meta dim small"><span>${a.decisions.length} decisions</span><span>heartbeat ${ago(nowOf(ctx), isoToUnix(a.last_heartbeat_utc))}</span></div></button>`)}</div>` },
  detail: { deps: ['agents', 'ui', 'account', 'strategies'], render: (ctx) => {
    const a = agentOf(ctx); if (!a) return empty('No agent data');
    const logs = a.log.filter((l) => st.level === 'ALL' || l.level === st.level);
    const acc = ctx.d.account?.account, lab = ctx.s.strategies;
    const extra = a.id === 'guardian' && acc ? html`<div class="lbl mt">// RISK ENVELOPE (paper)</div><div class="env"><div><span class="dim">Drawdown</span>${bar({ value: acc.drawdown_pct, max: acc.limits.max_drawdown_pct, tone: acc.drawdown_pct / acc.limits.max_drawdown_pct > 0.7 ? 'amber' : 'cyan', label: `${acc.drawdown_pct.toFixed(2)}% / ${acc.limits.max_drawdown_pct}%`, limitAt: acc.limits.max_drawdown_pct })}</div><div><span class="dim">Open positions</span>${bar({ value: acc.open_positions.length, max: acc.limits.max_open_positions, tone: 'violet', label: `${acc.open_positions.length} / ${acc.limits.max_open_positions}` })}</div><div><span class="dim">Daily loss</span>${bar({ value: Math.max(0, -acc.day_pnl), max: acc.initial * acc.limits.daily_loss_pct / 100, tone: 'cyan', label: `$${Math.max(0, -acc.day_pnl).toFixed(0)} / $${(acc.initial * acc.limits.daily_loss_pct / 100).toFixed(0)}` })}</div></div><p class="foot">Kelly / position-size caps are not shown: sizing needs a validated edge, and none exists.</p>` : a.id === 'evaluator' && lab ? html`<div class="lbl mt">// VALIDATION GATES</div><div class="checks">${lab.gates.map((g) => html`<div class="check ${g.passed === true ? 'check--ok' : g.passed === false ? 'check--no' : 'check--na'}"><i>${g.passed === true ? '✓' : g.passed === false ? '✕' : '…'}</i><b>${g.name}</b><span class="dim small">${g.detail}</span></div>`)}</div>` : '';
    return html`<div class="adet"><div class="adet__head"><div><h3>${a.name}</h3><p class="dim">${a.role}</p></div><div class="adet__st">${stateChip(a.state)}<span class="dim small">up ${fmtDuration(a.uptime_s)}</span></div></div>
      <div class="adet__metrics">${a.metrics.map((m) => stat({ label: m.label.toUpperCase(), value: m.value }))}</div>${extra}
      <div class="adet__tabs">${seg('a-tab', [{ value: 'decisions', label: 'Latest decisions' }, { value: 'log', label: 'Journal / log' }], st.tab)}${st.tab === 'log' ? seg('a-level', ['ALL', 'INFO', 'WARN', 'ERROR'], st.level, 'seg--tiny') : ''}</div>
      ${st.tab === 'decisions' ? html`<ul class="dec">${a.decisions.map((d) => html`<li class="dec__i"><div class="dec__h">${chip(d.verdict, /VETO|REJECT|ALERT/.test(d.verdict) ? 'err' : /BUY|APPROVED|ELIGIBLE/.test(d.verdict) ? 'ok' : /SELL/.test(d.verdict) ? 'sell' : 'info')}<b>${d.summary}</b><span class="grow"></span><span class="dim mono small">${fmtTime(isoToUnix(d.t_utc))}</span></div><details><summary>Why? <span class="dim small">${d.symbol || 'system'} · confidence ${d.confidence == null ? 'not scored' : d.confidence}</span></summary><ul class="dec__why">${d.explanation.map((x) => html`<li>${x}</li>`)}</ul></details></li>`)}</ul>` : html`<div class="term" role="log">${logs.length ? logs.map((l) => html`<div class="term__l term__l--${l.level}"><span class="dim">${fmtTimeS(isoToUnix(l.t_utc))}</span> <b>${l.level}</b> ${l.msg}</div>`) : html`<div class="dim">No log lines for this filter</div>`}</div>`}</div>`;
  } },
  floor: { deps: [], render: () => html`<div class="floor floor--big" data-floor></div>` },
  messages: { deps: ['agents'], render: (ctx) => table({ rows: ctx.d.agents?.messages || [], columns: [{ key: 't', label: 'Time', render: (m) => html`<span class="mono dim">${fmtTimeS(isoToUnix(m.t_utc))}</span>` }, { key: 'f', label: 'Flow', render: (m) => html`<b>${m.from}</b> → <b>${m.to}</b>` }, { key: 'p', label: 'Topic', render: (m) => m.topic }] }) },
};
export default {
  id: 'agents', title: 'AI Agents', regions, needs: ['strategies'],
  layout: (r) => html`<div class="ag"><div class="ag__roster">${panel({ title: 'AGENTS', sub: '5 specialised roles', actions: demoBadge(), body: r.roster, className: 'p-tight' })}</div><div class="ag__detail">${panel({ title: 'AGENT DETAIL', sub: 'state · decisions · explanations', body: r.detail, hero: true })}</div><div class="ag__floor">${panel({ title: 'AGENT FLOOR', sub: 'message topology (pulses = activity)', body: r.floor, hero: true })}${panel({ title: 'MESSAGE FLOW', sub: 'latest', body: r.messages, className: 'p-flush' })}</div></div>`,
  mount(el, ctx) {
    const q = ctx.s.query.agent; if (q) st.agent = q;
    floor = new AgentFloor(el.querySelector('[data-floor]'), { onSelect: (id) => { st.agent = id; ctx.refresh(['ui']); floor.setStates(states(ctx), st.agent); } });
    const states = (c) => Object.fromEntries((c.d.agents?.agents || []).map((a) => [a.id, a.state]));
    floor.setStates(states(ctx), st.agent); ctx.refresh(['ui']);
    const seen = new Set((ctx.d.agents?.messages || []).map((m) => m.t_utc + m.topic));
    const un = ctx.bus.on('data', (k) => { if (!k.includes('agents')) return; floor.setStates(states(ctx), st.agent); for (const m of ctx.d.agents.messages) { const id = m.t_utc + m.topic; if (!seen.has(id)) { seen.add(id); floor.message(m.from, m.to === 'analyst' || m.to === 'guardian' ? m.to : 'core'); } } });
    return () => { un(); floor.destroy(); floor = null; };
  },
  actions: {
    'a-select': (ctx, el) => { st.agent = el.dataset.value; ctx.refresh(['ui']); floor?.setStates(Object.fromEntries((ctx.d.agents?.agents || []).map((a) => [a.id, a.state])), st.agent); },
    'a-tab': (ctx, el) => { st.tab = el.dataset.value; ctx.refresh(['ui']); }, 'a-level': (ctx, el) => { st.level = el.dataset.value; ctx.refresh(['ui']); },
  },
};

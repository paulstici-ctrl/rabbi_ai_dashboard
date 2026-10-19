// System Monitor: MT5 link, data-feed health, GitHub CI / audit status, versions, validation state, logs, safety.
import { html } from '../../core/dom.js';
import { fmtTimeS, fmtDuration, isoToUnix, ago, fmtDateTime } from '../../core/format.js';
import { panel, chip, stat, table, stateChip, kv, seg, btn, dot, demoBadge, empty } from '../components/index.js';
import { DEMO_NOW } from '../../data/demo/market.js';
import { icon } from '../icons.js';

const st = { level: 'ALL' };
const sys = (ctx) => ctx.d.system;
const nowOf = (ctx) => Date.parse(ctx.d.system?.as_of_utc || '') / 1000 || DEMO_NOW;
const regions = {
  tiles: { deps: ['system', 'quotes'], render: (ctx) => {
    const s = sys(ctx); if (!s) return empty('Loading…');
    const bad = s.feeds.filter((f) => f.status !== 'HEALTHY').length, ciFail = s.ci.filter((c) => c.status === 'failure').length, warn = s.logs.filter((l) => l.level === 'WARN').length, err = s.logs.filter((l) => l.level === 'ERROR').length;
    const tile = (title, value, sub, tone) => html`<div class="systile systile--${tone}"><div class="lbl">${title}</div><div class="systile__v">${value}</div><div class="dim small">${sub}</div></div>`;
    return html`<div class="systiles">${tile('MT5 CONNECTION', stateChip(s.mt5.status), s.mt5.mode, s.mt5.status === 'CONNECTED' ? 'ok' : 'warn')}${tile('DATA FEED', bad ? stateChip('DEGRADED') : stateChip('HEALTHY'), `${s.feeds.length - bad}/${s.feeds.length} symbols healthy`, bad ? 'warn' : 'ok')}${tile('GITHUB CI / AUDIT', ciFail ? chip(`${ciFail} FAILING`, 'err') : chip('PASSING', 'ok'), `${s.ci.length} workflows`, ciFail ? 'err' : 'ok')}${tile('VALIDATION', stateChip(s.validation.status), 'engine verdict', 'warn')}${tile('LOGS', html`${chip(`${err} ERR`, err ? 'err' : 'idle')} ${chip(`${warn} WARN`, warn ? 'warn' : 'idle')}`, 'last 3 hours', err ? 'err' : 'warn')}${tile('SAFETY', chip('TRADING DISABLED', 'err'), `kill switch ${s.safety.kill_switch.toLowerCase()} · ${s.safety.live_orders} live orders`, 'ok')}</div>`;
  } },
  mt5: { deps: ['system'], render: (ctx) => { const s = sys(ctx); return s ? html`${kv([['Status', stateChip(s.mt5.status)], ['Mode', s.mt5.mode], ['Server', s.mt5.server || 'none'], ['Last check', ago(nowOf(ctx), isoToUnix(s.mt5.last_check_utc))]])}<p class="dim small">${s.mt5.note}</p>` : ''; } },
  feeds: { deps: ['system', 'quotes'], render: (ctx) => table({ rows: sys(ctx)?.feeds || [], columns: [{ key: 's', label: 'Symbol', render: (f) => html`<b>${f.symbol}</b>` }, { key: 'st', label: 'Status', render: (f) => stateChip(f.status) }, { key: 't', label: 'Ticks/s', align: 'right', render: (f) => f.ticks_per_s.toFixed(2) }, { key: 'a', label: 'Last tick', align: 'right', render: (f) => `${f.last_tick_age_s}s` }, { key: 'g', label: 'Gap share', align: 'right', render: (f) => `${(f.gap_share * 100).toFixed(2)}%` }, { key: 'sp', label: 'Spread', align: 'right', render: (f) => f.spread_median_pips.toFixed(2) }, { key: 'q', label: 'Quality', render: (f) => stateChip(f.spread_quality) }] }) },
  ci: { deps: ['system'], render: (ctx) => table({ rows: sys(ctx)?.ci || [], columns: [{ key: 'w', label: 'Workflow', render: (c) => html`<b>${c.workflow}</b>` }, { key: 's', label: 'Status', render: (c) => stateChip(c.status) }, { key: 'b', label: 'Branch', cls: 'hide-sm', render: (c) => html`<span class="mono">${c.branch}</span>` }, { key: 'c', label: 'Commit', cls: 'hide-sm', render: (c) => html`<span class="mono dim">${c.commit}</span>` }, { key: 'd', label: 'Duration', align: 'right', render: (c) => (c.duration_s == null ? '—' : fmtDuration(c.duration_s)) }] }) },
  versions: { deps: ['system'], render: (ctx) => html`${table({ rows: sys(ctx)?.versions || [], columns: [{ key: 'c', label: 'Component', render: (v) => v.component }, { key: 'v', label: 'Version', render: (v) => html`<span class="mono">${v.version}</span>` }, { key: 's', label: 'State', render: (v) => stateChip(v.state) }] })}` },
  validation: { deps: ['system'], render: (ctx) => { const v = sys(ctx)?.validation; return v ? html`<div class="vrow">${stateChip(v.status)}<span class="dim small">engine validation verdict</span></div><ul class="why">${v.reasons.map((r) => html`<li class="why__con"><i>•</i>${r}</li>`)}</ul>` : ''; } },
  logs: { deps: ['system', 'slog'], render: (ctx) => { const l = (sys(ctx)?.logs || []).filter((x) => st.level === 'ALL' || x.level === st.level); return html`<div class="term term--tall" role="log" aria-label="System logs">${l.length ? l.map((x) => html`<div class="term__l term__l--${x.level}"><span class="dim">${fmtTimeS(isoToUnix(x.t_utc))}</span> <b>${x.level}</b> <span class="term__src">[${x.source}]</span> ${x.msg}</div>`) : html`<div class="dim">No log lines for this filter</div>`}</div>`; } },
};
export default {
  id: 'system', title: 'System Monitor', regions,
  layout: (r) => html`<div class="sy"><div class="sy__tiles">${panel({ title: 'SYSTEM STATUS', sub: 'engine · feed · CI · safety', actions: html`${demoBadge()}${btn('Copy diagnostics', 's-copy', { variant: 'ghost', icon: icon('download', 14) })}`, body: r.tiles, hero: true })}</div>
    <div class="sy__feeds">${panel({ title: 'DATA FEED HEALTH', sub: 'per symbol', body: r.feeds, className: 'p-flush' })}</div><div class="sy__mt5">${panel({ title: 'MT5 LINK', sub: 'history download only (planned)', body: r.mt5 })}</div>
    <div class="sy__ci">${panel({ title: 'GITHUB CI / AUDIT', sub: 'workflow runs', body: r.ci, className: 'p-flush' })}</div><div class="sy__ver">${panel({ title: 'VERSIONS', sub: 'engine & contracts', body: r.versions, className: 'p-flush' })}${panel({ title: 'VALIDATION STATE', sub: 'why the verdict is WAIT', body: r.validation })}</div>
    <div class="sy__logs">${panel({ title: 'LOGS · WARNINGS · ERRORS', sub: 'newest first', actions: seg('s-level', ['ALL', 'INFO', 'WARN', 'ERROR'], st.level, 'seg--tiny'), body: r.logs, className: 'p-flush' })}</div></div>`,
  actions: {
    's-level': (ctx, el) => { st.level = el.dataset.value; document.querySelectorAll('[data-action="s-level"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === st.level))); ctx.refresh(['slog']); },
    's-copy': async (ctx) => { const s = ctx.d.system, text = JSON.stringify({ exported: 'demo', validation: s.validation, mt5: s.mt5, feeds: s.feeds, ci: s.ci, versions: s.versions }, null, 2); try { await navigator.clipboard.writeText(text); ctx.toast('Diagnostics copied'); } catch { ctx.toast('Clipboard unavailable in this context', 'warn'); } },
  },
};

// App shell: sidebar (desktop), bottom navigation (phone), top bar with replay controls, demo banner, toast and palette.
import { html, raw } from '../core/dom.js';
import { icon, logo } from './icons.js';
import { chip } from './components/index.js';
import { fmtTimeS, fmtDate } from '../core/format.js';

export const NAV = [
  { path: '/overview', label: 'Overview', icon: 'overview', key: '1' }, { path: '/terminal', label: 'Terminal', icon: 'terminal', key: '2' },
  { path: '/agents', label: 'AI Agents', icon: 'agents', key: '3' }, { path: '/lab', label: 'Strategy Lab', icon: 'lab', key: '4' },
  { path: '/journal', label: 'Journal', icon: 'journal', key: '5' }, { path: '/system', label: 'System', icon: 'system', key: '6' },
];
export const shellHtml = () => html`
<a class="skip" href="#main">Skip to content</a>
<div class="app" id="app">
  <aside class="sidebar" aria-label="Primary">
    <a class="brand" href="#/overview" aria-label="RABBIT-AI Command Center">${logo(30)}<span class="brand__t"><b>RABBIT</b><i>·AI</i><small>COMMAND CENTER</small></span></a>
    <nav class="nav">${NAV.map((n) => html`<a class="nav__a" data-nav="${n.path}" href="#${n.path}">${icon(n.icon, 18)}<span>${n.label}</span><kbd>${n.key}</kbd></a>`)}</nav>
    <div class="sidebar__foot"><div id="side-safety"></div><div class="ver">v1.0.0 · schema v1</div></div>
  </aside>
  <div class="main-col">
    <header class="topbar">
      <a class="brand brand--mobile" href="#/overview">${logo(26)}<b>RABBIT</b><i>·AI</i></a>
      <div class="ticker" id="ticker" aria-label="Prices"></div>
      <div class="topbar__right">
        <div class="replay" id="replay"></div>
        <button class="iconbtn" data-action="palette" aria-label="Command palette (Ctrl+K)" title="Search / commands (Ctrl+K)">${icon('search', 18)}</button>
      </div>
    </header>
    <div class="demo-banner" id="demo-banner" role="note"></div>
    <main id="main" class="page" tabindex="-1"></main>
  </div>
  <nav class="bottomnav" aria-label="Primary mobile">${NAV.map((n) => html`<a class="bottomnav__a" data-nav="${n.path}" href="#${n.path}">${icon(n.icon, 20)}<span>${n.label.replace('Strategy Lab', 'Lab').replace('AI Agents', 'Agents')}</span></a>`)}</nav>
</div>
<div id="toasts" class="toasts" aria-live="polite"></div>
<div id="overlay" class="overlay" hidden></div>`;

export const replayHtml = ({ playing, speed, supports, clockUnix, mode }) => html`${supports ? html`<button class="iconbtn" data-action="replay-toggle" aria-label="${playing ? 'Pause demo replay' : 'Play demo replay'}">${icon(playing ? 'pause' : 'play', 16)}</button><div class="seg seg--tiny" role="group" aria-label="Replay speed">${[1, 4, 16].map((s) => html`<button class="seg__btn" data-action="replay-speed" data-value="${s}" aria-pressed="${String(s === speed)}">${s}×</button>`)}</div>` : ''}<div class="clock" title="${supports ? 'Demo clock (UTC). Replays pre-generated synthetic candles.' : 'Data clock (UTC)'}"><span class="clock__d">${fmtDate(clockUnix)}</span> <b>${fmtTimeS(clockUnix)}</b> <small>UTC</small></div>`;
export const bannerHtml = (mode) => mode === 'demo' ? html`<b>DEMO DATA</b> Synthetic prices, trades and results generated locally. Not live quotes, not investment advice, no broker connection. <span class="demo-banner__b">NO ORDERS · LIVE TRADING NOT IMPLEMENTED</span>` : html`<b>READ-ONLY DATA</b> Showing exported engine data. This interface never sends orders.`;
export function tickerHtml(quotes, meta) {
  return html`${(quotes || []).map((q) => { const d = meta?.symbols.find((s) => s.symbol === q.symbol)?.digits ?? 2; return html`<a class="tick" href="#/terminal?symbol=${q.symbol}"><b>${q.symbol}</b><span class="mono">${q.mid.toFixed(d)}</span><span class="mono ${q.change_pct >= 0 ? 'pos' : 'neg'}">${q.change_pct >= 0 ? '+' : '−'}${Math.abs(q.change_pct).toFixed(2)}%</span></a>`; })}`;
}
export const safetyHtml = (sys) => html`<div class="safety"><div class="safety__r">${icon('shield', 14)}<span>TRADING</span><b class="neg">DISABLED</b></div><div class="safety__r"><span>KILL SWITCH</span><b class="${sys?.safety?.kill_switch === 'ENGAGED' ? 'pos' : 'neg'}">${sys?.safety?.kill_switch || '—'}</b></div><div class="safety__r"><span>LIVE ORDERS</span><b>${sys?.safety?.live_orders ?? 0}</b></div></div>`;
export function toast(msg, kind = 'info') { const host = document.getElementById('toasts'); if (!host) return; const el = document.createElement('div'); el.className = `toast toast--${kind}`; el.textContent = msg; host.appendChild(el); setTimeout(() => el.classList.add('toast--out'), 3200); setTimeout(() => el.remove(), 3700); }

// Private read-only RABBIT CEO console. NEVER loaded by public /v1/ or /ceo-preview/.
// The backend must enforce authentication before any remote access is enabled.
import { html, setHTML } from './core/dom.js';
import {
  PrivateCeoSnapshotClient, CeoSnapshotError, isCeoPrivateOrigin, mapCeoApiToDashboard,
} from './data/ceo/private-api.js';

const DEPT_SHORT = { forex: 'FX', crypto: 'CR', equities: 'EQ', news: 'NW', risk: 'RK', research: 'RL' };
const DEPT_CAPTIONS = {
  forex: 'Structură, volatilitate și lichiditate',
  crypto: 'BTC, ETH, SOL și surse blockchain',
  equities: 'Indici, acțiuni și rezultate',
  news: 'Știri verificate și evenimente macro',
  risk: 'Veto, risc și supraveghere independentă',
  research: 'Backtest, audit și calibrare',
};
const SAFE_DEPT_IDS = new Set(Object.keys(DEPT_SHORT));

const chip = (text, key = text) => html`<span class="private-ceo__chip private-ceo__chip--${String(key).toLowerCase()}">${text}</span>`;
const panel = (title, sub, body, cls = '') => html`<section class="private-ceo__panel ${cls}">
  <header><h2>${title}</h2><small>${sub}</small></header>
  <div class="private-ceo__panelbody">${body}</div>
</section>`;
const dateTime = (ts) => Number.isFinite(ts) && ts > 0
  ? new Date(ts * 1000).toLocaleString('ro-RO', { timeZone: 'UTC', hour12: false }) + ' UTC' : 'necunoscut';
const duration = (sec) => Number.isFinite(sec) && sec >= 0 ? `${Math.round(sec)} s` : 'n/a';

export function renderPrivateCeo(data, selected = 'forex') {
  const dept = SAFE_DEPT_IDS.has(selected) ? selected : 'forex';
  const current = data.departments.find((d) => d.id === dept);
  const running = data.agents.filter((a) => a.state === 'ACTIVE').length;
  const degraded = data.agents.filter((a) => ['ERROR', 'WAITING_DATA', 'DEGRADED'].includes(a.state)).length;
  const live = data.mode === 'LIVE_READONLY';
  const fake = data.synthetic;
  const sourceCount = data.connectedExternalSources;
  const headline = live ? 'RUNTIME READ-ONLY' : 'SIMULARE OFFLINE';
  const departments = html`<div class="private-ceo__deptgrid">${data.departments.map((d) => html`
    <button type="button" data-ceo-dept="${d.id}" class="private-ceo__dept" aria-pressed="${d.id === dept}">
      <span class="private-ceo__overline">${DEPT_SHORT[d.id]}</span>
      <strong>${d.name}</strong><small>${DEPT_CAPTIONS[d.id]}</small>
      ${chip(d.state === 'WAITING_DATA' ? 'NO DATA' : d.state, d.state)}
      <small>${d.members.length} agenți înregistrați</small>
    </button>`)}</div>`;
  const members = current?.members || [];
  const agents = members.length
    ? html`<ul class="private-ceo__agentlist">${members.map((a) => html`
      <li><div><strong>${a.name}</strong><small>${a.task || 'Fără sarcină curentă'}</small>
      <small>${a.runs} rulări · ${a.synthetic ? 'date sintetice' : 'date externe permise'}</small></div>
      ${chip(a.state, a.state)}</li>`)}</ul>`
    : html`<p class="private-ceo__notice">Acest departament nu raportează încă agenți. Nu presupunem că funcționează.</p>`;
  const board = data.reviews.length
    ? html`<div class="private-ceo__boardlist">${data.reviews.map((r) => html`
      <article class="private-ceo__review">
        <span class="private-ceo__overline">${r.horizon || 'TIMEFRAME ?'}</span>
        <h3>${r.instrument}</h3>
        ${chip(r.status, r.status)}
        <p>${r.synthetic ? 'Raport DEMO · ' : 'Raport din surse verificabile · '}${r.vetoed ? 'Risk Guardian: VETO' : 'Fără veto în acest raport'}</p>
        <p>Cercetare exclusiv. Nicio tranzacție executată.</p>
      </article>`)}</div>`
    : html`<p class="private-ceo__notice">Nu există evaluări curente. Nicio direcție BUY/SELL nu este presupusă.</p>`;
  const sources = data.sources.length
    ? html`<ul class="private-ceo__sourcelist">${data.sources.map((s) => html`<li>
      <div><strong>${s.id}</strong><small>${s.synthetic ? 'Sursă sintetică' : 'Sursă externă declarată'}</small>
      <small>Ultima actualizare: ${dateTime(s.last_update)}</small></div>
      ${chip(s.state, s.state)}</li>`)}</ul>`
    : html`<p class="private-ceo__notice">Nicio sursă înregistrată sau disponibilă.</p>`;
  const events = data.events.length
    ? html`<ul class="private-ceo__eventlist">${data.events.slice(-30).reverse().map((e) => html`
      <li><div><strong>${e.type}</strong><small>${e.summary}</small>
      <small>${dateTime(e.timestamp)} · ${e.synthetic ? 'DEMO' : 'Eveniment extern declarat'}</small></div>
      ${chip(e.synthetic ? 'DEMO' : 'SOURCE', e.synthetic ? 'waiting_data' : 'fresh')}</li>`)}</ul>`
    : html`<p class="private-ceo__notice">Niciun eveniment primit. Nu se afișează evenimente inventate.</p>`;
  const briefing = data.briefing
    ? html`<div class="private-ceo__notice"><small class="mono">Generat: ${dateTime(data.briefing.generated)}</small></div>
      <pre class="private-ceo__briefingtext">${data.briefing.text}</pre>`
    : html`<p class="private-ceo__notice">Briefing-ul nu este disponibil.</p>`;
  return html`
    <header class="private-ceo__header">
      <div class="private-ceo__brand"><span class="private-ceo__brandmark">R</span><div>
      <span class="private-ceo__overline">RABBIT INTELLIGENCE CORPORATION · PRIVATE</span>
      <h1>RABBIT <span>CEO</span></h1>
      <p>Central Intelligence &amp; Decision Command · read-only</p></div></div>
      <div class="private-ceo__controls">${chip(headline, live ? 'healthy' : 'waiting_data')}
      ${chip('TRADING OFF', 'veto')}<button id="private-ceo-refresh" type="button" class="btn">Actualizează</button></div>
    </header>
    <div class="private-ceo__ribbon">
      <strong>${fake ? 'DEMO · SURSE SINTETICE' : 'RUNTIME READ-ONLY · VERIFICĂ FIECARE SURSĂ'}</strong>
      <small>Snapshot: ${dateTime(data.generatedAt)} · Risc independent · Nicio comandă de trading</small>
    </div>
    <div class="private-ceo__metrics">
      <div class="private-ceo__metric"><small>DEPARTAMENTE</small><strong>${data.departments.length}</strong><span>organizate de CEO</span></div>
      <div class="private-ceo__metric"><small>AGENȚI ÎNREGISTRAȚI</small><strong>${data.agents.length}</strong><span>nu toate active simultan</span></div>
      <div class="private-ceo__metric"><small>LUCREAZĂ ACUM</small><strong>${running}</strong><span>stare ACTIVE reală</span></div>
      <div class="private-ceo__metric"><small>NECESITĂ ATENȚIE</small><strong>${degraded}</strong><span>așteaptă date / erori</span></div>
      <div class="private-ceo__metric"><small>SURSE LIVE DISPONIBILE</small><strong>${sourceCount}</strong><span>${data.connectedNewsSources} fluxuri de știri</span></div>
    </div>
    <div class="private-ceo__grid">
      ${panel('DEPARTAMENTE', 'selectează agenția', departments, 'private-ceo__departments')}
      ${panel('AGENT STATUS', current?.name || 'Așteptare', agents, 'private-ceo__agents')}
      ${panel('AI BOARD MEETING', 'research only · fără ordine', board, 'private-ceo__board')}
      ${panel('EXECUTIVE BRIEFING', 'română / engleză', briefing, 'private-ceo__briefing')}
      ${panel('DATA SOURCE HEALTH', 'proveniență și prospețime', sources, 'private-ceo__sources')}
      ${panel('AUDIT TIMELINE', 'evenimente raportate de backend', events, 'private-ceo__events')}
    </div>
    <footer class="private-ceo__foot">
      RABBIT CEO · PRIVATE RESEARCH ONLY · ${data.mode} · EXECUTION DISABLED ·
      ${data.connectedLiveAgentRuntimes} runtime conectat(e)
    </footer>`;
}

export function renderPrivateDisconnect(code = 'NOT_CONNECTED') {
  return html`<header class="private-ceo__header"><div class="private-ceo__brand">
      <span class="private-ceo__brandmark">R</span><div>
      <span class="private-ceo__overline">RABBIT INTELLIGENCE CORPORATION · PRIVATE</span>
      <h1>RABBIT <span>CEO</span></h1>
      <p>Central Intelligence &amp; Decision Command · read-only</p>
      </div></div></header>
    <div class="private-ceo__ribbon"><strong class="private-ceo__error">DISCONNECTED / ACCES BLOCAT</strong>
      ${chip('TRADING OFF', 'veto')}</div>
    <div class="private-ceo__notice"><strong>Nu se afișează date vechi sau inventate.</strong>
      <p>Serviciul privat nu este disponibil ori răspunsul nu a trecut verificarea de siguranță.
      Cod: ${code}.</p>
      <p>GitHub Pages nu poate accesa această pagină în modul privat.</p>
      <button id="private-ceo-refresh" type="button" class="btn">Reîncearcă</button>
    </div>`;
}

export function startPrivateCeoApp(root, { origin = globalThis.location?.origin || '',
                                           fetchImpl = globalThis.fetch,
                                           everyMs = 8000 } = {}) {
  if (!root) throw new TypeError('Missing private CEO root');
  const trusted = isCeoPrivateOrigin(origin);
  const client = new PrivateCeoSnapshotClient({ enabled: trusted, origin, fetchImpl });
  let selected = 'forex', disposed = false, inFlight = false, timer = null, data = null;
  const paint = () => setHTML(root, data ? renderPrivateCeo(data, selected) : renderPrivateDisconnect(trusted ? 'WAITING_FOR_SERVER' : 'UNTRUSTED_ORIGIN'));
  async function refresh() {
    if (disposed || inFlight) return;
    if (!trusted) { data = null; paint(); return; }
    inFlight = true;
    try {
      const response = await client.getSnapshot();
      if (!disposed) { data = mapCeoApiToDashboard(response); paint(); }
    } catch (e) {
      if (!disposed) {
        // No raw server errors, network responses or private payloads in UI/logs.
        data = null;
        setHTML(root, renderPrivateDisconnect(e instanceof CeoSnapshotError ? e.code : 'SERVICE_UNAVAILABLE'));
      }
    } finally { inFlight = false; }
  }
  const onClick = (e) => {
    const refreshBtn = e.target.closest?.('#private-ceo-refresh');
    if (refreshBtn) { refresh(); return; }
    const btn = e.target.closest?.('[data-ceo-dept]');
    if (btn && root.contains(btn) && SAFE_DEPT_IDS.has(btn.dataset.ceoDept)) {
      selected = btn.dataset.ceoDept;
      paint();
    }
  };
  root.addEventListener('click', onClick);
  paint();
  if (trusted) {
    refresh();
    // Polling is bounded and paused when the document is not visible.
    timer = setInterval(() => { if (!globalThis.document?.hidden) refresh(); }, everyMs);
  }
  return {
    refresh,
    stop() { disposed = true; if (timer) clearInterval(timer); root.removeEventListener('click', onClick); },
  };
}

if (typeof document !== 'undefined' && document.getElementById('private-root')) {
  startPrivateCeoApp(document.getElementById('private-root'));
}

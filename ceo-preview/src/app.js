// Application controller: routing, replay clock, data refresh, global actions, keyboard, command palette.
import { createStore, createBus } from './core/store.js';
import { createRouter } from './core/router.js';
import { html, setHTML, delegate, observeStyles } from './core/dom.js';
import { shellHtml, replayHtml, bannerHtml, tickerHtml, safetyHtml, toast, NAV } from './ui/shell.js';
import { buildCommands, filterCommands, paletteHtml } from './ui/palette.js';
import { PAGES } from './pages.js';
import { DEMO_NOW } from './data/demo/market.js';

const FAST = ['quotes', 'account'], SLOW = ['signals', 'scanner', 'agents', 'events', 'journal', 'system'], ALL = ['quotes', 'account', ...SLOW];
export function createApp({ root, provider, win = window }) {
  const store = createStore({ route: '/overview', query: {}, cursor: 0, playing: true, speed: 1, data: {}, meta: null, strategies: null, error: null, loading: true });
  const bus = createBus();
  let page = null, cleanup = null, timer = null, n = 0, pal = { open: false, q: '', active: 0 }, candleCache = new Map(), cacheKey = '';
  const MAX_CURSOR = 700;
  const ctx = {
    store, bus, provider, toast,
    get s() { return store.get(); }, get d() { return store.get().data; }, get meta() { return store.get().meta; },
    cfg: (sym) => store.get().meta?.symbols.find((x) => x.symbol === sym),
    nav: (path, query) => router.go(path, query),
    async candles(symbol, tf, limit = 400) { const s = store.get(), k = `${symbol}|${tf}|${limit}|${s.cursor}`; if (cacheKey !== String(s.cursor)) { candleCache = new Map(); cacheKey = String(s.cursor); } if (!candleCache.has(k)) candleCache.set(k, provider.get('candles', { symbol, timeframe: tf, limit, cursor: s.cursor }).then((p) => p.candles)); return candleCache.get(k); },
    overlay(h) { const o = root.querySelector('#overlay'); o.hidden = false; setHTML(o, h); o.querySelector('[autofocus]')?.focus(); },
    closeOverlay() { const o = root.querySelector('#overlay'); o.hidden = true; setHTML(o, ''); pal.open = false; },
    refresh: (kinds) => refreshRegions(kinds),
    loadStrategies: async () => { if (!store.get().strategies) store.set({ strategies: await provider.get('strategies') }); return store.get().strategies; },
  };
  const router = createRouter(NAV.map((x) => ({ path: x.path })), (r) => show(r), win);

  async function load(kinds) {
    const cursor = store.get().cursor, res = await Promise.all(kinds.map((k) => provider.get(k, { cursor }))), data = { ...store.get().data };
    kinds.forEach((k, i) => { data[k] = res[i]; }); store.set({ data }); refreshRegions(kinds); bus.emit('data', kinds); chrome();
  }
  function renderPage(p) { const r = {}; for (const [name, def] of Object.entries(p.regions)) r[name] = html`<div class="region" data-region="${name}">${def.render(ctx)}</div>`; return p.layout(r, ctx); }
  function refreshRegions(kinds) {
    if (!page) return;
    for (const [name, def] of Object.entries(page.regions)) { if (def.deps && def.deps.some((d) => kinds.includes(d))) { const el = root.querySelector(`[data-region="${name}"]`); if (el) { setHTML(el, def.render(ctx)); page.afterRegion?.(name, el, ctx); } } }
  }
  function chrome() {
    const s = store.get(), c = s.cursor, clock = DEMO_NOW + c * 60;
    setHTML(root.querySelector('#ticker'), tickerHtml(s.data.quotes?.quotes, s.meta));
    setHTML(root.querySelector('#replay'), replayHtml({ playing: s.playing, speed: s.speed, supports: provider.supportsReplay, clockUnix: provider.supportsReplay ? clock : Math.floor(Date.now() / 1000), mode: provider.mode }));
    setHTML(root.querySelector('#demo-banner'), bannerHtml(provider.mode));
    setHTML(root.querySelector('#side-safety'), safetyHtml(s.data.system));
    root.querySelectorAll('[data-nav]').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === s.route ? 'page' : 'false'));
  }
  async function show({ path, query }) {
    cleanup?.(); cleanup = null; page = PAGES[path]; store.set({ route: path, query });
    const main = root.querySelector('#main'); document.title = `${page.title} · RABBIT-AI Command Center`;
    if (page.needs?.includes('strategies')) await ctx.loadStrategies();
    setHTML(main, renderPage(page)); main.scrollTop = 0; win.scrollTo?.(0, 0);
    cleanup = page.mount?.(main, ctx) || null; chrome();
  }
  async function tick() {
    if (document.hidden) return;
    const s = store.get();
    try {
      if (provider.supportsReplay) {
        if (!s.playing) return;
        if (s.cursor >= MAX_CURSOR) { store.set({ playing: false }); toast('End of the pre-generated demo replay. Press reset to restart.', 'warn'); chrome(); return; }
        store.set({ cursor: Math.min(MAX_CURSOR, s.cursor + s.speed) }); n++; await load(n % 5 === 0 ? ALL : FAST);
      } else { n++; await load(ALL); }
    } catch (e) { showError(e); }
  }
  function showError(e) { store.set({ error: e.message }); const main = root.querySelector('#main'); setHTML(main, html`<div class="panel panel--error"><div class="panel__body"><h2>Data error</h2><p class="mono">${e.message}</p><p>The payload did not match its JSON contract or the source is unreachable.</p><button class="btn" data-action="retry">Retry</button></div></div>`); }
  const globalActions = {
    'replay-toggle': () => { store.set({ playing: !store.get().playing }); chrome(); },
    'replay-speed': (_, el) => { store.set({ speed: Number(el.dataset.value) }); chrome(); },
    'replay-reset': () => { store.set({ cursor: 0, playing: false }); candleCache = new Map(); load(ALL).then(() => bus.emit('reset')); toast('Demo replay reset to the start'); },
    palette: () => openPalette(), retry: () => { location.reload(); },
  };
  const cmdApi = { nav: (p, q) => { ctx.closeOverlay(); ctx.nav(p, q); }, toggleReplay: () => { ctx.closeOverlay(); globalActions['replay-toggle'](); }, resetReplay: () => { ctx.closeOverlay(); globalActions['replay-reset'](); } };
  const commands = () => buildCommands({ symbols: store.get().meta.symbols.map((x) => x.symbol), tfs: store.get().meta.timeframes });
  function openPalette() { pal = { open: true, q: '', active: 0 }; drawPalette(); }
  function drawPalette() { ctx.overlay(paletteHtml(filterCommands(commands(), pal.q), pal.active, pal.q)); const i = root.querySelector('#palette-in'); i.focus(); i.setSelectionRange(pal.q.length, pal.q.length); }
  function runCmd(id) { const c = commands().find((x) => x.id === id); if (c) c.run(cmdApi); }

  delegate(root, 'click', '[data-action]', (e, el) => { const a = el.dataset.action; const pa = page?.actions?.[a]; if (pa) pa(ctx, el, e); else if (globalActions[a]) globalActions[a](ctx, el, e); });
  delegate(root, 'input', '[data-input]', (e, el) => page?.inputs?.[el.dataset.input]?.(ctx, el, e));
  delegate(root, 'change', '[data-change]', (e, el) => page?.inputs?.[el.dataset.change]?.(ctx, el, e));
  delegate(root, 'click', '[data-sort]', (e, el) => page?.actions?.sort?.(ctx, el, e));
  delegate(root, 'click', '[data-row]', (e, el) => page?.actions?.row?.(ctx, el, e));
  delegate(root, 'click', '[data-cmd]', (e, el) => runCmd(el.dataset.cmd));
  delegate(root, 'click', '#overlay', (e) => { if (e.target.id === 'overlay') ctx.closeOverlay(); });
  delegate(root, 'input', '#palette-in', (e, el) => { pal.q = el.value; pal.active = 0; drawPalette(); });
  win.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.open ? ctx.closeOverlay() : openPalette(); return; }
    if (e.key === 'Escape') { ctx.closeOverlay(); return; }
    if (pal.open) { const items = filterCommands(commands(), pal.q); if (e.key === 'ArrowDown') { pal.active = Math.min(items.length - 1, pal.active + 1); drawPalette(); e.preventDefault(); } else if (e.key === 'ArrowUp') { pal.active = Math.max(0, pal.active - 1); drawPalette(); e.preventDefault(); } else if (e.key === 'Enter' && items[pal.active]) runCmd(items[pal.active].id); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const nav = NAV.find((x) => x.key === e.key); if (nav) ctx.nav(nav.path); else if (e.key === ' ' && provider.supportsReplay && document.activeElement === document.body) { e.preventDefault(); globalActions['replay-toggle'](); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) chrome(); });

  return {
    ctx, store,
    async start() {
      setHTML(root, shellHtml()); observeStyles(root);
      try {
        const meta = await provider.get('meta'); store.set({ meta });
        await load(ALL); store.set({ loading: false }); router.start();
        timer = setInterval(tick, provider.supportsReplay ? 1000 : 5000);
      } catch (e) { setHTML(root, shellHtml()); showError(e); }
    },
    stop() { clearInterval(timer); cleanup?.(); router.stop(); },
    tick,
  };
}

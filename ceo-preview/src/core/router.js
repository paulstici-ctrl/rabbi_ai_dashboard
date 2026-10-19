export function parseHash(hash, fallback = '/overview') {
  const h = (hash || '').replace(/^#/, '');
  const [p, q = ''] = h.split('?');
  const path = p && p.startsWith('/') ? p : fallback;
  const query = {};
  for (const part of q.split('&')) { if (!part) continue; const [k, v = ''] = part.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v); }
  return { path, query };
}
export function buildHash(path, query = {}) {
  const q = Object.entries(query).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `#${path}${q ? '?' + q : ''}`;
}
export function createRouter(routes, onChange, win = globalThis) {
  const known = new Set(routes.map((r) => r.path));
  const resolve = () => { const r = parseHash(win.location.hash); return { ...r, path: known.has(r.path) ? r.path : '/overview' }; };
  const handler = () => onChange(resolve());
  win.addEventListener('hashchange', handler);
  return { start: handler, go: (path, query) => { win.location.hash = buildHash(path, query); }, current: resolve, stop: () => win.removeEventListener('hashchange', handler) };
}

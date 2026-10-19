// Data access boundary. Pages only talk to a provider; swapping DemoProvider for HttpProvider (Python/MT5 export)
// requires no UI change. Every payload is checked against its JSON contract before it reaches the UI.
import { validate } from './contracts.js';
import { demoPayloads, runDemoBacktest } from './demo/index.js';

export class DemoProvider {
  constructor() { this.mode = 'demo'; this.supportsReplay = true; this.supportsBacktest = true; }
  async get(kind, args = {}) {
    const c = args.cursor ?? 0, p = demoPayloads;
    switch (kind) {
      case 'meta': return p.meta();
      case 'candles': return p.candles(args.symbol, args.timeframe, c, args.limit ?? 500);
      case 'strategies': return p.strategies();
      default: return p[kind](c);
    }
  }
  async runBacktest(params) { return runDemoBacktest(params); }
}

export class HttpProvider {
  constructor(baseUrl, { fetchImpl = globalThis.fetch } = {}) { this.base = baseUrl.replace(/\/$/, ''); this.fetch = fetchImpl; this.mode = 'live-readonly'; this.supportsReplay = false; this.supportsBacktest = false; }
  url(kind, a) { return kind === 'candles' ? `${this.base}/candles/${a.symbol}_${a.timeframe}.json` : `${this.base}/${kind}.json`; }
  async get(kind, args = {}) { const r = await this.fetch(this.url(kind, args), { cache: 'no-store', credentials: 'omit' }); if (!r.ok) throw new Error(`${kind}: HTTP ${r.status}`); return r.json(); }
  async runBacktest() { return { unsupported: true }; }
}

export class ValidatingProvider {
  constructor(inner, { enabled = true } = {}) { this.inner = inner; this.enabled = enabled; }
  get mode() { return this.inner.mode; } get supportsReplay() { return this.inner.supportsReplay; } get supportsBacktest() { return this.inner.supportsBacktest; }
  async get(kind, args) { const payload = await this.inner.get(kind, args); if (this.enabled) validate(kind, payload); return payload; }
  runBacktest(p) { return this.inner.runBacktest(p); }
}

/** ?data=<url> switches to an HTTP export folder; default is the deterministic demo. */
export function createProvider(search = '') {
  const q = new URLSearchParams(search), data = q.get('data');
  const base = data ? new HttpProvider(data) : new DemoProvider();
  return new ValidatingProvider(base, { enabled: q.get('validate') !== '0' });
}

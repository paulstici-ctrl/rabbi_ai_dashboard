// Local OHLC CSV import (time,open,high,low,close[,volume]). Pure parser with hard limits; nothing is uploaded.
export const MAX_ROWS = 20000, MAX_BYTES = 5 * 1024 * 1024;
export function parseOhlcCsv(text) {
  const errors = [];
  if (text.length > MAX_BYTES) return { candles: [], errors: [`File larger than ${MAX_BYTES / 1048576} MB`] };
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { candles: [], errors: ['No data rows'] };
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const head = lines[0].split(delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idx = (names) => head.findIndex((h) => names.includes(h));
  const ix = { t: idx(['time', 'timestamp', 'date', 'datetime']), o: idx(['open', 'o']), h: idx(['high', 'h']), l: idx(['low', 'l']), c: idx(['close', 'c']), v: idx(['volume', 'vol', 'tick_volume', 'v']) };
  for (const k of ['t', 'o', 'h', 'l', 'c']) if (ix[k] < 0) errors.push(`Missing column: ${{ t: 'time', o: 'open', h: 'high', l: 'low', c: 'close' }[k]}`);
  if (errors.length) return { candles: [], errors };
  const out = [];
  for (let r = 1; r < lines.length && out.length < MAX_ROWS; r++) {
    const f = lines[r].split(delim).map((x) => x.trim().replace(/^"|"$/g, '')), tRaw = f[ix.t];
    let t = /^\d+(\.\d+)?$/.test(tRaw) ? Number(tRaw) : Date.parse(tRaw.includes('T') || tRaw.includes('Z') ? tRaw : tRaw.replace(' ', 'T').replace(/\./g, '-') + 'Z') / 1000;
    if (t > 1e11) t /= 1000;
    const o = Number(f[ix.o]), h = Number(f[ix.h]), l = Number(f[ix.l]), c = Number(f[ix.c]), v = ix.v >= 0 ? Number(f[ix.v]) : 0;
    if (![t, o, h, l, c].every(Number.isFinite) || h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) { if (errors.length < 5) errors.push(`Row ${r + 1} skipped (invalid values)`); continue; }
    out.push({ t: Math.floor(t), o, h, l, c, v: Number.isFinite(v) ? v : 0 });
  }
  out.sort((a, b) => a.t - b.t);
  const uniq = out.filter((c, i) => i === 0 || c.t !== out[i - 1].t);
  if (!uniq.length) errors.push('No valid rows');
  return { candles: uniq, errors };
}
export const guessDigits = (c) => { let d = 0; for (const x of c.slice(0, 200)) { const s = String(x.c), p = s.includes('.') ? s.split('.')[1].length : 0; d = Math.max(d, p); } return Math.min(6, Math.max(2, d)); };
export const guessTf = (c) => { if (c.length < 3) return 'M15'; const d = [] ; for (let i = 1; i < Math.min(50, c.length); i++) d.push(c[i].t - c[i - 1].t); d.sort((a, b) => a - b); const m = d[d.length >> 1]; return m <= 60 ? 'M1' : m <= 300 ? 'M5' : m <= 900 ? 'M15' : m <= 3600 ? 'H1' : 'H4'; };

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const pad2 = (n) => String(n).padStart(2, '0');
export const fmtPrice = (v, digits = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
export const fmtNum = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const fmtSigned = (v, d = 2, suffix = '') => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}${suffix}`);
export const fmtPct = (v, d = 2) => fmtSigned(v, d, '%');
export const fmtR = (v, d = 2) => fmtSigned(v, d, 'R');
export const fmtMoney = (v, cur = '$', d = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '−' : ''}${cur}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`);
export const fmtCompact = (v) => (v == null ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v)));
export function fmtDuration(s) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${Math.floor(s % 60)}s` : `${Math.floor(s)}s`;
}
const dt = (unix) => new Date(unix * 1000);
export const fmtTime = (unix) => { const d = dt(unix); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
export const fmtTimeS = (unix) => { const d = dt(unix); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`; };
export const fmtDate = (unix) => { const d = dt(unix); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
export const fmtDateTime = (unix) => `${fmtDate(unix)} ${fmtTime(unix)}`;
export const isoToUnix = (iso) => Math.floor(Date.parse(iso) / 1000);
export const unixToIso = (u) => new Date(u * 1000).toISOString().replace('.000Z', 'Z');
export function ago(nowUnix, thenUnix) { const s = Math.max(0, nowUnix - thenUnix); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; }
export const signClass = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat');

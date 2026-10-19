// Safe HTML templating: interpolated values are escaped unless they are SafeHtml.
export class SafeHtml { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const toHtml = (v) => (v instanceof SafeHtml ? v.s : Array.isArray(v) ? v.map(toHtml).join('') : v === false || v == null ? '' : esc(v));
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += toHtml(vals[i]); });
  return new SafeHtml(out);
}
export const raw = (s) => new SafeHtml(String(s));
export const setHTML = (el, h) => { if (el) el.innerHTML = String(h); };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function delegate(root, type, selector, handler) {
  const fn = (e) => { const t = e.target.closest?.(selector); if (t && root.contains(t)) handler(e, t); };
  root.addEventListener(type, fn);
  return () => root.removeEventListener(type, fn);
}
export const cls = (...a) => a.filter(Boolean).join(' ');

// style-src is "self" (no inline style attributes). Templates carry data-w / data-l / data-bg and the CSSOM applies them.
const STYLE_SEL = '[data-w],[data-l],[data-bg]';
function applyStyles(el) { if (el.dataset.w != null) el.style.width = el.dataset.w + '%'; if (el.dataset.l != null) el.style.left = el.dataset.l + '%'; if (el.dataset.bg) el.style.background = el.dataset.bg; }
export function hydrateStyles(node) { if (node.nodeType !== 1) return; if (node.matches(STYLE_SEL)) applyStyles(node); node.querySelectorAll(STYLE_SEL).forEach(applyStyles); }
export function observeStyles(root) { const mo = new MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach(hydrateStyles); }); mo.observe(root, { childList: true, subtree: true }); hydrateStyles(root); return mo; }

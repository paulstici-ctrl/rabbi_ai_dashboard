// Reusable presentation components. Each returns SafeHtml; values are escaped by the html`` tag.
import { html, raw, cls } from '../../core/dom.js';
import { fmtSigned, signClass } from '../../core/format.js';

export const panel = ({ title, sub, actions, body, className = '', id, hero = false }) => html`<section class="panel ${hero ? 'panel--hero' : ''} ${className}" ${id ? raw(`id="${id}"`) : ''}><header class="panel__head"><h2 class="panel__title">${title}</h2>${sub ? html`<span class="panel__sub">${sub}</span>` : ''}<div class="panel__actions">${actions || ''}</div></header><div class="panel__body">${body}</div></section>`;
export const chip = (text, variant = 'info', title = '') => html`<span class="chip chip--${variant}" ${title ? raw(`title="${String(title).replace(/"/g, '&quot;')}"`) : ''}>${text}</span>`;
export const dot = (variant) => html`<i class="dot dot--${variant}" aria-hidden="true"></i>`;
export const stat = ({ label, value, sub, tone = '', big = false }) => html`<div class="stat ${big ? 'stat--big' : ''}"><div class="stat__label">${label}</div><div class="stat__value ${tone}">${value}</div>${sub ? html`<div class="stat__sub">${sub}</div>` : ''}</div>`;
export const seg = (name, options, active, className = '') => html`<div class="seg ${className}" role="group" aria-label="${name}">${options.map((o) => { const v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label; return html`<button type="button" class="seg__btn" data-action="${name}" data-value="${v}" aria-pressed="${String(v === active)}">${l}</button>`; })}</div>`;
export const toggle = (action, value, label, on, title = '') => html`<button type="button" class="tgl" data-action="${action}" data-value="${value}" aria-pressed="${String(!!on)}" ${title ? raw(`title="${title}"`) : ''}>${label}</button>`;
export const btn = (label, action, { variant = '', value = '', icon: ic = '', title = '' } = {}) => html`<button type="button" class="btn ${variant ? 'btn--' + variant : ''}" data-action="${action}" ${value !== '' ? raw(`data-value="${String(value).replace(/"/g, '&quot;')}"`) : ''} ${title ? raw(`title="${title}"`) : ''}>${ic}${label}</button>`;
export const demoBadge = (text = 'DEMO DATA') => chip(text, 'demo', 'Synthetic data generated locally. Not live, not investment advice.');
export const actionChip = (a) => chip(a, a === 'BUY' ? 'buy' : a === 'SELL' ? 'sell' : 'wait');
export const stateChip = (s) => chip(s, { ACTIVE: 'ok', IDLE: 'idle', BLOCKED: 'warn', ERROR: 'err', HEALTHY: 'ok', DEGRADED: 'warn', DOWN: 'err', CONNECTED: 'ok', DISCONNECTED: 'warn', PASS: 'ok', WARN: 'warn', FAIL: 'err', OK: 'ok', ELEVATED: 'warn', WIDE: 'err', LOW: 'idle', NORMAL: 'info', HIGH: 'warn', WATCH: 'info', ARMED: 'ok', BLOCKED_: 'err', success: 'ok', failure: 'err', running: 'info', pending: 'idle', REJECTED: 'err', WAIT: 'warn', ELIGIBLE: 'ok', FROZEN: 'brand', PROPOSAL: 'violet', 'DEMO DATA': 'demo', STABLE: 'ok' }[s] || 'info');
export const signed = (v, d = 2, suffix = '') => html`<span class="${signClass(v)}">${fmtSigned(v, d, suffix)}</span>`;
export const empty = (text, hint = '') => html`<div class="empty"><div class="empty__t">${text}</div>${hint ? html`<div class="empty__h">${hint}</div>` : ''}</div>`;
export const kv = (rows) => html`<dl class="kv">${rows.map(([k, v]) => html`<div class="kv__row"><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
export const bar = ({ value, max = 100, tone = 'cyan', label = '', limitAt = null }) => { const pct = Math.max(0, Math.min(100, (value / max) * 100)); return html`<div class="bar bar--${tone}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i data-w="${pct.toFixed(1)}"></i>${limitAt != null ? html`<b class="bar__limit" data-l="${Math.min(100, (limitAt / max) * 100)}"></b>` : ''}${label ? html`<span class="bar__label">${label}</span>` : ''}</div>`; };
export const winLoss = (outs) => html`<div class="wl" aria-label="Recent simulated outcomes">${outs.map((o) => html`<i class="wl__c wl__c--${o}" title="${o === 'W' ? 'win' : o === 'L' ? 'loss' : 'breakeven'}"></i>`)}</div>`;

export function spark(values, { w = 84, h = 26, color = 'var(--cyan)', fill = true } = {}) {
  if (!values || values.length < 2) return html`<svg class="spark" width="${w}" height="${h}"></svg>`;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1, step = (w - 2) / (values.length - 1);
  const pts = values.map((v, i) => [1 + i * step, 1 + (1 - (v - lo) / span) * (h - 2)]), d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const up = values[values.length - 1] >= values[0], c = color === 'auto' ? (up ? 'var(--bull)' : 'var(--bear)') : color;
  return html`<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${fill ? raw(`<path d="${d}L${w - 1} ${h - 1}L1 ${h - 1}Z" fill="${c}" opacity="0.12"/>`) : ''}<path d="${d}" fill="none" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
export function table({ columns, rows, sortKey = null, sortDir = 'desc', rowId = null, rowClass = null, dense = true, empty: emptyText = 'No rows' }) {
  const head = columns.map((c) => html`<th class="${c.align === 'right' ? 'num' : ''} ${c.cls || ''}" ${c.sortable ? raw(`data-sort="${c.key}" role="button" tabindex="0"`) : ''} ${sortKey === c.key ? raw(`aria-sort="${sortDir === 'asc' ? 'ascending' : 'descending'}"`) : ''}>${c.label}${sortKey === c.key ? raw(sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`);
  const body = rows.map((r) => html`<tr ${rowId ? raw(`data-id="${String(rowId(r)).replace(/"/g, '&quot;')}"`) : ''} class="${rowClass ? rowClass(r) : ''}">${columns.map((c) => html`<td class="${c.align === 'right' ? 'num' : ''} ${c.cls || ''}" ${c.label ? raw(`data-label="${String(c.label).replace(/"/g, '&quot;')}"`) : ''}>${c.render ? c.render(r) : r[c.key]}</td>`)}</tr>`);
  return html`<div class="tbl-wrap"><table class="tbl ${dense ? 'tbl--dense' : ''}"><thead><tr>${head}</tr></thead><tbody>${rows.length ? body : html`<tr><td colspan="${columns.length}" class="tbl__empty">${emptyText}</td></tr>`}</tbody></table></div>`;
}
export const sevVariant = (s) => ({ info: 'info', ok: 'ok', warn: 'warn', error: 'err' }[s] || 'info');
export { cls };

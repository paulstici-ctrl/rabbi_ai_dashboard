import { html, esc } from '../core/dom.js';
import { NAV } from './shell.js';

export function buildCommands({ symbols, tfs }) {
  const cmds = NAV.map((n) => ({ id: `go:${n.path}`, label: `Go to ${n.label}`, hint: `key ${n.key}`, run: (a) => a.nav(n.path) }));
  for (const s of symbols) cmds.push({ id: `sym:${s}`, label: `Open ${s} in Terminal`, hint: 'symbol', run: (a) => a.nav('/terminal', { symbol: s }) });
  for (const t of tfs) cmds.push({ id: `tf:${t}`, label: `Terminal timeframe ${t}`, hint: 'timeframe', run: (a) => a.nav('/terminal', { tf: t }) });
  cmds.push({ id: 'replay', label: 'Toggle demo replay (play / pause)', hint: 'space', run: (a) => a.toggleReplay() }, { id: 'reset', label: 'Reset demo replay to start', hint: 'demo', run: (a) => a.resetReplay() }, { id: 'export', label: 'Journal: export filtered trades (CSV)', hint: 'journal', run: (a) => a.nav('/journal', { export: 'csv' }) });
  return cmds;
}
export const filterCommands = (cmds, q) => { const t = q.trim().toLowerCase(); return t ? cmds.filter((c) => c.label.toLowerCase().includes(t) || c.hint.toLowerCase().includes(t)) : cmds; };
export const paletteHtml = (items, active, q) => html`<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette"><input class="palette__in" id="palette-in" placeholder="Type a command or symbol…" value="${q}" autocomplete="off" spellcheck="false"/><ul class="palette__list" role="listbox">${items.slice(0, 9).map((c, i) => html`<li role="option" class="palette__it" data-cmd="${c.id}" aria-selected="${String(i === active)}"><span>${c.label}</span><kbd>${c.hint}</kbd></li>`)}${items.length ? '' : html`<li class="palette__none">No matching command</li>`}</ul></div>`;

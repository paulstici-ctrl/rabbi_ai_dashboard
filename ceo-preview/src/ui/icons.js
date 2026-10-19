import { raw } from '../core/dom.js';
const P = {
  ceo: '<rect x="5" y="4" width="14" height="16" rx="3"/><path d="M9 12h6M12 9v6M3 9h2M19 9h2M3 15h2M19 15h2"/>',
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  terminal: '<path d="M6 4v3M6 15v3M6 7h0M4.5 7h3v8h-3zM12 3v4M12 13v4M10.5 7h3v6h-3zM18 6v3M18 17v3M16.5 9h3v8h-3z"/>',
  agents: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="17" r="2.2"/><circle cx="19" cy="17" r="2.2"/><circle cx="12" cy="12" r="1.5"/><path d="M12 7.2v3.3M10.8 13l-4.5 2.6M13.2 13l4.5 2.6"/>',
  lab: '<path d="M9 3h6M10 3v6L5 18.5A1.5 1.5 0 0 0 6.3 21h11.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  journal: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
  system: '<path d="M3 12h4l2.5-7 4 14 2.5-7H21"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>', play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  skull: '<path d="M12 3a8 8 0 0 0-5 14.2V20h3v-2h4v2h3v-2.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>', filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
};
export const icon = (name, size = 18) => raw(`<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
export const logo = (size = 30) => raw(`<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ee7ff"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs><rect x="9" y="1.5" width="4.4" height="13" rx="2.2" transform="rotate(-9 11 8)" fill="none" stroke="url(#lg)" stroke-width="1.8"/><rect x="18.6" y="1.5" width="4.4" height="13" rx="2.2" transform="rotate(9 21 8)" fill="none" stroke="url(#lg)" stroke-width="1.8"/><rect x="5.5" y="12" width="21" height="17" rx="7" fill="rgba(94,231,255,0.07)" stroke="url(#lg)" stroke-width="1.8"/><circle cx="12" cy="20" r="1.7" fill="#5ee7ff"/><circle cx="20" cy="20" r="1.7" fill="#8b7bff"/></svg>`);

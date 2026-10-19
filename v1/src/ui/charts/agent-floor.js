// "Agent floor": animated network of the five AI agents, the data core and the MT5 feed.
// Pulses travel along the real message topology. Honours prefers-reduced-motion and pauses when hidden.
import { CanvasBase } from './canvas-base.js';
import { C, FONT, FONT_SM, reducedMotion } from './theme.js';
import { hexA } from './chart-math.js';

const NODES = { feed: [0.07, 0.5, 'MT5 FEED'], observer: [0.27, 0.27, 'OBSERVER'], analyst: [0.5, 0.14, 'ANALYST'], guardian: [0.74, 0.27, 'GUARDIAN'], core: [0.5, 0.5, 'CORE'], evaluator: [0.3, 0.8, 'EVALUATOR'], performance: [0.7, 0.8, 'PERFORMANCE'] };
export const EDGES = [['feed', 'observer'], ['observer', 'analyst'], ['analyst', 'guardian'], ['guardian', 'core'], ['observer', 'core'], ['core', 'evaluator'], ['core', 'performance'], ['evaluator', 'performance'], ['performance', 'guardian']];
const STATE_COLOR = { ACTIVE: C.cyan, IDLE: '#5b6f85', BLOCKED: C.amber, ERROR: C.bear };
export const edgeKey = (a, b) => `${a}>${b}`;

export class AgentFloor extends CanvasBase {
  constructor(el, opts = {}) {
    super(el);
    this.o = { compact: false, ...opts }; this.states = {}; this.selected = null; this.pulses = []; this.flash = new Map(); this.t0 = performance.now(); this.last = 0; this.motion = !reducedMotion(); this.hit = [];
    this.canvas.addEventListener('pointerdown', (e) => { const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = this.hit.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 8); if (h && h.id in this.states) this.opts_onSelect?.(h.id); });
    this.opts_onSelect = opts.onSelect; this._loop = this._loop.bind(this); if (this.motion) this._raf2 = requestAnimationFrame(this._loop);
  }
  setStates(states, selected) { this.states = states; this.selected = selected ?? this.selected; this.requestRender(); }
  message(from, to) { const k = edgeKey(from, to); this.flash.set(k, performance.now()); this.pulses.push({ k, p: 0, speed: 0.9, strong: true }); }
  _loop(ts) {
    if (this.destroyed || !this.el.isConnected) return;
    this._raf2 = requestAnimationFrame(this._loop);
    if (document.hidden || ts - this.last < 33 || !this.w) return;
    const dt = Math.min(0.1, (ts - this.last) / 1000); this.last = ts;
    for (const [a, b] of EDGES) { const act = this.states[a] === 'ACTIVE' ? 1 : 0; if (act && Math.random() < dt * 0.55) this.pulses.push({ k: edgeKey(a, b), p: 0, speed: 0.55 + Math.random() * 0.4 }); }
    this.pulses.forEach((p) => { p.p += dt * p.speed; }); this.pulses = this.pulses.filter((p) => p.p < 1).slice(-80);
    this.ctx.clearRect(0, 0, this.w, this.h); this.draw();
  }
  pos(id) { const n = NODES[id], pad = this.o.compact ? 26 : 40; return { x: pad + n[0] * (this.w - 2 * pad), y: pad * 0.8 + n[1] * (this.h - 2 * pad * 1.2) }; }
  draw() {
    const ctx = this.ctx, now = performance.now(), R = Math.max(12, Math.min(this.w, this.h) * (this.o.compact ? 0.075 : 0.07)); this.hit = [];
    for (const [a, b] of EDGES) { const A = this.pos(a), B = this.pos(b), f = this.flash.get(edgeKey(a, b)), hot = f && now - f < 1500; ctx.strokeStyle = hot ? hexA(C.cyan, 0.9) : 'rgba(94,231,255,0.16)'; ctx.lineWidth = hot ? 1.8 : 1; ctx.setLineDash(hot ? [] : [3, 5]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); }
    for (const p of this.pulses) { const [a, b] = p.k.split('>'), A = this.pos(a), B = this.pos(b), x = A.x + (B.x - A.x) * p.p, y = A.y + (B.y - A.y) * p.p; ctx.fillStyle = p.strong ? C.white : C.cyan; ctx.shadowColor = C.cyan; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, p.strong ? 3.2 : 2.2, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    for (const id of Object.keys(NODES)) {
      const P = this.pos(id), st = this.states[id], isAgent = id in this.states || ['observer', 'analyst', 'guardian', 'evaluator', 'performance'].includes(id), col = st ? STATE_COLOR[st] || C.cyan : id === 'core' ? C.violet : C.blue, r = id === 'core' ? R * 0.7 : R;
      const pulse = this.motion && st === 'ACTIVE' ? 0.5 + 0.5 * Math.sin((now - this.t0) / 500 + P.x) : 0.5;
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const ang = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(P.x + r * Math.cos(ang), P.y + r * Math.sin(ang)); } ctx.closePath();
      ctx.fillStyle = hexA(col, 0.1 + 0.08 * pulse); ctx.shadowColor = col; ctx.shadowBlur = st === 'ACTIVE' ? 10 + 8 * pulse : 0; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = hexA(col, this.selected === id ? 1 : 0.75); ctx.lineWidth = this.selected === id ? 2.4 : 1.4; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(P.x, P.y, id === 'core' ? 3 : 3.6 + pulse, 0, 7); ctx.fill();
      ctx.font = this.o.compact ? FONT_SM : FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = this.selected === id ? C.white : C.text; if (!(this.o.compact && id === 'core')) ctx.fillText(NODES[id][2], P.x, P.y + r + 4);
      if (st && !this.o.compact) { ctx.font = FONT_SM; ctx.fillStyle = col; ctx.fillText(st, P.x, P.y + r + 17); }
      this.hit.push({ id, x: P.x, y: P.y, r });
    }
    ctx.lineWidth = 1;
  }
}

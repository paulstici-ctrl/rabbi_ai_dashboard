// Multi-series line/area chart (equity curves, drawdown, strategy comparison). Canvas, hover/tap tooltip.
import { CanvasBase } from './canvas-base.js';
import { C, FONT, FONT_SM } from './theme.js';
import { niceTicks, nearestIndex, hexA } from './chart-math.js';
import { fmtDate } from '../../core/format.js';

export class LineChart extends CanvasBase {
  constructor(el, opts = {}) {
    super(el);
    this.o = { yFormat: (v) => v.toFixed(2), xFormat: (x) => fmtDate(x), log: false, zeroLine: true, compact: false, ...opts };
    this.series = []; this.bands = []; this.marks = []; this.cross = null; this._bind();
  }
  setSeries(s) { this.series = s; this.requestRender(); }
  setBands(b) { this.bands = b || []; this.requestRender(); }
  setMarks(m) { this.marks = m || []; this.requestRender(); }
  setOptions(o) { this.o = { ...this.o, ...o }; this.requestRender(); }
  _bind() {
    const cv = this.canvas, pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) { this.cross = pos(e); this.requestRender(); } });
    cv.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { this.cross = pos(e); this.requestRender(); } });
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.cross = null; this.requestRender(); } });
  }
  geo() {
    const c = this.o.compact, L = { left: 6, right: this.w - (c ? 40 : 58), top: 8, bottom: this.h - (c ? 6 : 20) };
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of this.series) for (const [x, y] of s.points) { if (!Number.isFinite(y)) continue; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    for (const b of this.bands) { xmin = Math.min(xmin, b.x0); xmax = Math.max(xmax, b.x1); }
    if (this.o.zeroLine && !this.o.log) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0); }
    if (!Number.isFinite(xmin)) return null;
    if (xmax === xmin) xmax = xmin + 1; const pad = (ymax - ymin || 1) * 0.08; ymin -= pad; ymax += pad;
    const f = this.o.log ? Math.log : (v) => v, lo = f(Math.max(ymin, this.o.log ? 1e-9 : -Infinity)), hi = f(ymax);
    return { L, xmin, xmax, ymin, ymax, X: (x) => L.left + ((x - xmin) / (xmax - xmin)) * (L.right - L.left), Y: (y) => L.bottom - ((f(y) - lo) / (hi - lo)) * (L.bottom - L.top) };
  }
  draw() {
    const g = this.geo(), ctx = this.ctx;
    if (!g) { ctx.fillStyle = C.textDim; ctx.font = FONT; ctx.fillText('No data', 12, 22); return; }
    const { L, X, Y } = g, o = this.o;
    ctx.font = o.compact ? FONT_SM : FONT; ctx.lineWidth = 1; ctx.textBaseline = 'middle';
    const { ticks } = niceTicks(g.ymin, g.ymax, o.compact ? 3 : 5);
    for (const t of ticks) { const y = Math.round(Y(t)) + 0.5; if (y < L.top || y > L.bottom) continue; ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.right, y); ctx.stroke(); ctx.fillStyle = C.axis; ctx.textAlign = 'left'; ctx.fillText(o.yFormat(t), L.right + 5, y); }
    if (!o.compact) { const n = 5; ctx.fillStyle = C.axis; ctx.textBaseline = 'top'; for (let k = 0; k < n; k++) { const x = g.xmin + ((g.xmax - g.xmin) * k) / (n - 1); ctx.textAlign = k === 0 ? 'left' : k === n - 1 ? 'right' : 'center'; ctx.fillText(o.xFormat(x), Math.min(L.right, Math.max(L.left, X(x))), L.bottom + 5); } }
    for (const b of this.bands) { const x0 = X(b.x0), x1 = X(b.x1); ctx.fillStyle = hexA(b.color, 0.07); ctx.fillRect(x0, L.top, x1 - x0, L.bottom - L.top); ctx.strokeStyle = hexA(b.color, 0.35); ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, L.top); ctx.lineTo(Math.round(x0) + 0.5, L.bottom); ctx.stroke(); if (b.label && !o.compact) { ctx.fillStyle = hexA(b.color, 0.95); ctx.font = FONT_SM; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(b.label, x0 + 5, L.top + 4); ctx.font = FONT; } }
    if (o.zeroLine && !o.log) { const y = Math.round(Y(0)) + 0.5; ctx.strokeStyle = 'rgba(232,240,247,0.25)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.right, y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.beginPath(); ctx.rect(L.left, L.top - 2, L.right - L.left, L.bottom - L.top + 4); ctx.clip();
    for (const s of this.series) {
      if (!s.points.length) continue;
      ctx.beginPath(); s.points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (s.fill) { const gr = ctx.createLinearGradient(0, L.top, 0, L.bottom); gr.addColorStop(0, hexA(s.color, 0.28)); gr.addColorStop(1, hexA(s.color, 0)); ctx.save(); ctx.lineTo(X(s.points.at(-1)[0]), L.bottom); ctx.lineTo(X(s.points[0][0]), L.bottom); ctx.closePath(); ctx.fillStyle = gr; ctx.fill(); ctx.restore(); ctx.beginPath(); s.points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.6; ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    ctx.restore();
    for (const m of this.marks) { const x = X(m.x); if (m.y != null) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(x, Y(m.y), 3.5, 0, 7); ctx.fill(); if (m.label && !o.compact) { ctx.font = FONT_SM; ctx.textAlign = x > L.right - 70 ? 'right' : 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(m.label, x + (x > L.right - 70 ? -6 : 6), Y(m.y) - 4); ctx.font = FONT; } } }
    const last = this.series[0]?.points.at(-1);
    if (last && this.series[0]) { ctx.fillStyle = this.series[0].color; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 3, 0, 7); ctx.fill(); }
    if (this.cross && this.cross.x >= L.left && this.cross.x <= L.right && this.series[0]) {
      const xs = this.series[0].points.map((p) => p[0]), xv = g.xmin + ((this.cross.x - L.left) / (L.right - L.left)) * (g.xmax - g.xmin), k = nearestIndex(xs, xv), cx = Math.round(X(xs[k])) + 0.5;
      ctx.strokeStyle = 'rgba(232,240,247,0.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, L.top); ctx.lineTo(cx, L.bottom); ctx.stroke(); ctx.setLineDash([]);
      const rows = this.series.map((s) => { const p = s.points[nearestIndex(s.points.map((q) => q[0]), xs[k])]; return p ? { s, y: p[1] } : null; }).filter(Boolean);
      ctx.font = FONT_SM; const lines = [o.xFormat(xs[k]), ...rows.map((r) => `${r.s.name}: ${o.yFormat(r.y)}`)], bw = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 14, bh = lines.length * 14 + 8, bx = cx + 10 + bw > L.right ? cx - bw - 10 : cx + 10;
      ctx.fillStyle = 'rgba(12,19,27,0.94)'; ctx.fillRect(bx, L.top + 4, bw, bh); ctx.strokeStyle = '#243446'; ctx.strokeRect(bx + 0.5, L.top + 4.5, bw, bh);
      lines.forEach((t, i) => { ctx.fillStyle = i ? rows[i - 1].s.color : C.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, bx + 7, L.top + 4 + 11 + i * 14); });
      for (const r of rows) { ctx.fillStyle = r.s.color; ctx.beginPath(); ctx.arc(cx, Y(r.y), 3.5, 0, 7); ctx.fill(); }
    }
  }
}

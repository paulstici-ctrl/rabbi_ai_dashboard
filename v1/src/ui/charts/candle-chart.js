// Interactive candlestick chart on <canvas>: pan, wheel/pinch zoom, crosshair, overlays. No dependencies.
import { CanvasBase } from './canvas-base.js';
import { C, FONT, FONT_SM } from './theme.js';
import { niceTicks, priceExtent, xOfIndex, indexOfX, yOfPrice, priceOfY, clampView, zoomAround, timeTicks, hexA } from './chart-math.js';
import { ema, closes } from '../../domain/indicators.js';
import { fmtPrice, fmtDateTime } from '../../core/format.js';

const LAYERS = { zones: true, lines: true, levels: true, markers: true, sweeps: true, ema: true, volume: true, annotations: true };
export class CandleChart extends CanvasBase {
  constructor(el, opts = {}) {
    super(el);
    this.o = { digits: 2, tf: 'M15', compact: false, ...opts }; this.layers = { ...LAYERS, ...(opts.layers || {}) };
    this.candles = []; this.overlays = {}; this.barW = this.o.compact ? 5 : 8; this.viewStart = 0; this.rightPad = 8; this.cross = null; this.follow = true;
    this.pointers = new Map(); this.listeners = {}; this._bind();
  }
  on(evt, fn) { this.listeners[evt] = fn; return this; }
  setLayers(l) { this.layers = { ...this.layers, ...l }; this.requestRender(); }
  setOptions(o) { this.o = { ...this.o, ...o }; this.requestRender(); }
  setOverlays(ov) { this.overlays = ov || {}; this.requestRender(); }
  setData(candles, { reset = false } = {}) {
    const prevN = this.candles.length, vis = this.visible(), atEnd = this.viewStart + vis >= prevN + this.rightPad - 1.5;
    this.candles = candles; this._ema = null;
    if (reset || prevN === 0 || (this.follow && atEnd)) this.viewStart = clampView(candles.length - this.visible() + this.rightPad, candles.length, this.visible(), this.rightPad);
    this.requestRender();
  }
  resetView() { this.barW = this.o.compact ? 5 : 8; this.follow = true; this.viewStart = clampView(this.candles.length - this.visible() + this.rightPad, this.candles.length, this.visible(), this.rightPad); this.requestRender(); }
  layout() {
    const axisW = this.o.compact ? 58 : 66, axisH = this.o.compact ? 16 : 22, top = 6, left = 0, plotW = this.w - axisW, plotH = this.h - axisH - top;
    const volH = this.layers.volume ? Math.round(plotH * 0.15) : 0;
    return { left, top, axisW, axisH, plotW, plotH, volH, priceH: plotH - volH - (volH ? 4 : 0), right: left + plotW };
  }
  visible() { return Math.max(5, (this.w - (this.o.compact ? 58 : 66)) / this.barW); }
  onResize() { if (this.candles?.length && this.follow) this.viewStart = clampView(this.candles.length - this.visible() + this.rightPad, this.candles.length, this.visible(), this.rightPad); }
  emaOf(n) { this._ema = this._ema || {}; return this._ema[n] || (this._ema[n] = ema(closes(this.candles), n)); }

  // ---------- interaction ----------
  _bind() {
    const cv = this.canvas, pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); const p = pos(e); this.pointers.set(e.pointerId, { ...p, sx: p.x, sy: p.y, t: Date.now(), moved: false, type: e.pointerType }); if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), barW: this.barW }; } });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e), st = this.pointers.get(e.pointerId);
      if (!st) { if (e.pointerType === 'mouse') { this.cross = p; this._emitCross(); this.requestRender(); } return; }
      const dx = p.x - st.x; st.x = p.x; st.y = p.y;
      if (Math.hypot(p.x - st.sx, p.y - st.sy) > 5) st.moved = true;
      if (this.pointers.size === 2 && this._pinch) { const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), L = this.layout(); const z = zoomAround(this.viewStart, this.barW, (a.x + b.x) / 2, L.left, (this._pinch.barW * d / this._pinch.d) / this.barW); this.barW = z.barW; this.viewStart = clampView(z.viewStart, this.candles.length, this.visible(), this.rightPad); this.follow = false; }
      else if (st.moved) { this.viewStart = clampView(this.viewStart - dx / this.barW, this.candles.length, this.visible(), this.rightPad); this.follow = this.viewStart + this.visible() >= this.candles.length + this.rightPad - 1.5; if (e.pointerType === 'mouse') this.cross = p; }
      this.requestRender();
    });
    const up = (e) => { const st = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this._pinch = null; if (st && !st.moved && st.type !== 'mouse' && Date.now() - st.t < 450) { this.cross = this.cross ? null : { x: st.x, y: st.y }; this._emitCross(); this.requestRender(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.cross = null; this._emitCross(); this.requestRender(); } });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e), z = zoomAround(this.viewStart, this.barW, p.x, this.layout().left, Math.exp(-e.deltaY * 0.0016)); this.barW = z.barW; this.viewStart = clampView(z.viewStart, this.candles.length, this.visible(), this.rightPad); this.follow = false; this.requestRender(); }, { passive: false });
    cv.addEventListener('dblclick', () => this.resetView());
    cv.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowLeft' || k === 'ArrowRight') { this.viewStart = clampView(this.viewStart + (k === 'ArrowLeft' ? -5 : 5), this.candles.length, this.visible(), this.rightPad); this.follow = false; } else if (k === '+' || k === '=') this.barW = Math.min(44, this.barW * 1.15); else if (k === '-') this.barW = Math.max(2, this.barW / 1.15); else if (k === 'Home' || k === 'End') this.resetView(); else return; e.preventDefault(); this.requestRender(); });
  }
  _emitCross() { const L = this.layout(), i = this.cross ? indexOfX(this.cross.x, this.viewStart, this.barW, L.left) : -1; this.listeners.cross?.(i >= 0 && i < this.candles.length ? { index: i, candle: this.candles[i] } : null); }

  // ---------- drawing ----------
  draw() {
    const ctx = this.ctx, L = this.layout(), n = this.candles.length, o = this.o;
    if (!n || L.plotW < 40) { ctx.fillStyle = C.textDim; ctx.font = FONT; ctx.fillText('No data', 12, 22); return; }
    const vis = this.visible(), i0 = Math.floor(this.viewStart), i1 = Math.ceil(this.viewStart + vis), lv = this.layers, ov = this.overlays;
    const extra = lv.levels ? (ov.levels || []).map((l) => l.price) : [];
    const { lo, hi } = priceExtent(this.candles, i0, i1, extra), X = (i) => xOfIndex(i, this.viewStart, this.barW, L.left), Y = (p) => yOfPrice(p, lo, hi, L.top, L.priceH);
    this._geo = { L, lo, hi, X, Y };
    // grid + price axis
    const { ticks } = niceTicks(lo, hi, o.compact ? 4 : 7);
    ctx.font = o.compact ? FONT_SM : FONT; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (const p of ticks) { const y = Math.round(Y(p)) + 0.5; ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.right, y); ctx.stroke(); ctx.fillStyle = C.axis; ctx.textAlign = 'left'; ctx.fillText(fmtPrice(p, o.digits), L.right + 5, y); }
    const tt = timeTicks(this.candles, i0, i1, o.tf, L.plotW, vis, o.compact ? 70 : 90);
    for (const t of tt) { const x = Math.round(X(t.i)) + 0.5; ctx.strokeStyle = 'rgba(120,150,180,0.06)'; ctx.beginPath(); ctx.moveTo(x, L.top); ctx.lineTo(x, L.top + L.plotH); ctx.stroke(); if (!o.compact) { ctx.fillStyle = C.axis; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(t.label, Math.min(L.right - 16, Math.max(16, x)), L.top + L.plotH + 5); } }
    ctx.save(); ctx.beginPath(); ctx.rect(L.left, L.top, L.plotW, L.plotH); ctx.clip();
    // zones
    if (lv.zones) for (const z of ov.zones || []) { const x0 = Math.max(L.left, X(z.firstI)), y0 = Y(z.hi), y1 = Y(z.lo), col = z.type === 'support' ? C.bull : C.bear; ctx.fillStyle = hexA(col, 0.09); ctx.fillRect(x0, y0, L.right - x0, y1 - y0); ctx.strokeStyle = hexA(col, 0.45); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x0, y0 + 0.5); ctx.lineTo(L.right, y0 + 0.5); ctx.moveTo(x0, y1 - 0.5); ctx.lineTo(L.right, y1 - 0.5); ctx.stroke(); if (!o.compact) { ctx.fillStyle = hexA(col, 0.9); ctx.font = FONT_SM; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`${z.type === 'support' ? 'SUP' : 'RES'} ×${z.touches}`, Math.max(L.left + 4, x0 + 4), y0 - 2); } }
    // volume
    if (lv.volume && L.volH) { let vmax = 1; for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) vmax = Math.max(vmax, this.candles[i].v); const base = L.top + L.plotH; for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) { const c = this.candles[i], h = (c.v / vmax) * L.volH; ctx.fillStyle = hexA(c.c >= c.o ? C.bull : C.bear, 0.28); ctx.fillRect(X(i) - this.barW * 0.35, base - h, Math.max(1, this.barW * 0.7), h); } }
    // trend lines
    if (lv.lines) for (const l of ov.lines || []) { const slope = (l.y2 - l.y1) / (l.x2 - l.x1), col = l.kind === 'support' ? C.bull : C.bear; ctx.strokeStyle = hexA(col, 0.8); ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(l.x1), Y(l.y1)); ctx.lineTo(X(l.to), Y(l.y1 + slope * (l.to - l.x1))); ctx.stroke(); ctx.setLineDash([]); }
    // candles
    const w = Math.max(1, Math.floor(this.barW * 0.68));
    for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
      const c = this.candles[i], x = Math.round(X(i)) + 0.5, up = c.c >= c.o, col = up ? C.bull : C.bear, yO = Y(c.o), yC = Y(c.c);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
      const top = Math.min(yO, yC), h = Math.max(1, Math.abs(yC - yO)); if (this.barW >= 3) ctx.fillRect(Math.round(x - w / 2), top, w, h);
    }
    // EMAs
    if (lv.ema && n > 20) for (const [len, col] of [[20, C.cyan], [50, C.violet]]) { const e = this.emaOf(len); ctx.strokeStyle = hexA(col, 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); let first = true; for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) { const x = X(i), y = Y(e[i]); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); } ctx.stroke(); ctx.lineWidth = 1; }
    // sweeps
    if (lv.sweeps) for (const s of ov.sweeps || []) { if (s.i < i0 - 2 || s.i > i1 + 2) continue; const x = X(s.i), c = this.candles[s.i]; if (!c) continue; const bear = s.kind === 'BUY_SIDE', col = bear ? C.bear : C.bull; ctx.strokeStyle = hexA(col, 0.7); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(s.pivotI), Y(s.level)); ctx.lineTo(x, Y(s.level)); ctx.stroke(); ctx.setLineDash([]); const y = bear ? Y(c.h) - 9 : Y(c.l) + 9; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, bear ? y + 5 : y - 5); ctx.lineTo(x - 4, bear ? y - 3 : y + 3); ctx.lineTo(x + 4, bear ? y - 3 : y + 3); ctx.closePath(); ctx.fill(); if (!o.compact) { ctx.font = FONT_SM; ctx.textAlign = 'center'; ctx.textBaseline = bear ? 'bottom' : 'top'; ctx.fillText('SWEEP', x, bear ? y - 5 : y + 5); } }
    // markers (signals, simulated entries/exits)
    if (lv.markers) for (const m of ov.markers || []) { if (m.i < i0 - 2 || m.i > i1 + 2) continue; const c = this.candles[m.i]; if (!c) continue; const x = X(m.i), buy = m.side === 'BUY', col = m.kind === 'exit' ? C.amber : buy ? C.bull : C.bear, y = buy ? Y(c.l) + 13 : Y(c.h) - 13; ctx.fillStyle = col; ctx.beginPath(); if (m.kind === 'exit') { ctx.arc(x, buy ? Y(c.h) - 8 : Y(c.l) + 8, 3.5, 0, 7); } else { ctx.moveTo(x, buy ? y - 7 : y + 7); ctx.lineTo(x - 5, buy ? y + 3 : y - 3); ctx.lineTo(x + 5, buy ? y + 3 : y - 3); ctx.closePath(); } ctx.fill(); if (!o.compact && m.label) { ctx.font = FONT_SM; ctx.textAlign = 'center'; ctx.textBaseline = buy ? 'top' : 'bottom'; ctx.fillText(m.label, x, buy ? y + 5 : y - 5); } }
    // annotations
    if (lv.annotations && !o.compact) for (const a of ov.annotations || []) { const x = Math.round(X(a.i)) + 0.5; ctx.strokeStyle = hexA(C.amber, 0.55); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, L.top); ctx.lineTo(x, L.top + L.plotH); ctx.stroke(); ctx.setLineDash([]); ctx.font = FONT_SM; const tw = ctx.measureText(a.text).width + 10; ctx.fillStyle = 'rgba(255,179,71,0.14)'; ctx.fillRect(x + 4, L.top + 4, tw, 16); ctx.strokeStyle = hexA(C.amber, 0.5); ctx.strokeRect(x + 4.5, L.top + 4.5, tw, 16); ctx.fillStyle = C.amber; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(a.text, x + 9, L.top + 12.5); }
    // level lines (entry / SL / TP)
    ctx.restore();
    if (lv.levels) for (const lvl of ov.levels || []) { const y = Math.round(Y(lvl.price)) + 0.5; if (y < L.top || y > L.top + L.plotH) continue; ctx.strokeStyle = lvl.color; ctx.setLineDash(lvl.dash || [5, 3]); ctx.beginPath(); ctx.moveTo(L.left, y); ctx.lineTo(L.right, y); ctx.stroke(); ctx.setLineDash([]); this._tag(ctx, L.right, y, `${lvl.label} ${fmtPrice(lvl.price, o.digits)}`, lvl.color, L.axisW + 40, '#071018'); }
    // last price tag
    const last = this.candles[n - 1], yl = Y(last.c);
    if (yl > L.top && yl < L.top + L.plotH) { ctx.strokeStyle = hexA(last.c >= last.o ? C.bull : C.bear, 0.5); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(L.left, Math.round(yl) + 0.5); ctx.lineTo(L.right, Math.round(yl) + 0.5); ctx.stroke(); ctx.setLineDash([]); this._tag(ctx, L.right, yl, fmtPrice(last.c, o.digits), last.c >= last.o ? C.bull : C.bear, L.axisW, '#04120d'); }
    // crosshair
    let hover = null;
    if (this.cross && this.cross.x < L.right && this.cross.y > L.top && this.cross.y < L.top + L.plotH) {
      const idx = Math.max(0, Math.min(n - 1, indexOfX(this.cross.x, this.viewStart, this.barW, L.left))), cx = Math.round(X(idx)) + 0.5, cy = Math.round(this.cross.y) + 0.5; hover = this.candles[idx];
      ctx.strokeStyle = 'rgba(232,240,247,0.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, L.top); ctx.lineTo(cx, L.top + L.plotH); ctx.moveTo(L.left, cy); ctx.lineTo(L.right, cy); ctx.stroke(); ctx.setLineDash([]);
      if (this.cross.y <= L.top + L.priceH) this._tag(ctx, L.right, cy, fmtPrice(priceOfY(this.cross.y, lo, hi, L.top, L.priceH), o.digits), '#2a3b4d', L.axisW, C.white);
      if (!o.compact) { ctx.font = FONT; const label = fmtDateTime(hover.t), tw = ctx.measureText(label).width + 12, tx = Math.min(Math.max(cx - tw / 2, 0), L.right - tw); ctx.fillStyle = '#2a3b4d'; ctx.fillRect(tx, L.top + L.plotH + 2, tw, 17); ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, tx + tw / 2, L.top + L.plotH + 11); }
    }
    // legend
    const c = hover || last, prev = hover ? this.candles[Math.max(0, this.candles.indexOf(hover) - 1)] : this.candles[n - 2] || last, d = prev ? ((c.c / prev.c) - 1) * 100 : 0, col = c.c >= c.o ? C.bull : C.bear;
    ctx.font = o.compact ? FONT_SM : FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const segs = []; const add = (t, colr) => { if (t) segs.push([t, colr]); };
    if (!o.compact) { add('O', C.textDim); add(fmtPrice(c.o, o.digits), col); add('H', C.textDim); add(fmtPrice(c.h, o.digits), col); add('L', C.textDim); add(fmtPrice(c.l, o.digits), col); add('C', C.textDim); } add(fmtPrice(c.c, o.digits), col); add(`${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}%`, col);
    if (!o.compact && this.layers.ema) { add('EMA20', C.cyan); add('EMA50', C.violet); }
    const total = segs.reduce((acc, [t]) => acc + ctx.measureText(t).width + 8, 0);
    ctx.fillStyle = 'rgba(8,13,19,0.72)'; ctx.fillRect(4, 4, Math.min(L.right - 8, total + 8), o.compact ? 16 : 20);
    let x = 8; for (const [t, colr] of segs) { ctx.fillStyle = colr; ctx.fillText(t, x, o.compact ? 7 : 8); x += ctx.measureText(t).width + 8; }
    ctx.fillStyle = 'rgba(255,179,71,0.55)'; ctx.font = FONT_SM; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; if (!o.compact) ctx.fillText('DEMO DATA', L.right - 8, L.top + L.priceH - 6);
    this.listeners.legend?.(c);
  }
  _tag(ctx, xRight, y, text, bg, minW, fg) { ctx.font = this.o.compact ? FONT_SM : FONT; const w = Math.max(minW, ctx.measureText(text).width + 10), h = 16; ctx.fillStyle = bg; ctx.fillRect(xRight, Math.round(y - h / 2), w, h); ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, xRight + 5, Math.round(y)); }
}

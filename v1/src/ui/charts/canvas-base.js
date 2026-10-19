// Shared canvas plumbing: DPR-aware sizing, resize observation, coalesced rendering.
export class CanvasBase {
  constructor(el) {
    this.el = el; this.canvas = document.createElement('canvas'); this.canvas.className = 'chart-canvas';
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none'; this.canvas.tabIndex = 0;
    el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d'); this.w = 0; this.h = 0; this.dpr = 1; this._raf = 0; this.destroyed = false;
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null; this._ro?.observe(el);
    this.resize();
  }
  resize() {
    const r = this.el.getBoundingClientRect(), dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (!r.width || !r.height) return;
    this.w = Math.round(r.width); this.h = Math.round(r.height); this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.onResize?.(); this.requestRender();
  }
  requestRender() { if (this._raf || this.destroyed) return; this._raf = requestAnimationFrame(() => { this._raf = 0; if (!this.destroyed && this.w) { this.ctx.clearRect(0, 0, this.w, this.h); this.draw(); } }); }
  destroy() { this.destroyed = true; cancelAnimationFrame(this._raf); this._ro?.disconnect(); this.canvas.remove(); }
}

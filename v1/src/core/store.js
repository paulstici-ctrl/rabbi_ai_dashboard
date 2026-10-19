export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) { const keys = Object.keys(patch).filter((k) => state[k] !== patch[k]); if (!keys.length) return; state = { ...state, ...patch }; subs.forEach((f) => f(state, keys)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
export function createBus() {
  const m = new Map();
  return { on(t, f) { (m.get(t) || m.set(t, new Set()).get(t)).add(f); return () => m.get(t)?.delete(f); }, emit(t, p) { m.get(t)?.forEach((f) => f(p)); } };
}

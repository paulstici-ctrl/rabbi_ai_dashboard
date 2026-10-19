// Per-symbol parameter validation: mirrors rabbit_research/config.py so the UI warns about the same traps as the engine.
export function validateParams(p) {
  const errors = [], warnings = [];
  for (const k of ['pip_size', 'spread_floor_pips', 'max_spread_pips', 'min_stop_pips', 'max_spread_r', 'stop_atr', 'target_r', 'wick_ratio', 'max_tick_gap_s']) if (!(Number(p[k]) > 0)) errors.push(`${k} must be > 0`);
  if (p.latency_ms < 0) errors.push('latency_ms cannot be negative');
  if (p.spread_floor_pips > p.max_spread_pips) errors.push('spread_floor_pips exceeds max_spread_pips');
  const ratio = p.spread_floor_pips / p.min_stop_pips;
  if (p.min_stop_pips > 0 && ratio > p.max_spread_r + 1e-12) errors.push(`min_stop_pips=${p.min_stop_pips} is unreachable: floor/min_stop = ${(ratio * 100).toFixed(0)}% > max_spread_r = ${(p.max_spread_r * 100).toFixed(0)}%. The smallest accepted stop is ${(p.spread_floor_pips / p.max_spread_r).toFixed(0)} pips (hidden volatility filter).`);
  if (p.target_r > 2) warnings.push('target_r above 2R rarely fills within 30–120 s horizons');
  if (p.latency_ms === 0) warnings.push('0 ms latency is optimistic; run 250 and 1000 ms sensitivities');
  return { ok: errors.length === 0, errors, warnings, costR: ratio };
}

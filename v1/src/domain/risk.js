export const pipsBetween = (a, b, pip) => Math.abs(a - b) / pip;
export const rMultiple = (side, entry, exit, sl) => { const risk = Math.abs(entry - sl); return risk > 0 ? ((side === 'BUY' ? exit - entry : entry - exit) / risk) : NaN; };
export const riskReward = (side, entry, sl, tp) => { const r = Math.abs(entry - sl); return r > 0 ? Math.abs(tp - entry) / r : NaN; };
// Lots needed so that a stop-out loses riskAmount. pipValuePerLot is a DEMO constant until MT5 symbol_info supplies it.
export const positionSize = ({ equity, riskPct, stopPips, pipValuePerLot }) => { const riskAmount = equity * riskPct / 100; const lots = stopPips > 0 && pipValuePerLot > 0 ? riskAmount / (stopPips * pipValuePerLot) : NaN; return { riskAmount, lots }; };
export const spreadGate = ({ spreadPips, floorPips, stopPrice, pip, maxSpreadR }) => { const effective = Math.max(spreadPips, floorPips) * pip, ratio = stopPrice > 0 ? effective / stopPrice : Infinity; return { effectivePips: effective / pip, ratio, passed: ratio <= maxSpreadR + 1e-12 }; };
export const floatingR = (pos, price) => rMultiple(pos.side, pos.entry, price, pos.stop_loss);

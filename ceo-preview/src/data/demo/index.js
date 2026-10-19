import { SYMBOLS, SYMBOL_CFG, TIMEFRAMES, DEMO_NOW, candlesAt, quoteAt } from './market.js';
import { journalAt, accountAt, strategiesAt, runDemoBacktest } from './trading.js';
import { signalsAt, scannerAt, agentsAt, eventsAt } from './intel.js';
import { systemAt } from './system.js';
import { makeHeader } from '../contracts.js';

const H = (cursor) => makeHeader(DEMO_NOW + cursor * 60, 'demo', 'demo-generator');
/** Every method returns a payload that satisfies contracts/<name>.schema.json. */
export const demoPayloads = {
  meta: () => ({ ...H(0), trading_enabled: false, engine: { baseline: 'V7.2.1 (frozen)', simulator: 'V7.3.1 (proposal)', validation: 'WAIT' }, timeframes: TIMEFRAMES, disclaimers: ['DEMO DATA: synthetic prices, trades and results. Not live, not investment advice.', 'No broker connection. Live trading is not implemented in this build.', 'Simulated results are not evidence of a profitable strategy.'], symbols: SYMBOLS.map((s) => { const { start, sigma, base_spread_pips, seed, ...pub } = SYMBOL_CFG[s]; return pub; }) }),
  quotes: (c = 0) => ({ ...H(c), quotes: SYMBOLS.map((s) => quoteAt(s, c)) }),
  candles: (symbol, timeframe, c = 0, limit = 500) => ({ ...H(c), symbol, timeframe, candles: candlesAt(symbol, timeframe, c, limit).map((k) => ({ t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v })) }),
  signals: (c = 0) => ({ ...H(c), signals: signalsAt(c) }),
  scanner: (c = 0) => ({ ...H(c), opportunities: scannerAt(c) }),
  agents: (c = 0) => ({ ...H(c), ...agentsAt(c) }),
  account: (c = 0) => ({ ...H(c), ...accountAt(c) }),
  strategies: () => ({ ...H(0), ...strategiesAt() }),
  journal: (c = 0) => ({ ...H(c), ...journalAt(c) }),
  system: (c = 0) => ({ ...H(c), ...systemAt(c) }),
  events: (c = 0) => ({ ...H(c), events: eventsAt(c) }),
};
export { runDemoBacktest };

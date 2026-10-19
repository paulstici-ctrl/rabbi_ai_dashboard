# Architecture

## Principles
1. **Separate data, logic and presentation.** `src/data` (sources and contracts), `src/domain` (pure functions), `src/ui` (rendering). Domain code has no DOM and no randomness except seeded PRNGs, so it is unit-tested in Node.
2. **Contracts first.** Every payload the UI consumes has a JSON schema (`contracts/`). The provider validates each payload before it reaches a page; a violation shows an explicit error panel instead of rendering wrong numbers.
3. **Full skeleton on demo data.** `DemoProvider` serves deterministic synthetic data through the same interface a live provider will use.
4. **Read-only and safe.** No order code. Strict CSP (`script-src 'self'; style-src 'self'`, no inline scripts or style attributes; dynamic widths use `data-*` hydrated through the CSSOM). All template values are HTML-escaped by the `html` tag. CSV export neutralises spreadsheet formulas.

## Data flow
```
DemoProvider | HttpProvider  ->  ValidatingProvider (contracts.js)  ->  app.js store (data, cursor, replay)
                                                                            |
                                   region renderers (pages) <---- bus 'data' / 'reset' events -----+
                                   canvas charts updated imperatively (setData / setSeries)
```
- `app.js` owns routing (`#/route?query`), the replay clock (1 s tick, 1x/4x/16x), refresh cadence (fast: quotes, account every tick; slow: signals, scanner, agents, events, journal, system every 5th tick), global actions, keyboard and the command palette.
- A **page** is `{ id, title, regions, layout, mount, actions, inputs }`. A **region** is `{ deps, render }`: when a data kind in `deps` refreshes, only that region's HTML is replaced. Charts live outside refreshing regions and are updated imperatively, so zoom/pan state survives data ticks. `ctx.refresh(['ui'])` re-renders regions whose deps include a UI-state key.
- Pages only call `ctx.d.<kind>`, `ctx.candles(symbol, tf, limit)`, `ctx.cfg(symbol)`, `ctx.nav`, `ctx.toast`, `ctx.provider`; they never import demo modules (except Lab's demo-only helpers via the provider).

## Contracts (`src/data/contracts.js`)
`meta, quotes, candles, signals, scanner, agents, account, strategies, journal, system, events`. All carry the header `{schema_version: 1, mode: demo|live-readonly, generated_utc, as_of_utc, source}`.
Hard rules encoded in the schemas: `meta.trading_enabled` and `system.safety.trading_enabled` must be `false`; `journal.trades[].simulated` must be `true`; `scanner.score_kind` must be `"heuristic"`; signal `probability` is `null` unless a validated source is declared.

## Demo world (`src/data/demo/`)
- `market.js`: seeded regime-switching random walks with session volatility, M1 base series (about 29,000 candles per symbol) aggregated to M5/M15/H1/H4 without look-ahead; fixed "as of" clock 2026-10-19 12:00 UTC; spreads and quotes derived from the series.
- `trading.js`: simulated trades walked over the M1 candles (stop checked before target, spread floor applied), paper account (USD 10,000, 0.25% risk per R), strategy lab results (day-block bootstrap CIs, BH-FDR adjusted p-values, frozen test split). Seed `lab7` is pinned so no demo strategy is eligible or unrealistically profitable (tested).
- `intel.js`: signals, scanner, agents, events derived from the domain functions on the same candles. `system.js`: MT5 / feed / CI / logs.

## Domain (`src/domain/`)
`indicators` (SMA, EMA, ATR, RSI), `structure` (pivots confirmed k candles late, S/R zones, trend, liquidity sweeps, regime, trend lines), `signals` (illustrative BUY/SELL/WAIT engine with explanations; probability always `null`), `stats` (equity, drawdown, profit factor, day-block bootstrap, BH adjustment), `risk` (R multiples, sizing, spread gate), `params` (mirrors the Python config validation), `csv`, `export`.

## Charts (`src/ui/charts/`)
Canvas, no libraries, DPR-aware, `ResizeObserver`, coalesced `requestAnimationFrame` rendering.
- `CandleChart`: pan, wheel and pinch zoom, tap/hover crosshair, keyboard, volume pane, EMAs, zones, trend lines, sweeps, markers, level lines, annotations.
- `LineChart`: multi-series, areas, bands (train / validation / test), peak/lowest marks, tooltip.
- `AgentFloor`: hexagon network of five agents plus CORE and MT5 FEED; pulses follow agent activity; honours `prefers-reduced-motion`; pauses when the tab is hidden.
- `chart-math.js` is pure and unit-tested.

## Quality gates
`npm test` (40 tests) covers indicators, structure (no look-ahead), signals gate, stats, risk, market determinism and aggregation, trades/account/lab consistency, contract validation (including that demo payloads satisfy every schema at several replay cursors), chart geometry, CSV parsing limits, parameter validation and export escaping.

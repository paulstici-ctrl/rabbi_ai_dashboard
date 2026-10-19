# Integration guide for the Python engine and MT5 (for GPT-6)

The dashboard is a **read-only viewer**. The engine writes JSON files; the dashboard reads them.

## 1. Export folder
Serve a folder (same shape as `data/demo/`) from any static host, then open `index.html?data=<base-url>`:
```
<base>/meta.json  quotes.json  signals.json  scanner.json  agents.json  account.json
        strategies.json  journal.json  system.json  events.json
<base>/candles/<SYMBOL>_<TF>.json      e.g. candles/XAUUSD_M15.json
```
`HttpProvider` polls every 5 s (`cache: no-store`, `credentials: omit`). `?validate=0` disables contract checks (development only).

## 2. Contracts
`contracts/*.schema.json` (JSON Schema draft-07 subset, generated from `src/data/contracts.js`). Python side: validate with `jsonschema` before writing. Examples: `data/demo/*.json`.
Rules the schemas enforce: `trading_enabled` is `false`; journal rows are `simulated: true` (a future DEMO-fill journal needs a contract change and an ADR); `scanner.score_kind` is `"heuristic"`; `signals[].probability` stays `null` until a validated source is named in `validation`.

## 3. Mapping from the research package
| Dashboard payload | Source in `rabbit_research` |
|---|---|
| `strategies.strategies[].splits` | `candidates.csv` (train / validation columns), `splits` from `summary.json` |
| `strategies.gates`, `system.validation` | `summary.json` verdict and reasons |
| `journal.trades` | `scenarios.csv` of the selected candidate, `simulated: true` |
| `system.feeds` | `diagnostics.json` (spread median, gap share, zero-spread quality) |
| `account` | paper account only; never MT5 account data |
| `quotes`, `candles` | MT5 history/ticks export, UTC-corrected (see the broker clock offset open question) |

## 4. What must not enter the dashboard repository
Tick CSVs, `reports_*` folders, run directories, strategy source code, credentials. The exporter in `rabbit_research/export.py` already emits aggregates only; `.gitignore` blocks the usual file names; run the PR 1 safety scanner on this repository too.

## 5. Open items
HttpProvider against a real endpoint; DEMO-fill journal contract; spread-band overlay and cost-sensitivity views; Windows/Firefox/Safari checks; Next.js migration decision.

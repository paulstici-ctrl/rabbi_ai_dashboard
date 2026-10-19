# RABBIT-AI Command Center V1.0 — integration review

Status: **REVIEW ONLY — NOT DEPLOYED**. The 97-file ZIP provided by Claude has **not** been committed in this branch. Do not merge this review branch as if it contained the app.

## Independently checked
- Archive: `rabbit-command-center-v1.0.zip`; 97 files.
- `npm test` in extracted project: **40 passed, 0 failed**.
- 6 routes: overview, terminal, agents, lab, journal, system.
- Static ES modules, zero npm dependencies, demo provider and JSON contracts.
- No live order execution found in declared frontend architecture; MT5 is not connected.
- Chromium mobile/desktop checks are reported by Claude; **not independently rerun here**.

## Integration plan
1. Import complete ZIP into this repository **in a separate implementation branch**, replacing legacy frontend entrypoints as needed; do not publish private Python research code, ticks, reports or credentials.
2. Run `npm test` and browser smoke on GitHub Actions with read-only permissions and pinned actions.
3. Confirm six routes and navigation on Samsung-sized 412px and desktop.
4. Test actual CSV file upload in browser, verify cross-symbol and timeframe switching.
5. Review CSP and configurable `?data=` URL: allow only intentional, public, sanitized read-only exports, never private MT5 or account information.
6. Make DEMO unmistakable beside every BUY/SELL signal; no evidence of profitability.
7. Publish to GitHub Pages only after review/approval; preserve the existing page until then.

## Known gaps
- No real `HttpProvider` endpoint test.
- CSV browser upload not exercised.
- No Windows/Firefox/Safari verification.
- Chart and AI visuals use simulated data.
- Do not change frozen V7.2 baseline or enable trading.

## Repository separation
Public dashboard repository is for frontend assets and non-sensitive demo fixtures only.
Private `RABBIT-AI` repository remains the source of research engine code, validation, and tick datasets.

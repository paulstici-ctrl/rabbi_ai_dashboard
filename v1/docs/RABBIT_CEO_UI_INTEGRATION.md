# RABBIT CEO — UI prototype and integration boundary

## Scope

- Dedicated `#/ceo` page, department selector, agent monitor, AI Board Meeting (synthetic signal comparison), executive briefing, news status and audit timeline.
- Separate **public dashboard repository feature branch**; no accounts, real trading data, credentials or orders.
- **No Claude Phase 1 integration is claimed.** Do not replace its registry, message schemas or event bus.
- Source: existing V1 deterministic synthetic payloads only. The frontend has zero new network requests.
- Work is **review-only** in a Draft PR. The public GitHub Pages V1 remains unchanged until a separate merge/deployment approval.

## UI state semantics

| Display | Meaning |
|---|---|
| DEMO · ACTIVE | Legacy V1 simulated agent. Not a running LLM job. |
| DEMO · IDLE | Legacy V1 scripted demonstration, including Strategy Evaluator. |
| NOT CONNECTED | No runtime, adapter or data source implemented for this division. |
| WAITING_DATA | Configured legacy division without an agent payload. |
| Execution OFF | No frontend order routing; all controls are read-only. |

Never convert a legacy DEMO agent into a production ACTIVE status by label substitution.

## Data boundary

The pure adapter `src/data/ceo/model.js` accepts synthetic arrays from `ctx.d.agents`, `ctx.d.signals`, `ctx.d.events` and system validation status.

Output fields: `mode`, `readOnly`, `modelVersion`, `departments`, `agents`, `signals`, `events`, `validationStatus`, `tradingStatus`, `connectedExternalSources`, `connectedLiveAgentRuntimes`, `connectedNewsSources`, `plannedDepartments`.

For future **Phase 1 CEO** integration, introduce an explicit versioned read-only API translation adapter rather than changing synthetic payloads in place. Suggested separate fields:
- `source`: `demo`, `private-local`, or `unavailable`.
- `asOfUtc`, `lastHeartbeatUtc`, and `freshnessSeconds` supplied by trusted local server.
- `runtimeState` with `ACTIVE`, `IDLE`, `WAITING_DATA`, `DEGRADED`, `ERROR`, `DISABLED` and supporting job identifier.
- `observedAtUtc` and `evidenceRefs` for news, macro, and trading research.
- Separate independent Risk Guardian state; CEO never grants an execution authorization.

Schema, authentication and network transport must be reviewed with Claude's actual Phase 1 output before any connection. No real account identifiers in frontend, GitHub Pages, GitHub Actions or logs.

## Development and checks

From `v1/`: `npm test`. Tests include provenance, the three unconnected divisions, validation of demo status, unsupported market fallback, technical-source timeframe, risk veto, and HTML escaping.

Manual UI checklist:
1. Open `#/ceo` on a *locally served feature branch*, check desktop and Samsung-size viewport.
2. Select all six departments; no missing data is labelled active.
3. Switch XAUUSD/EURUSD/GBPUSD/GBPJPY in AI Board, verify research-only / risk veto.
4. Confirm news panel says not connected and timeline says synthetic.
5. Test navigation from CEO to existing Terminal, then back.
6. Confirm no order/position mutation or new network calls in browser developer tools.

Do not merge or deploy before code review and browser smoke test.

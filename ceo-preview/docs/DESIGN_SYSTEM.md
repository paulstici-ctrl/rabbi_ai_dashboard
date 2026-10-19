# Design system

**Identity.** A dark terminal with a brand gradient (cyan to violet) and the `// SECTION` mono headers and dotted-grid backdrop seen in the reference videos, with a rabbit-ears logo of its own. Dense, numeric, calm: colour is reserved for meaning.

## Colour tokens (`styles/tokens.css`)
| Role | Token | Value |
|---|---|---|
| Backgrounds | `--bg-0 … --bg-4` | `#04070b` `#070c12` `#0b121a` `#0f1923` `#152230` |
| Lines | `--line`, `--line-2`, `--line-3` | `#17222f` `#223142` `#2f4358` |
| Text | `--tx-0 … --tx-3` | `#eaf2f9` `#b9c8d6` `#7d90a5` `#53667b` |
| Bull / BUY / OK | `--bull` | `#2ee6a6` |
| Bear / SELL / error | `--bear` | `#ff5577` |
| Warning / DEMO | `--amber` | `#ffb347` |
| Info / brand | `--cyan`, `--violet`, `--blue` | `#5ee7ff` `#8b7bff` `#4da3ff` |
| Brand gradient | `--brand` | `135deg, #5ee7ff, #8b7bff` |

Semantics: green = up/buy/healthy, red = down/sell/failing, amber = demo/warning/wait, cyan = information/selection, violet = AI / proposal / frozen. Never use green/red for decoration.

## Typography
System stacks only (no web fonts, no external requests). UI: `ui-sans-serif, system-ui, "Segoe UI", Roboto`. Numbers and labels: `ui-monospace, "JetBrains Mono", "Cascadia Mono", Consolas` with tabular numerals. Scale: 10 / 11 / 12 / 13 / 15 / 20 / 26 / 34 px. Section labels are 10-11 px mono, uppercase, letter-spaced, prefixed with `//`.

## Layout
Desktop: sidebar (218 px) + sticky top bar (ticker, replay controls, palette) + 12-column content grid. Phone (≤ 980 px): bottom navigation with six items, single column, charts 150-330 px high, tables scroll horizontally inside `.tbl-wrap`, panel headers wrap. Radii 6 / 10 / 14 px.

## Components (`src/ui/components/index.js`)
`panel` (optionally `hero` with gradient border), `chip` (variants buy, sell, wait, ok, warn, err, info, idle, violet, demo), `dot`, `stat`, KPI strip, `seg` (segmented control), `toggle`, `btn`, `table` (sortable, dense), `bar` (progress with limit marker), `winLoss` strip, `spark`, `kv`, `empty`, notices, toasts, drawer, palette, terminal log. Every demo surface carries a visible DEMO / SIMULATED marker.

## Motion
Short fades/slides (≤ 350 ms), pulsing status dots, agent-floor pulses. All animation is disabled under `prefers-reduced-motion`; canvases render only when dirty.

## Accessibility
Skip link, focus rings, `aria-pressed` on toggles, `role` and labels on dialogs, keyboard navigation on the chart (arrows, +/-, Home/End), 44 px-class touch targets on phone navigation.

# Mandate Prototype

A browser-based prototype for private-market deal materials, illustrative investor matching, research workflows, outreach preparation, and quantitative underwriting demonstrations.

## Run locally

1. Extract the full ZIP archive.
2. Keep `index.html`, `css/`, `js/`, and the sample documents in their original relative locations.
3. Open `index.html` in a modern browser.

No build step or third-party JavaScript dependency is required. Some live-news/search functions rely on external websites and may be restricted by browser CORS policies.

## Project layout

- `index.html` — page structure and UI markup.
- `css/mandate.css` — interface styles, responsive layout, interaction states, and Quant Lab styles.
- `js/app.js` — primary application behavior: navigation, sample data, matching, Memo Studio, outreach, research, and assistant demo logic.
- `js/quant-engine.js` — pure, deterministic quantitative model; no DOM or network dependencies; CommonJS-compatible for tests.
- `js/quant-lab-ui.js` — Quant Lab controls, charts, diagnostics display, and exports.
- `js/underwriting-widget.js` — original dashboard sensitivity widget.
- `tests/quant-engine.test.js` — Node.js tests for model validation, reproducibility, metrics, and diagnostics.
- `docs/QUANT_METHODOLOGY.md` — assumptions and limitations.

## Quant Lab at a glance

The Quant Lab runs a seeded one-year lognormal EBITDA simulation, reports percentile outcomes and leverage threshold frequency, provides deterministic stress scenarios and one-factor-at-a-time sensitivity comparisons, and exports run-level CSV/JSON. The run fingerprint is derived from the assumptions and simulation settings. Diagnostics test finiteness, positivity, quantile ordering, breach-rate bounds, reproducibility, and path count.

## Important demo limitations

All company and investor profiles are fictional. The simulation is an educational illustration, not an empirically calibrated model, forecast, covenant compliance opinion, or probability of default. It does not model correlated risk factors, cash conversion, liquidity, debt amortization, refinancing, or path-dependent covenant mechanics. The investor matching universe is illustrative and is not a live database. The conversational assistant is demo logic, not a connected AI model.

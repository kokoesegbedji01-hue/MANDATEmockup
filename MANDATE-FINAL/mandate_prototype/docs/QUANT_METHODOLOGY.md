# Quant Lab methodology

## Model purpose

The Quant Lab is an educational, inspectable example of a seeded Monte Carlo workflow for one-year EBITDA and a simple leverage threshold. It is designed to demonstrate model discipline: explicit assumptions, reproducible runs, quantile reporting, sensitivity analysis, diagnostics, and exportable results. It is not an investment recommendation or production credit model.

## Inputs

- Starting EBITDA ($ millions)
- Net debt ($ millions)
- Expected EBITDA growth (%)
- Annual EBITDA volatility (%)
- Cash interest rate (%)
- Leverage threshold (net debt / EBITDA)
- Simulation path count and integer random seed

## Simulation

For each seeded standard-normal draw `Z`, one-year EBITDA is calculated as:

`EBITDA_1 = EBITDA_0 × exp(ln(1 + g) − 0.5 × σ² + σ × Z)`

where `g` is the entered expected growth and `σ` is annual volatility. The `−0.5 × σ²` adjustment is the lognormal correction, so the parameterized growth maps to the arithmetic expected EBITDA growth under this simplified distribution. Paths are generated using a seeded linear-congruential pseudo-random generator and Box–Muller transform. Re-running the same inputs, path count, and seed reproduces the same paths in the same JavaScript runtime.

## Outputs

- Current leverage = net debt / starting EBITDA.
- Interest coverage = starting EBITDA / annual cash interest (net debt × interest rate); shown as N/M when interest expense is zero. This is a simplified EBITDA-to-interest ratio, not a full fixed-charge coverage ratio.
- EBITDA percentiles P05, P25, P50, P75, and P95.
- Leverage-threshold breach rate = fraction of simulated one-year EBITDA outcomes where net debt / EBITDA exceeds the entered threshold. This is not a default probability.
- Deterministic scenario table at −2σ, −1σ, median (Z=0), and +1σ.
- One-factor-at-a-time sensitivity for starting EBITDA, net debt, expected growth, volatility, and leverage threshold. The same normal draws are reused for comparisons (common random numbers) to reduce simulation noise between scenarios.

## Diagnostics and exports

Basic checks verify that simulated values are finite and positive, percentile outputs are ordered, breach frequency lies in [0,1], repeated generation is deterministic, and path count matches the request. The run fingerprint is a compact non-cryptographic hash of the assumptions and settings. CSV exports include each path's EBITDA, net debt, leverage and threshold indicator. JSON exports include inputs, metadata, metrics, scenarios, sensitivity values, diagnostics and path values.

## Limitations / extensions for real quant work

The model assumes independent identically distributed one-year outcomes with a lognormal EBITDA distribution. It does not estimate parameters from historical data, model parameter uncertainty, autocorrelation, jumps, skew beyond lognormality, macro/sector correlations, liquidity, cash conversion, debt amortization, revolver availability, covenant cure rights, refinancing, default/recovery, or path-dependent covenant tests. Volatility and growth are user-supplied rather than calibrated. For production use, add historical data ingestion and lineage, calibration diagnostics, unit and integration tests, independent review, model versioning, scenario governance, validation against realized outcomes, and explicit separation of estimates from verified facts.

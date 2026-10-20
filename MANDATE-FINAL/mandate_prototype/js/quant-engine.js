/* ========================================================================
 * Mandate Quant Engine — pure functions, deterministic and testable.
 * Model: one-year lognormal EBITDA simulation, leverage covenant threshold.
 * No DOM access, network calls, external dependencies, or hidden data inputs.
 * ======================================================================== */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.MandateQuantEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODEL_VERSION = 'MANDATE-CREDIT-001';
  const DEFAULTS = Object.freeze({ startingEbitda: 12, netDebt: 48, expectedGrowthPct: 6, volatilityPct: 18, interestRatePct: 9, leverageThreshold: 5, paths: 10000, seed: 20261020 });
  function assertFinite(name, value) { if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite'); }
  function validate(raw) {
    const x = { ...DEFAULTS, ...raw };
    Object.entries(x).forEach(([key, value]) => assertFinite(key, Number(value)));
    if (x.startingEbitda <= 0) throw new RangeError('Starting EBITDA must be greater than zero.');
    if (x.netDebt < 0) throw new RangeError('Net debt cannot be negative.');
    if (x.expectedGrowthPct <= -100) throw new RangeError('Expected EBITDA growth must be greater than -100%.');
    if (x.volatilityPct < 0 || x.volatilityPct > 300) throw new RangeError('Volatility must be between 0% and 300%.');
    if (x.interestRatePct < 0 || x.interestRatePct > 100) throw new RangeError('Interest rate must be between 0% and 100%.');
    if (x.leverageThreshold <= 0) throw new RangeError('Leverage threshold must be greater than zero.');
    if (!Number.isInteger(x.paths) || x.paths < 100 || x.paths > 100000) throw new RangeError('Paths must be an integer between 100 and 100,000.');
    if (!Number.isInteger(x.seed) || x.seed < 1 || x.seed > 2147483647) throw new RangeError('Seed must be an integer between 1 and 2,147,483,647.');
    return x;
  }
  function createRandom(seed) {
    let state = seed >>> 0;
    return function random() { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return (state + 1) / 4294967297; };
  }
  function createNormals(seed, count) {
    const rand = createRandom(seed), out = new Array(count);
    for (let i = 0; i < count; i += 2) {
      const u1 = Math.max(rand(), 1e-12), u2 = rand();
      const radius = Math.sqrt(-2 * Math.log(u1)), angle = 2 * Math.PI * u2;
      out[i] = radius * Math.cos(angle);
      if (i + 1 < count) out[i + 1] = radius * Math.sin(angle);
    }
    return out;
  }
  function quantile(sorted, q) { const index = (sorted.length - 1) * q, lo = Math.floor(index), hi = Math.ceil(index); return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo); }
  function mean(values) { return values.reduce((sum, x) => sum + x, 0) / Math.max(1, values.length); }
  function simulatePaths(inputs, normals) {
    const growth = inputs.expectedGrowthPct / 100, vol = inputs.volatilityPct / 100;
    const drift = Math.log(1 + growth) - 0.5 * vol * vol;
    return normals.map((z) => inputs.startingEbitda * Math.exp(drift + vol * z));
  }
  function probabilityBreach(inputs, normals) {
    const outcomes = simulatePaths(inputs, normals);
    let breaches = 0;
    for (const ebitda of outcomes) if (inputs.netDebt / ebitda > inputs.leverageThreshold) breaches++;
    return breaches / outcomes.length;
  }
  function calculateMetrics(inputs, paths) {
    const sorted = paths.slice().sort((a, b) => a - b);
    const interest = inputs.netDebt * inputs.interestRatePct / 100;
    let breaches = 0;
    for (const ebitda of paths) if (inputs.netDebt / ebitda > inputs.leverageThreshold) breaches++;
    return {
      currentLeverage: inputs.netDebt / inputs.startingEbitda,
      interestCoverage: interest === 0 ? null : inputs.startingEbitda / interest,
      p05: quantile(sorted, 0.05), p25: quantile(sorted, 0.25), p50: quantile(sorted, 0.50), p75: quantile(sorted, 0.75), p95: quantile(sorted, 0.95),
      meanEbitda: mean(paths), leverageBreachRate: breaches / paths.length, minimumEbitda: sorted[0], maximumEbitda: sorted[sorted.length - 1]
    };
  }
  function buildScenarios(inputs) {
    const growth = inputs.expectedGrowthPct / 100, vol = inputs.volatilityPct / 100;
    const specs = [
      { key: 'downside', label: 'Severe downside', z: -2 },
      { key: 'bear', label: 'Downside', z: -1 },
      { key: 'base', label: 'Base', z: 0 },
      { key: 'upside', label: 'Upside', z: 1 }
    ];
    return specs.map((s) => {
      const ebitda = inputs.startingEbitda * Math.exp(Math.log(1 + growth) - 0.5 * vol * vol + vol * s.z);
      const interest = inputs.netDebt * inputs.interestRatePct / 100;
      return { ...s, ebitda, leverage: inputs.netDebt / ebitda, coverage: interest === 0 ? null : ebitda / interest };
    });
  }
  function buildSensitivities(inputs, normals) {
    const base = probabilityBreach(inputs, normals);
    const specs = [
      { label: 'Starting EBITDA', field: 'startingEbitda', low: inputs.startingEbitda * 0.8, high: inputs.startingEbitda * 1.2 },
      { label: 'Net debt', field: 'netDebt', low: Math.max(0, inputs.netDebt * 0.8), high: inputs.netDebt * 1.2 },
      { label: 'Growth', field: 'expectedGrowthPct', low: inputs.expectedGrowthPct - 5, high: inputs.expectedGrowthPct + 5 },
      { label: 'Volatility', field: 'volatilityPct', low: Math.max(0, inputs.volatilityPct - 5), high: inputs.volatilityPct + 5 },
      { label: 'Leverage limit', field: 'leverageThreshold', low: Math.max(0.1, inputs.leverageThreshold - 0.5), high: inputs.leverageThreshold + 0.5 }
    ];
    return specs.map((spec) => {
      const lowInputs = { ...inputs, [spec.field]: spec.low }, highInputs = { ...inputs, [spec.field]: spec.high };
      const lowRate = probabilityBreach(lowInputs, normals), highRate = probabilityBreach(highInputs, normals);
      return { label: spec.label, lowValue: spec.low, highValue: spec.high, lowBreachRate: lowRate, highBreachRate: highRate, deltaBreachRate: highRate - lowRate, baseBreachRate: base };
    }).sort((a, b) => Math.abs(b.deltaBreachRate) - Math.abs(a.deltaBreachRate));
  }
  function fingerprint(inputs) {
    const str = [inputs.startingEbitda, inputs.netDebt, inputs.expectedGrowthPct, inputs.volatilityPct, inputs.interestRatePct, inputs.leverageThreshold, inputs.paths, inputs.seed].join('|');
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) { hash ^= str.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
  function diagnostics(inputs, paths, metrics) {
    const finite = paths.every(Number.isFinite), positive = paths.every((v) => v > 0), sorted = paths.slice().sort((a, b) => a - b);
    const monotonic = metrics.p05 <= metrics.p25 && metrics.p25 <= metrics.p50 && metrics.p50 <= metrics.p75 && metrics.p75 <= metrics.p95;
    const rateValid = metrics.leverageBreachRate >= 0 && metrics.leverageBreachRate <= 1;
    const deterministic = JSON.stringify(simulatePaths(inputs, createNormals(inputs.seed, inputs.paths))) === JSON.stringify(paths);
    return [
      { label: 'All simulated EBITDA outcomes are finite', pass: finite },
      { label: 'All simulated EBITDA outcomes are strictly positive', pass: positive },
      { label: 'Quantiles are monotonically ordered', pass: monotonic },
      { label: 'Breach rate is bounded between 0% and 100%', pass: rateValid },
      { label: 'Same seed and inputs reproduce identical paths', pass: deterministic },
      { label: 'Path count matches requested simulation count (' + inputs.paths.toLocaleString() + ')', pass: sorted.length === inputs.paths }
    ];
  }
  function simulate(rawInputs) {
    const validated = validate(rawInputs);
    const modelInputs = {
      startingEbitda: validated.startingEbitda, netDebt: validated.netDebt, expectedGrowthPct: validated.expectedGrowthPct,
      volatilityPct: validated.volatilityPct, interestRatePct: validated.interestRatePct, leverageThreshold: validated.leverageThreshold,
      paths: validated.paths, seed: validated.seed
    };
    const normals = createNormals(modelInputs.seed, modelInputs.paths);
    const pathEbitda = simulatePaths(modelInputs, normals);
    const metrics = calculateMetrics(modelInputs, pathEbitda);
    const checks = diagnostics(modelInputs, pathEbitda, metrics);
    return {
      model: MODEL_VERSION, inputs: modelInputs, metrics, pathEbitda,
      scenarios: buildScenarios(modelInputs), sensitivities: buildSensitivities(modelInputs, normals), diagnostics: checks,
      metadata: { modelVersion: MODEL_VERSION, seed: modelInputs.seed, paths: modelInputs.paths, generatedAt: new Date().toISOString(), fingerprint: fingerprint(modelInputs), randomNumberMethod: 'Seeded LCG + Box-Muller normal transform', sensitivityMethod: 'One-factor-at-a-time; common random numbers' }
    };
  }
  return Object.freeze({ MODEL_VERSION, DEFAULTS, validate, simulate, createNormals, quantile, fingerprint });
});

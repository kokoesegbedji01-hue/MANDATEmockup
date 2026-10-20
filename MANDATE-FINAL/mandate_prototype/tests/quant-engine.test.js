const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/quant-engine.js');

test('same assumptions, seed and path count reproduce identical simulated paths', () => {
  const input = { ...engine.DEFAULTS, paths: 1000, seed: 42 };
  const a = engine.simulate(input), b = engine.simulate(input);
  assert.deepEqual(a.pathEbitda, b.pathEbitda);
  assert.equal(a.metadata.fingerprint, b.metadata.fingerprint);
});

test('changing the seed changes simulated outcomes but preserves valid metrics', () => {
  const base = { ...engine.DEFAULTS, paths: 1000, seed: 42 };
  const a = engine.simulate(base), b = engine.simulate({ ...base, seed: 43 });
  assert.notDeepEqual(a.pathEbitda, b.pathEbitda);
  assert.ok(a.metrics.leverageBreachRate >= 0 && a.metrics.leverageBreachRate <= 1);
  assert.ok(a.metrics.p05 <= a.metrics.p25 && a.metrics.p25 <= a.metrics.p50 && a.metrics.p50 <= a.metrics.p75 && a.metrics.p75 <= a.metrics.p95);
});

test('model validates critical inputs', () => {
  assert.throws(() => engine.simulate({ ...engine.DEFAULTS, startingEbitda: 0 }), /greater than zero/);
  assert.throws(() => engine.simulate({ ...engine.DEFAULTS, netDebt: -1 }), /cannot be negative/);
  assert.throws(() => engine.simulate({ ...engine.DEFAULTS, expectedGrowthPct: -100 }), /greater than -100/);
  assert.throws(() => engine.simulate({ ...engine.DEFAULTS, paths: 99 }), /between 100 and 100,000/);
  assert.throws(() => engine.simulate({ ...engine.DEFAULTS, seed: 0 }), /between 1 and 2,147,483,647/);
});

test('diagnostics pass for standard model settings', () => {
  const result = engine.simulate({ ...engine.DEFAULTS, paths: 1000, seed: 123 });
  assert.ok(result.diagnostics.every((check) => check.pass), JSON.stringify(result.diagnostics));
  assert.equal(result.pathEbitda.length, 1000);
  assert.equal(result.scenarios.length, 4);
  assert.equal(result.sensitivities.length, 5);
});

test('zero debt produces zero leverage and no leverage threshold breaches', () => {
  const result = engine.simulate({ ...engine.DEFAULTS, netDebt: 0, paths: 1000 });
  assert.equal(result.metrics.currentLeverage, 0);
  assert.equal(result.metrics.leverageBreachRate, 0);
  assert.equal(result.metrics.interestCoverage, null);
});

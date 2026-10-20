/* ========================================================================
   Quant Lab UI adapter
   Keeps DOM rendering separate from the pure, testable quant engine.
   ======================================================================== */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const INPUTS = {
    ebitda: ['qlEbitda', 'qlEbitdaVal', (v) => money(v) + 'M'],
    debt: ['qlDebt', 'qlDebtVal', (v) => money(v) + 'M'],
    growth: ['qlGrowth', 'qlGrowthVal', (v) => Number(v).toFixed(1) + '%'],
    volatility: ['qlVol', 'qlVolVal', (v) => Number(v).toFixed(1) + '%'],
    rate: ['qlRate', 'qlRateVal', (v) => Number(v).toFixed(2).replace(/0$/, '') + '%'],
    threshold: ['qlThreshold', 'qlThresholdVal', (v) => Number(v).toFixed(2).replace(/0$/, '') + '×']
  };
  let latestRun = null;
  function money(value) { return Number(value).toFixed(1); }
  function fmtMoney(value) { return '$' + Number(value).toFixed(2) + 'M'; }
  function fmtPct(value) { return (value * 100).toFixed(2) + '%'; }
  function readInputs() {
    return {
      startingEbitda: Number($('qlEbitda').value),
      netDebt: Number($('qlDebt').value),
      expectedGrowthPct: Number($('qlGrowth').value),
      volatilityPct: Number($('qlVol').value),
      interestRatePct: Number($('qlRate').value),
      leverageThreshold: Number($('qlThreshold').value),
      paths: Number($('qlPaths').value),
      seed: Number($('qlSeed').value)
    };
  }
  function drawHistogram(values, thresholdEbitda) {
    const canvas = $('qlHistogram');
    if (!canvas || !values.length) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, rect.width || 640);
    const height = 220;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const left = 42, right = 14, top = 13, bottom = 31;
    const plotW = width - left - right, plotH = height - top - bottom;
    let observedMin = Infinity, observedMax = -Infinity;
    for (const value of values) { if (value < observedMin) observedMin = value; if (value > observedMax) observedMax = value; }
    const min = Math.max(0, observedMin * 0.94);
    const max = observedMax * 1.04 || 1;
    const range = max - min || 1;
    const bins = 30, counts = Array(bins).fill(0);
    values.forEach((v) => { const b = Math.max(0, Math.min(bins - 1, Math.floor((v - min) / range * bins))); counts[b]++; });
    const peak = Math.max(...counts, 1);
    ctx.strokeStyle = '#e5eae5'; ctx.lineWidth = 1; ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#77837a';
    for (let i = 0; i <= 3; i++) { const y = top + plotH * i / 3; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke(); }
    const bw = plotW / bins;
    counts.forEach((count, i) => { const barH = count / peak * (plotH - 3); ctx.fillStyle = '#9cb9a4'; ctx.fillRect(left + i * bw + 1, top + plotH - barH, Math.max(1, bw - 2), barH); });
    ctx.fillStyle = '#77837a'; ctx.textAlign = 'left'; ctx.fillText('$' + min.toFixed(1) + 'M', left, height - 9);
    ctx.textAlign = 'center'; ctx.fillText('$' + ((min + max) / 2).toFixed(1) + 'M', left + plotW / 2, height - 9);
    ctx.textAlign = 'right'; ctx.fillText('$' + max.toFixed(1) + 'M', width - right, height - 9);
    if (thresholdEbitda >= min && thresholdEbitda <= max) {
      const x = left + (thresholdEbitda - min) / range * plotW;
      ctx.strokeStyle = '#a14c43'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + plotH); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function renderPercentiles(metrics) {
    const values = [
      ['P05', metrics.p05], ['P25', metrics.p25], ['P50 · Median', metrics.p50], ['P75', metrics.p75], ['P95', metrics.p95]
    ];
    $('qlPercentileRow').innerHTML = values.map(([label, value]) => '<div><span>' + label + '</span><strong>' + fmtMoney(value) + '</strong></div>').join('');
  }
  function renderScenarios(scenarios) {
    $('qlScenarioRows').innerHTML = scenarios.map((s) => '<tr class="quant-scenario-' + s.key + '"><td>' + s.label + '</td><td>' + fmtMoney(s.ebitda) + '</td><td>' + s.leverage.toFixed(2) + '×</td><td>' + (s.coverage === null ? 'N/M' : s.coverage.toFixed(2) + '×') + '</td></tr>').join('');
  }
  function renderTornado(sensitivities) {
    const maxAbs = Math.max(...sensitivities.map((x) => Math.abs(x.deltaBreachRate)), 0.01);
    $('qlSensitivityChart').innerHTML = sensitivities.map((s) => {
      const pct = Math.min(48, Math.abs(s.deltaBreachRate) / maxAbs * 48);
      const left = s.deltaBreachRate >= 0 ? 50 : 50 - pct;
      const klass = s.deltaBreachRate >= 0 ? 'positive' : 'negative';
      return '<div class="quant-tornado-row"><span class="quant-tornado-label" title="' + s.label + '">' + s.label + '</span><div class="quant-tornado-track"><span class="quant-tornado-bar ' + klass + '" style="left:' + left + '%;width:' + pct + '%"></span></div><strong class="quant-tornado-value">' + (s.deltaBreachRate > 0 ? '+' : '') + (s.deltaBreachRate * 100).toFixed(1) + ' pp</strong></div>';
    }).join('');
  }
  function renderDiagnostics(diagnostics) {
    $('qlDiagnostics').textContent = diagnostics.every((x) => x.pass) ? 'PASS · ' + diagnostics.length + '/' + diagnostics.length : 'REVIEW';
    $('qlDiagnostics').className = diagnostics.every((x) => x.pass) ? 'diagnostic-pass' : 'diagnostic-warn';
    $('qlDiagnosticDetails').innerHTML = diagnostics.map((x) => '<div><span class="' + (x.pass ? 'check-ok' : 'diagnostic-warn') + '">' + (x.pass ? '✓' : '!') + '</span>' + x.label + '</div>').join('');
  }
  function renderRun(result) {
    const m = result.metrics;
    $('qlCurrentLev').textContent = m.currentLeverage.toFixed(2) + '×';
    $('qlCoverage').textContent = m.interestCoverage === null ? 'N/M' : m.interestCoverage.toFixed(2) + '×';
    $('qlP05').textContent = fmtMoney(m.p05);
    $('qlBreach').textContent = fmtPct(m.leverageBreachRate);
    $('qlChartBadge').textContent = result.metadata.paths.toLocaleString() + ' paths';
    $('qlRunStatus').textContent = 'Simulation complete';
    $('qlRunMeta').textContent = result.metadata.paths.toLocaleString() + ' paths · seed ' + result.metadata.seed;
    $('qlSeedPaths').textContent = result.metadata.seed + ' / ' + result.metadata.paths.toLocaleString();
    $('qlFingerprint').textContent = result.metadata.fingerprint;
    drawHistogram(result.pathEbitda, result.inputs.netDebt / result.inputs.leverageThreshold);
    renderPercentiles(m);
    renderScenarios(result.scenarios);
    renderTornado(result.sensitivities);
    renderDiagnostics(result.diagnostics);
  }
  function run() {
    try {
      const inputs = readInputs();
      const result = window.MandateQuantEngine.simulate(inputs);
      latestRun = result;
      renderRun(result);
    } catch (error) {
      $('qlRunStatus').textContent = 'Run failed';
      $('qlDiagnosticDetails').textContent = 'The model could not complete: ' + error.message;
      $('qlDiagnostics').textContent = 'ERROR';
      $('qlDiagnostics').className = 'diagnostic-warn';
    }
  }
  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  function exportCsv() {
    if (!latestRun) run();
    const r = latestRun;
    const rows = [['path_id', 'one_year_ebitda_m', 'net_debt_m', 'net_leverage_x', 'above_leverage_threshold']];
    r.pathEbitda.forEach((ebitda, i) => rows.push([i + 1, ebitda.toFixed(6), r.inputs.netDebt.toFixed(6), (r.inputs.netDebt / ebitda).toFixed(6), r.inputs.netDebt / ebitda > r.inputs.leverageThreshold ? 1 : 0]));
    download('mandate_quant_paths_' + r.metadata.fingerprint + '.csv', rows.map((row) => row.join(',')).join('\n'), 'text/csv;charset=utf-8');
  }
  function exportJson() {
    if (!latestRun) run();
    const exportRun = { ...latestRun, pathEbitda: latestRun.pathEbitda };
    download('mandate_quant_run_' + latestRun.metadata.fingerprint + '.json', JSON.stringify(exportRun, null, 2), 'application/json');
  }
  function copyAssumptions() {
    const payload = JSON.stringify({ model: 'MANDATE-CREDIT-001', inputs: readInputs(), note: 'Fictional educational model; not a forecast or validated credit model.' }, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(() => window.toast ? toast('Model assumptions copied.') : alert('Assumptions copied.')).catch(() => window.prompt('Copy assumptions JSON:', payload));
    else window.prompt('Copy assumptions JSON:', payload);
  }
  function reset() {
    const defaults = { qlEbitda: 12, qlDebt: 48, qlGrowth: 6, qlVol: 18, qlRate: 9, qlThreshold: 5, qlPaths: 10000, qlSeed: 20261020 };
    Object.entries(defaults).forEach(([id, value]) => { $(id).value = value; });
    updateLabels(); run();
  }
  function updateLabels() {
    Object.values(INPUTS).forEach(([inputId, outputId, format]) => { const input = $(inputId); if (input && $(outputId)) $(outputId).textContent = format(input.value); });
  }
  function init() {
    if (!$('page-quant')) return;
    Object.values(INPUTS).forEach(([inputId]) => { const input = $(inputId); input.addEventListener('input', () => { updateLabels(); run(); }); input.addEventListener('change', () => { updateLabels(); run(); }); });
    ['qlPaths', 'qlSeed'].forEach((id) => $(id).addEventListener('change', run));
    $('qlRunButton').addEventListener('click', run);
    $('qlResetButton').addEventListener('click', reset);
    $('qlExportCsv').addEventListener('click', exportCsv);
    $('qlExportJson').addEventListener('click', exportJson);
    $('qlCopyAssumptions').addEventListener('click', copyAssumptions);
    window.addEventListener('resize', () => { if (latestRun && $('page-quant').classList.contains('active')) drawHistogram(latestRun.pathEbitda, latestRun.inputs.netDebt / latestRun.inputs.leverageThreshold); });
    updateLabels(); run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

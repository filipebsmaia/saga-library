export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saga Performance Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; background: #0d1117; color: #c9d1d9; padding: 20px; }
  h1 { font-size: 18px; color: #58a6ff; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #484f58; margin-bottom: 20px; }

  /* Status bar */
  .status-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; padding: 10px 14px; background: #161b22; border: 1px solid #21262d; border-radius: 6px; font-size: 12px; flex-wrap: wrap; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .status-dot.connected { background: #3fb950; box-shadow: 0 0 6px #3fb95066; }
  .status-dot.disconnected { background: #f85149; }
  .stat { color: #8b949e; }
  .stat b { color: #c9d1d9; }
  .controls { display: flex; gap: 8px; margin-left: auto; }
  .controls button, .controls a { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
  .controls button:hover, .controls a:hover { background: #30363d; border-color: #484f58; }
  .controls button.active { background: #1f6feb33; border-color: #1f6feb; color: #58a6ff; }

  /* Cards grid */
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px; text-align: center; }
  .card-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .card-label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; }
  .card-running .card-value { color: #58a6ff; }
  .card-completed .card-value { color: #3fb950; }
  .card-compensating .card-value { color: #d29922; }
  .card-failed .card-value { color: #f85149; }

  /* Sections */
  .section { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .section-title { font-size: 13px; color: #58a6ff; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .section-subtitle { font-size: 10px; color: #484f58; font-weight: 400; }

  /* Two column layout */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

  /* Canvas chart */
  .chart-canvas { width: 100%; height: 120px; display: block; }

  /* Saga type bars */
  .type-row { display: flex; align-items: center; margin-bottom: 6px; gap: 8px; }
  .type-label { font-size: 11px; color: #c9d1d9; width: 140px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .type-bar-bg { flex: 1; height: 18px; background: #21262d; border-radius: 3px; overflow: hidden; }
  .type-bar { height: 100%; border-radius: 3px; background: #1f6feb; transition: width 0.3s; display: flex; align-items: center; padding: 0 6px; font-size: 10px; color: #fff; min-width: 20px; }
  .type-count { font-size: 11px; color: #8b949e; width: 40px; text-align: right; flex-shrink: 0; }

  /* Percentile bars */
  .pct-grid { display: grid; grid-template-columns: 50px 1fr 70px; gap: 4px 8px; align-items: center; }
  .pct-label { font-size: 11px; color: #8b949e; }
  .pct-bar-bg { height: 14px; background: #21262d; border-radius: 3px; overflow: hidden; }
  .pct-bar { height: 100%; border-radius: 3px; background: #8957e5; transition: width 0.3s; }
  .pct-value { font-size: 11px; color: #c9d1d9; text-align: right; }

  /* Lag display */
  .lag-stats { display: flex; gap: 24px; margin-bottom: 12px; }
  .lag-stat { text-align: center; }
  .lag-stat-value { font-size: 24px; font-weight: 600; color: #c9d1d9; }
  .lag-stat-label { font-size: 10px; color: #484f58; text-transform: uppercase; }

  /* Active sagas table */
  .active-sagas { max-height: 300px; overflow-y: auto; }
  .active-sagas table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .active-sagas th { text-align: left; color: #484f58; font-weight: 600; padding: 4px 8px; border-bottom: 1px solid #21262d; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; position: sticky; top: 0; background: #161b22; }
  .active-sagas td { padding: 5px 8px; border-bottom: 1px solid #21262d11; }
  .active-sagas tr:hover td { background: #1c212844; }
  .active-saga-id { color: #58a6ff; }
  .active-saga-name { color: #d2a8ff; }
  .active-saga-status { font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
  .active-status-running { background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb44; }
  .active-status-compensating { background: #d2992222; color: #d29922; border: 1px solid #d2992244; }
  .active-saga-events { color: #8b949e; }
  .active-saga-duration { color: #484f58; }

  /* Duration by type table */
  .dur-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .dur-table th { text-align: left; color: #484f58; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #21262d; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
  .dur-table th.num { text-align: right; }
  .dur-table td { padding: 6px 8px; border-bottom: 1px solid #21262d11; }
  .dur-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .dur-table tr:hover td { background: #1c212844; }
  .dur-type-name { color: #d2a8ff; font-weight: 500; }
  .dur-type-count { color: #8b949e; }
  .dur-val-min { color: #3fb950; }
  .dur-val-avg { color: #58a6ff; }
  .dur-val-max { color: #f85149; }
  .dur-val-pct { color: #8b949e; }
  .dur-bar-bg { height: 4px; background: #21262d; border-radius: 2px; margin-top: 4px; position: relative; }
  .dur-bar-range { position: absolute; height: 100%; background: #1f6feb44; border-radius: 2px; }
  .dur-bar-avg { position: absolute; width: 2px; height: 8px; top: -2px; background: #58a6ff; border-radius: 1px; }

  /* Live feed */
  .feed { max-height: 300px; overflow-y: auto; }
  .feed-row { display: flex; gap: 8px; padding: 3px 0; font-size: 11px; border-bottom: 1px solid #21262d11; }
  .feed-time { color: #484f58; flex-shrink: 0; width: 85px; }
  .feed-type { color: #c9d1d9; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .feed-hint { flex-shrink: 0; font-size: 10px; padding: 1px 5px; border-radius: 3px; }
  .feed-hint-step { color: #3fb950; background: #3fb95015; }
  .feed-hint-compensation { color: #d29922; background: #d2992215; }
  .feed-hint-final { color: #8b949e; background: #8b949e15; }
  .feed-hint-fork { color: #a371f7; background: #a371f715; }
  .feed-saga { color: #484f58; flex-shrink: 0; width: 80px; overflow: hidden; text-overflow: ellipsis; }

  /* Load test modal */
  .modal-overlay { position: fixed; inset: 0; background: #00000088; display: none; align-items: center; justify-content: center; z-index: 200; }
  .modal-overlay.open { display: flex; }
  .modal { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; width: 320px; }
  .modal h3 { font-size: 14px; color: #c9d1d9; margin-bottom: 16px; }
  .modal label { font-size: 11px; color: #8b949e; display: block; margin-bottom: 4px; }
  .modal input { width: 100%; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; color: #c9d1d9; font-family: inherit; font-size: 12px; margin-bottom: 12px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .modal-actions button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 6px 14px; font-size: 11px; cursor: pointer; font-family: inherit; }
  .modal-actions button.primary { background: #1f6feb; border-color: #1f6feb; color: #fff; }
  .modal-actions button:hover { filter: brightness(1.2); }

  /* Progress bar */
  .load-progress { margin-top: 8px; display: none; }
  .load-progress.active { display: block; }
  .progress-bar-bg { height: 6px; background: #21262d; border-radius: 3px; overflow: hidden; }
  .progress-bar { height: 100%; background: #1f6feb; border-radius: 3px; transition: width 0.5s; }
  .progress-text { font-size: 10px; color: #8b949e; margin-top: 4px; }
</style>
</head>
<body>

<h1>Performance Dashboard</h1>
<p class="subtitle">Real-time saga performance metrics</p>

<div class="status-bar">
  <div>
    <span class="status-dot disconnected" id="statusDot"></span>
    <span id="statusText">Connecting...</span>
  </div>
  <span class="stat">Sagas: <b id="sagaCount">0</b></span>
  <span class="stat">Events: <b id="eventCount">0</b></span>
  <span class="stat">Events/s: <b id="eventRate">0</b></span>
  <div class="controls">
    <button onclick="openLoadTest()" id="loadTestBtn">Load Test</button>
    <button onclick="clearAll()">Clear</button>
    <a href="/monitor">Trace Monitor</a>
  </div>
</div>

<!-- Summary Cards -->
<div class="cards">
  <div class="card card-running">
    <div class="card-value" id="cardRunning">0</div>
    <div class="card-label">Running</div>
  </div>
  <div class="card card-completed">
    <div class="card-value" id="cardCompleted">0</div>
    <div class="card-label">Completed</div>
  </div>
  <div class="card card-compensating">
    <div class="card-value" id="cardCompensating">0</div>
    <div class="card-label">Compensating</div>
  </div>
  <div class="card card-failed">
    <div class="card-value" id="cardFailed">0</div>
    <div class="card-label">Failed</div>
  </div>
</div>

<!-- Throughput + Consumer Lag -->
<div class="two-col">
  <div class="section">
    <div class="section-title">Throughput <span class="section-subtitle">events/sec, rolling 60s</span></div>
    <canvas class="chart-canvas" id="throughputCanvas"></canvas>
  </div>
  <div class="section">
    <div class="section-title">Consumer Lag <span class="section-subtitle">receivedAt - occurredAt</span></div>
    <div class="lag-stats">
      <div class="lag-stat"><div class="lag-stat-value" id="lagAvg">0</div><div class="lag-stat-label">Avg (ms)</div></div>
      <div class="lag-stat"><div class="lag-stat-value" id="lagCurrent">0</div><div class="lag-stat-label">Current (ms)</div></div>
      <div class="lag-stat"><div class="lag-stat-value" id="lagPeak">0</div><div class="lag-stat-label">Peak (ms)</div></div>
    </div>
    <canvas class="chart-canvas" id="lagCanvas" style="height:60px"></canvas>
  </div>
</div>

<!-- Saga Types + Latency Percentiles -->
<div class="two-col">
  <div class="section">
    <div class="section-title">Saga Types</div>
    <div id="sagaTypes"></div>
  </div>
  <div class="section">
    <div class="section-title">Saga Duration Percentiles <span class="section-subtitle">completed/failed only</span></div>
    <div class="pct-grid" id="percentiles">
      <span class="pct-label">p50</span><div class="pct-bar-bg"><div class="pct-bar" id="pctBar50" style="width:0%"></div></div><span class="pct-value" id="pctVal50">-</span>
      <span class="pct-label">p90</span><div class="pct-bar-bg"><div class="pct-bar" id="pctBar90" style="width:0%"></div></div><span class="pct-value" id="pctVal90">-</span>
      <span class="pct-label">p95</span><div class="pct-bar-bg"><div class="pct-bar" id="pctBar95" style="width:0%"></div></div><span class="pct-value" id="pctVal95">-</span>
      <span class="pct-label">p99</span><div class="pct-bar-bg"><div class="pct-bar" id="pctBar99" style="width:0%"></div></div><span class="pct-value" id="pctVal99">-</span>
    </div>
  </div>
</div>

<!-- Duration by Saga Type -->
<div class="section">
  <div class="section-title">Duration by Saga Type <span class="section-subtitle">avg / min / max for completed sagas</span></div>
  <div id="durationByType">
    <div style="color:#484f58; text-align:center; padding:12px; font-size:11px">No completed sagas yet</div>
  </div>
</div>

<!-- Active Sagas (Running + Compensating) -->
<div class="section">
  <div class="section-title">Active Sagas <span class="section-subtitle">running + compensating</span></div>
  <div class="active-sagas" id="activeSagas">
    <div style="color:#484f58; text-align:center; padding:12px; font-size:11px">No active sagas</div>
  </div>
</div>

<!-- Live Feed -->
<div class="section">
  <div class="section-title">Live Event Feed <span class="section-subtitle">last 50 events</span></div>
  <div class="feed" id="liveFeed">
    <div style="color:#484f58; text-align:center; padding:20px">Waiting for events...</div>
  </div>
</div>

<!-- Load Test Modal -->
<div class="modal-overlay" id="loadTestModal">
  <div class="modal">
    <h3>Run Load Test</h3>
    <label>Requests per second</label>
    <input type="number" id="ltRps" value="10" min="1" max="100">
    <label>Duration (seconds)</label>
    <input type="number" id="ltDuration" value="30" min="5" max="300">
    <div class="load-progress" id="ltProgress">
      <div class="progress-bar-bg"><div class="progress-bar" id="ltProgressBar" style="width:0%"></div></div>
      <div class="progress-text" id="ltProgressText">Starting...</div>
    </div>
    <div class="modal-actions">
      <button onclick="closeLoadTest()">Cancel</button>
      <button class="primary" onclick="startLoadTest()" id="ltStartBtn">Start</button>
    </div>
  </div>
</div>

<script>
// ─── State ───────────────────────────────────────────────────
var sagaState = {};
var counts = { running: 0, completed: 0, failed: 0, compensating: 0, total: 0 };
var sagasByType = {};
var totalEvents = 0;
var throughputHistory = [];
var lagHistory = [];
var lagTotal = 0;
var lagCount = 0;
var lagPeak = 0;
var lagCurrent = 0;
var eventsThisSecond = 0;
var liveEvents = [];
var loadTestRunning = false;

// ─── Init ────────────────────────────────────────────────────
function init() {
  fetchStats();
  connectSSE();
  setInterval(tick, 1000);
}

function fetchStats() {
  fetch('/monitor/api/stats')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      counts = data.counts;
      sagasByType = data.sagasByType;
      totalEvents = data.totalEvents;
      renderCards();
      renderSagaTypes();
      renderPercentiles(data.durations);
      updateStatusBar();
      if (data.consumerLag.avgMs > 0) {
        document.getElementById('lagAvg').textContent = data.consumerLag.avgMs;
      }
    })
    .catch(function() {});

  fetchDurationsByType();

  // Also load existing events into sagaState for accurate incremental tracking
  fetch('/monitor/api/events')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      for (var sagaId in data) {
        var events = data[sagaId];
        if (!sagaState[sagaId]) {
          sagaState[sagaId] = { events: [], status: 'running' };
        }
        for (var i = 0; i < events.length; i++) {
          sagaState[sagaId].events.push(events[i]);
        }
        sagaState[sagaId].status = deriveSagaStatus(sagaState[sagaId].events);
      }
    })
    .catch(function() {});
}

function connectSSE() {
  var es = new EventSource('/monitor/stream');
  es.onopen = function() {
    document.getElementById('statusDot').className = 'status-dot connected';
    document.getElementById('statusText').textContent = 'Connected';
  };
  es.onmessage = function(msg) {
    var event = JSON.parse(msg.data);
    processEvent(event);
  };
  es.onerror = function() {
    document.getElementById('statusDot').className = 'status-dot disconnected';
    document.getElementById('statusText').textContent = 'Disconnected';
  };
}

// ─── Process incoming event ──────────────────────────────────
function processEvent(event) {
  totalEvents++;
  eventsThisSecond++;

  // Consumer lag
  var lag = new Date(event.receivedAt).getTime() - new Date(event.occurredAt).getTime();
  if (lag >= 0) {
    lagTotal += lag;
    lagCount++;
    lagCurrent = lag;
    if (lag > lagPeak) lagPeak = lag;
  }

  // Track saga status
  var sagaId = event.sagaId;
  if (!sagaState[sagaId]) {
    sagaState[sagaId] = { events: [], status: 'running' };
    counts.running++;
    counts.total++;
    var name = event.sagaName || 'unknown';
    sagasByType[name] = (sagasByType[name] || 0) + 1;
  }

  var saga = sagaState[sagaId];
  var oldStatus = saga.status;
  saga.events.push(event);
  var newStatus = deriveSagaStatus(saga.events);

  if (oldStatus !== newStatus) {
    counts[oldStatus]--;
    counts[newStatus]++;
    saga.status = newStatus;
  }

  // Live feed
  liveEvents.unshift(event);
  if (liveEvents.length > 50) liveEvents.pop();

  renderCards();
  renderSagaTypes();
  renderActiveSagas();
  renderLiveFeed();
  renderLag();
  updateStatusBar();
}

function deriveSagaStatus(events) {
  var last = events[events.length - 1];
  var hasComp = false;
  for (var i = 0; i < events.length; i++) {
    if (events[i].hint === 'compensation') { hasComp = true; break; }
  }
  if (last.hint === 'final') return hasComp ? 'failed' : 'completed';
  if (hasComp) return 'compensating';
  return 'running';
}

// ─── Tick (every 1s) ─────────────────────────────────────────
function tick() {
  throughputHistory.push(eventsThisSecond);
  if (throughputHistory.length > 60) throughputHistory.shift();
  eventsThisSecond = 0;

  lagHistory.push(lagCurrent);
  if (lagHistory.length > 60) lagHistory.shift();

  renderThroughputChart();
  renderLagChart();
  document.getElementById('eventRate').textContent = throughputHistory[throughputHistory.length - 1] || 0;

  // Full stats refresh every 10s
  if (throughputHistory.length % 10 === 0) fetchStats();
}

// ─── Render: Cards ───────────────────────────────────────────
function renderCards() {
  document.getElementById('cardRunning').textContent = counts.running;
  document.getElementById('cardCompleted').textContent = counts.completed;
  document.getElementById('cardCompensating').textContent = counts.compensating;
  document.getElementById('cardFailed').textContent = counts.failed;
}

function updateStatusBar() {
  document.getElementById('sagaCount').textContent = counts.total;
  document.getElementById('eventCount').textContent = totalEvents;
}

// ─── Render: Saga Types ──────────────────────────────────────
function renderSagaTypes() {
  var container = document.getElementById('sagaTypes');
  var entries = Object.entries(sagasByType).sort(function(a, b) { return b[1] - a[1]; });
  if (entries.length === 0) {
    container.innerHTML = '<div style="color:#484f58; text-align:center; padding:12px; font-size:11px">No sagas yet</div>';
    return;
  }
  var maxVal = entries[0][1];
  var html = '';
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i][0];
    var count = entries[i][1];
    var pct = Math.max((count / maxVal) * 100, 4);
    html += '<div class="type-row">';
    html += '<div class="type-label">' + name + '</div>';
    html += '<div class="type-bar-bg"><div class="type-bar" style="width:' + pct + '%">' + count + '</div></div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

// ─── Render: Percentiles ─────────────────────────────────────
function renderPercentiles(dur) {
  if (!dur || dur.count === 0) return;
  var maxVal = Math.max(dur.p99, 1);
  var pcts = [
    { key: '50', val: dur.p50 },
    { key: '90', val: dur.p90 },
    { key: '95', val: dur.p95 },
    { key: '99', val: dur.p99 },
  ];
  for (var i = 0; i < pcts.length; i++) {
    var p = pcts[i];
    var barEl = document.getElementById('pctBar' + p.key);
    var valEl = document.getElementById('pctVal' + p.key);
    if (barEl) barEl.style.width = Math.max((p.val / maxVal) * 100, 2) + '%';
    if (valEl) valEl.textContent = formatDuration(p.val);
  }
}

function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

// ─── Render: Consumer Lag ────────────────────────────────────
function renderLag() {
  document.getElementById('lagAvg').textContent = lagCount > 0 ? Math.round(lagTotal / lagCount) : 0;
  document.getElementById('lagCurrent').textContent = lagCurrent;
  document.getElementById('lagPeak').textContent = lagPeak;
}

// ─── Render: Throughput Chart (Canvas) ───────────────────────
function renderThroughputChart() {
  var canvas = document.getElementById('throughputCanvas');
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width;
  var h = rect.height;

  ctx.clearRect(0, 0, w, h);

  var data = throughputHistory;
  if (data.length === 0) return;

  var maxVal = Math.max.apply(null, data.concat([1]));
  var barW = Math.max((w - 4) / 60 - 1, 2);
  var gap = 1;

  // Grid lines
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  for (var g = 1; g <= 3; g++) {
    var gy = h - (g / 4) * (h - 20);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Bars
  for (var i = 0; i < data.length; i++) {
    var barH = data[i] > 0 ? Math.max((data[i] / maxVal) * (h - 24), 2) : 0;
    var x = w - (data.length - i) * (barW + gap);
    var y = h - 4 - barH;
    ctx.fillStyle = '#1f6feb';
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 1);
    ctx.fill();
  }

  // Max label
  ctx.fillStyle = '#484f58';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(maxVal + '/s', w - 4, 12);
}

// ─── Render: Lag Chart (Canvas) ──────────────────────────────
function renderLagChart() {
  var canvas = document.getElementById('lagCanvas');
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width;
  var h = rect.height;

  ctx.clearRect(0, 0, w, h);

  var data = lagHistory;
  if (data.length < 2) return;

  var maxVal = Math.max.apply(null, data.concat([1]));

  ctx.strokeStyle = '#d29922';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (var i = 0; i < data.length; i++) {
    var x = (i / (data.length - 1)) * w;
    var y = h - 4 - ((data[i] / maxVal) * (h - 8));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill under line
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = '#d2992215';
  ctx.fill();
}

// ─── Render: Duration by Type ────────────────────────────────
function fetchDurationsByType() {
  fetch('/monitor/api/durations-by-type')
    .then(function(r) { return r.json(); })
    .then(function(data) { renderDurationByType(data); })
    .catch(function() {});
}

function renderDurationByType(data) {
  var container = document.getElementById('durationByType');
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color:#484f58; text-align:center; padding:12px; font-size:11px">No completed sagas yet</div>';
    return;
  }

  var globalMax = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i].max > globalMax) globalMax = data[i].max;
  }
  if (globalMax === 0) globalMax = 1;

  var html = '<table class="dur-table"><thead><tr>';
  html += '<th>Saga Type</th><th class="num">Count</th><th class="num">Min</th><th class="num">Avg</th><th class="num">p50</th><th class="num">p90</th><th class="num">p95</th><th class="num">Max</th><th style="width:120px">Range</th>';
  html += '</tr></thead><tbody>';

  for (var j = 0; j < data.length; j++) {
    var d = data[j];
    var minPct = (d.min / globalMax) * 100;
    var maxPct = (d.max / globalMax) * 100;
    var avgPct = (d.avg / globalMax) * 100;

    html += '<tr>';
    html += '<td class="dur-type-name">' + d.sagaName + '</td>';
    html += '<td class="num dur-type-count">' + d.count + '</td>';
    html += '<td class="num dur-val-min">' + formatDuration(d.min) + '</td>';
    html += '<td class="num dur-val-avg">' + formatDuration(d.avg) + '</td>';
    html += '<td class="num dur-val-pct">' + formatDuration(d.p50) + '</td>';
    html += '<td class="num dur-val-pct">' + formatDuration(d.p90) + '</td>';
    html += '<td class="num dur-val-pct">' + formatDuration(d.p95) + '</td>';
    html += '<td class="num dur-val-max">' + formatDuration(d.max) + '</td>';
    html += '<td><div class="dur-bar-bg">';
    html += '<div class="dur-bar-range" style="left:' + minPct + '%; width:' + (maxPct - minPct) + '%"></div>';
    html += '<div class="dur-bar-avg" style="left:' + avgPct + '%"></div>';
    html += '</div></td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ─── Render: Active Sagas ────────────────────────────────────
function renderActiveSagas() {
  var container = document.getElementById('activeSagas');
  var active = [];
  for (var sagaId in sagaState) {
    var saga = sagaState[sagaId];
    if (saga.status === 'running' || saga.status === 'compensating') {
      var firstEv = saga.events[0];
      var lastEv = saga.events[saga.events.length - 1];
      var dur = new Date(lastEv.occurredAt).getTime() - new Date(firstEv.occurredAt).getTime();
      active.push({
        sagaId: sagaId,
        name: firstEv.sagaName || '',
        status: saga.status,
        eventCount: saga.events.length,
        lastEvent: lastEv.eventType,
        duration: dur,
        startedAt: firstEv.occurredAt
      });
    }
  }
  active.sort(function(a, b) { return b.startedAt.localeCompare(a.startedAt); });

  if (active.length === 0) {
    container.innerHTML = '<div style="color:#484f58; text-align:center; padding:12px; font-size:11px">No active sagas</div>';
    return;
  }

  var html = '<table><thead><tr><th>Saga ID</th><th>Name</th><th>Status</th><th>Events</th><th>Last Event</th><th>Duration</th></tr></thead><tbody>';
  for (var i = 0; i < active.length; i++) {
    var s = active[i];
    var statusClass = s.status === 'running' ? 'active-status-running' : 'active-status-compensating';
    html += '<tr>';
    html += '<td class="active-saga-id">' + s.sagaId.slice(0, 12) + '...</td>';
    html += '<td class="active-saga-name">' + (s.name || '-') + '</td>';
    html += '<td><span class="active-saga-status ' + statusClass + '">' + s.status.toUpperCase() + '</span></td>';
    html += '<td class="active-saga-events">' + s.eventCount + '</td>';
    html += '<td>' + s.lastEvent + '</td>';
    html += '<td class="active-saga-duration">' + formatDuration(s.duration) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ─── Render: Live Feed ───────────────────────────────────────
function renderLiveFeed() {
  var container = document.getElementById('liveFeed');
  var html = '';
  for (var i = 0; i < liveEvents.length; i++) {
    var ev = liveEvents[i];
    var time = formatTime(ev.occurredAt);
    var hintClass = 'feed-hint-step';
    if (ev.hint === 'compensation') hintClass = 'feed-hint-compensation';
    else if (ev.hint === 'final') hintClass = 'feed-hint-final';
    else if (ev.hint === 'fork') hintClass = 'feed-hint-fork';

    html += '<div class="feed-row">';
    html += '<span class="feed-time">' + time + '</span>';
    html += '<span class="feed-type">' + ev.eventType + '</span>';
    html += '<span class="feed-hint ' + hintClass + '">' + (ev.hint || 'step') + '</span>';
    html += '<span class="feed-saga">' + ev.sagaId.slice(0, 8) + '...</span>';
    html += '</div>';
  }
  container.innerHTML = html || '<div style="color:#484f58; text-align:center; padding:20px">Waiting for events...</div>';
}

function formatTime(iso) {
  var d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

// ─── Load Test ───────────────────────────────────────────────
function openLoadTest() {
  document.getElementById('loadTestModal').classList.add('open');
}

function closeLoadTest() {
  document.getElementById('loadTestModal').classList.remove('open');
}

var ltAbort = null;

function startLoadTest() {
  if (loadTestRunning) return;
  loadTestRunning = true;

  var rps = parseInt(document.getElementById('ltRps').value) || 10;
  var duration = parseInt(document.getElementById('ltDuration').value) || 30;
  var btn = document.getElementById('ltStartBtn');
  btn.textContent = 'Running...';
  btn.disabled = true;
  document.getElementById('ltProgress').classList.add('active');

  var flows = [
    { path: '/recurrings', weight: 30 },
    { path: '/sim-swaps', weight: 20 },
    { path: '/upgrades', weight: 15 },
    { path: '/upgrades?fail=true', weight: 15 },
    { path: '/recurrings?paymentFail=true', weight: 10 },
    { path: '/bulk-activations?lines=3', weight: 10 },
  ];
  var totalWeight = 100;
  var cum = [];
  var acc = 0;
  for (var i = 0; i < flows.length; i++) {
    acc += flows[i].weight;
    cum.push({ path: flows[i].path, cum: acc });
  }

  function pick() {
    var r = Math.random() * totalWeight;
    for (var j = 0; j < cum.length; j++) {
      if (r < cum[j].cum) return cum[j].path;
    }
    return cum[cum.length - 1].path;
  }

  var intervalMs = 1000 / rps;
  var startTime = Date.now();
  var endTime = startTime + duration * 1000;
  var sent = 0;

  var timer = setInterval(function() {
    if (Date.now() >= endTime) {
      clearInterval(timer);
      finishLoadTest();
      return;
    }
    var path = pick();
    sent++;
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(function() {});

    var elapsed = (Date.now() - startTime) / 1000;
    var pctDone = Math.min((elapsed / duration) * 100, 100);
    document.getElementById('ltProgressBar').style.width = pctDone + '%';
    document.getElementById('ltProgressText').textContent = Math.floor(elapsed) + 's / ' + duration + 's  |  ' + sent + ' requests sent';
  }, intervalMs);

  ltAbort = function() { clearInterval(timer); finishLoadTest(); };
}

function finishLoadTest() {
  loadTestRunning = false;
  var btn = document.getElementById('ltStartBtn');
  btn.textContent = 'Start';
  btn.disabled = false;
  document.getElementById('ltProgressBar').style.width = '100%';
  document.getElementById('ltProgressText').textContent = 'Done!';
  setTimeout(function() {
    document.getElementById('ltProgress').classList.remove('active');
    document.getElementById('ltProgressBar').style.width = '0%';
  }, 3000);
}

// ─── Clear ───────────────────────────────────────────────────
function clearAll() {
  sagaState = {};
  counts = { running: 0, completed: 0, failed: 0, compensating: 0, total: 0 };
  sagasByType = {};
  totalEvents = 0;
  throughputHistory = [];
  lagHistory = [];
  lagTotal = 0;
  lagCount = 0;
  lagPeak = 0;
  lagCurrent = 0;
  liveEvents = [];
  renderCards();
  renderSagaTypes();
  renderLiveFeed();
  renderLag();
  updateStatusBar();
}

init();
</script>
</body>
</html>`;

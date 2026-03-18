export const SAGA_DETAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saga Detail</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; background: #0d1117; color: #c9d1d9; padding: 20px; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Header */
  .back-link { font-size: 12px; color: #8b949e; margin-bottom: 12px; display: inline-block; }
  .back-link:hover { color: #58a6ff; }
  .saga-header-info { margin-bottom: 16px; }
  .saga-header-info h1 { font-size: 18px; color: #58a6ff; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .saga-header-info .saga-desc { font-size: 12px; color: #8b949e; font-style: italic; margin-bottom: 8px; }
  .saga-header-info .saga-meta-row { font-size: 11px; color: #484f58; display: flex; gap: 16px; flex-wrap: wrap; }
  .saga-badge { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
  .badge-running { background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb44; }
  .badge-completed { background: #3fb95022; color: #3fb950; border: 1px solid #3fb95044; }
  .badge-compensating { background: #d2992222; color: #d29922; border: 1px solid #d2992244; }
  .badge-failed { background: #f8514922; color: #f85149; border: 1px solid #f8514944; }
  .badge-sub-saga { background: #a371f722; color: #a371f7; border: 1px solid #a371f744; font-size: 10px; padding: 2px 6px; border-radius: 10px; }

  .status-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; padding: 10px 14px; background: #161b22; border: 1px solid #21262d; border-radius: 6px; font-size: 12px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .status-dot.connected { background: #3fb950; box-shadow: 0 0 6px #3fb95066; }
  .status-dot.disconnected { background: #f85149; }
  .stat { color: #8b949e; }
  .stat b { color: #c9d1d9; }
  .controls { display: flex; gap: 8px; margin-left: auto; }
  .controls button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: inherit; }
  .controls button:hover { background: #30363d; border-color: #484f58; }
  .controls button.active-toggle { background: #1f6feb33; border-color: #1f6feb; color: #58a6ff; }

  /* Tabs */
  .tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid #21262d; }
  .tab { padding: 8px 16px; font-size: 12px; color: #8b949e; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; background: none; border-top: none; border-left: none; border-right: none; }
  .tab:hover { color: #c9d1d9; }
  .tab.active { color: #58a6ff; border-bottom-color: #58a6ff; }

  /* Saga groups */
  .saga-group { margin-bottom: 16px; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; background: #161b22; }
  .saga-group-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #161b22; border-bottom: 1px solid #21262d; cursor: pointer; user-select: none; }
  .saga-group-header:hover { background: #1c2128; }
  .saga-id { font-size: 13px; color: #58a6ff; font-weight: 600; }
  .saga-name-label { font-size: 12px; color: #d2a8ff; font-weight: 500; margin-left: 6px; }
  .saga-desc-label { font-size: 11px; color: #8b949e; font-style: italic; margin-left: 4px; }
  .saga-meta { font-size: 11px; color: #484f58; }
  .saga-count { font-size: 11px; color: #8b949e; margin-left: auto; }
  .chevron { color: #484f58; transition: transform 0.2s; font-size: 14px; }
  .chevron.open { transform: rotate(90deg); }

  /* Timeline (trace view) */
  .timeline { padding: 0 16px 12px 16px; }
  .event-row { display: flex; align-items: flex-start; position: relative; padding: 6px 0; }
  .event-line { position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; background: #21262d; }
  .event-row:last-child .event-line { display: none; }
  .event-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; margin-right: 12px; flex-shrink: 0; z-index: 1; border: 2px solid #0d1117; }
  .dot-step { background: #3fb950; }
  .dot-compensation { background: #d29922; }
  .dot-final-ok { background: #8b949e; }
  .dot-final-fail { background: #f85149; }
  .dot-fork { background: #a371f7; }
  .event-content { flex: 1; min-width: 0; cursor: pointer; }
  .event-type { font-size: 13px; font-weight: 600; color: #c9d1d9; }
  .event-type.hint-compensation { color: #d29922; }
  .event-type.hint-final-fail { color: #f85149; }
  .event-type.hint-fork { color: #a371f7; }
  .event-detail { font-size: 11px; color: #484f58; margin-top: 2px; }
  .event-causation { font-size: 10px; color: #484f58; margin-top: 1px; }
  .event-caused-by { color: #58a6ff; }
  .event-triggered { color: #3fb950; }
  .event-step { color: #8b949e; }
  .event-time { font-size: 11px; color: #484f58; margin-left: 12px; flex-shrink: 0; margin-top: 3px; white-space: nowrap; }
  .event-headers { margin-top: 4px; font-size: 11px; color: #8b949e; background: #0d1117; padding: 6px 8px; border-radius: 4px; display: none; }
  .event-headers table { width: 100%; border-collapse: collapse; }
  .event-headers td { padding: 1px 6px; vertical-align: top; }
  .event-headers td:first-child { color: #58a6ff; white-space: nowrap; width: 1%; }
  .event-headers td:last-child { color: #c9d1d9; word-break: break-all; }
  .event-row.expanded .event-headers { display: block; }
  .event-payload { margin-top: 4px; font-size: 11px; color: #8b949e; background: #0d1117; padding: 6px 8px; border-radius: 4px; max-height: 80px; overflow: auto; white-space: pre-wrap; word-break: break-all; display: none; }
  .event-row.expanded .event-payload { display: block; }

  /* Flame graph view */
  .flame-container { padding: 12px 16px; padding-right: 56px; }
  .flame-row { position: relative; height: 28px; margin-bottom: 2px; }
  .flame-bar { position: absolute; height: 24px; border-radius: 3px; top: 2px; min-width: 4px; display: flex; align-items: center; padding: 0 6px; font-size: 10px; color: #fff; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: pointer; transition: filter 0.15s; }
  .flame-bar:hover { filter: brightness(1.3); z-index: 2; }
  .flame-bar.hint-step { background: #238636; }
  .flame-bar.hint-compensation { background: #d29922; }
  .flame-bar.hint-final { background: #484f58; }
  .flame-bar.hint-final-fail { background: #f85149; }
  .flame-bar.hint-fork { background: #8957e5; }
  .flame-saga-bar { position: absolute; height: 24px; border-radius: 3px; top: 2px; min-width: 4px; border: 1px solid #30363d; background: #21262d; display: flex; align-items: center; padding: 0 6px; font-size: 10px; color: #8b949e; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .flame-tooltip { position: fixed; background: #1c2128; border: 1px solid #30363d; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #c9d1d9; z-index: 100; pointer-events: none; max-width: 300px; display: none; }
  .flame-tooltip .tt-type { font-weight: 600; margin-bottom: 2px; }
  .flame-tooltip .tt-detail { color: #8b949e; font-size: 10px; }
  .flame-time-axis { position: relative; height: 18px; margin-bottom: 4px; }
  .flame-time-tick { position: absolute; font-size: 9px; color: #484f58; transform: translateX(-50%); top: 0; }

  /* Span view */
  .span-container { padding: 12px 16px; padding-right: 56px; }
  .span-row { display: flex; align-items: center; height: 32px; border-bottom: 1px solid #21262d11; }
  .span-row:hover { background: #1c212844; }
  .span-label { flex-shrink: 0; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px; display: flex; align-items: center; gap: 6px; }
  .span-bar-area { flex: 1; position: relative; height: 20px; }
  .span-bar { position: absolute; height: 18px; border-radius: 3px; top: 1px; min-width: 4px; display: flex; align-items: center; padding: 0 6px; font-size: 10px; color: #fff; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: pointer; transition: filter 0.15s; }
  .span-bar:hover { filter: brightness(1.3); z-index: 2; }
  .span-bar.hint-step { background: #238636; }
  .span-bar.hint-compensation { background: #d29922; }
  .span-bar.hint-final { background: #484f58; }
  .span-bar.hint-final-fail { background: #f85149; }
  .span-bar.hint-fork { background: #8957e5; }
  .span-saga-row { display: flex; align-items: center; height: 28px; padding: 0; margin-top: 4px; }
  .span-saga-label { font-size: 11px; font-weight: 600; color: #58a6ff; display: flex; align-items: center; gap: 6px; }
  .span-saga-label.sub { color: #a371f7; }
  .span-duration { font-size: 10px; color: #484f58; margin-left: 6px; }
  .span-indent { display: inline-block; border-left: 1px solid #30363d; margin-left: 8px; padding-left: 8px; }
  .span-time-axis { position: relative; height: 18px; margin-bottom: 4px; }
  .span-time-tick { position: absolute; font-size: 9px; color: #484f58; transform: translateX(-50%); top: 0; }

  .empty { text-align: center; padding: 60px 20px; color: #484f58; }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .event-row.new { animation: slideIn 0.3s ease-out; }
</style>
</head>
<body>

<a class="back-link" href="/monitor">&larr; Back to saga list</a>

<div class="saga-header-info" id="sagaHeaderInfo">
  <h1 id="sagaTitle">Loading...</h1>
</div>

<div class="status-bar">
  <div>
    <span class="status-dot disconnected" id="statusDot"></span>
    <span id="statusText">Connecting...</span>
  </div>
  <span class="stat">Sagas: <b id="sagaCount">0</b></span>
  <span class="stat">Events: <b id="eventCount">0</b></span>
  <div class="controls">
    <button onclick="toggleGroupByRoot()" id="groupByRootBtn" class="active-toggle">Grouped</button>
  </div>
</div>

<div class="tabs">
  <button class="tab active" id="tab-trace" onclick="switchView('trace')">Trace</button>
  <button class="tab" id="tab-span" onclick="switchView('span')">Span</button>
  <button class="tab" id="tab-flame" onclick="switchView('flame')">Flame Graph</button>
</div>

<div class="flame-tooltip" id="flameTooltip"></div>
<div id="container">
  <div class="empty"><div class="empty-icon pulse">&#9678;</div><div>Loading saga events...</div></div>
</div>

<script>
let sagas = {};
let totalEvents = 0;
let currentView = 'trace';
let groupByRoot = true;

// Causation index
let eventById = {};
let childrenByCausation = {};

// Extract saga ID from URL path: /monitor/saga/:id
const pathParts = window.location.pathname.split('/');
const targetSagaId = pathParts[pathParts.length - 1];

function init() {
  fetch('/monitor/api/events/' + encodeURIComponent(targetSagaId))
    .then(r => r.json())
    .then(data => {
      for (const [sagaId, events] of Object.entries(data)) {
        for (const event of events) addEvent(event, false);
      }
      updateHeader();
      render();
    })
    .catch(() => {});

  const es = new EventSource('/monitor/stream');
  es.onopen = () => {
    document.getElementById('statusDot').className = 'status-dot connected';
    document.getElementById('statusText').textContent = 'Connected';
  };
  es.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    // Only process events belonging to this saga group
    if (sagas[event.sagaId] || event.rootSagaId === targetSagaId || event.sagaId === targetSagaId || event.parentSagaId === targetSagaId) {
      addEvent(event, true);
      updateHeader();
      render();
    }
  };
  es.onerror = () => {
    document.getElementById('statusDot').className = 'status-dot disconnected';
    document.getElementById('statusText').textContent = 'Disconnected';
  };
}

function addEvent(event, isNew) {
  const sagaId = event.sagaId;
  if (!sagas[sagaId]) {
    sagas[sagaId] = { events: [], rootSagaId: event.rootSagaId, parentSagaId: event.parentSagaId, sagaName: event.sagaName, sagaDescription: event.sagaDescription, isNew: isNew };
  }
  event._isNew = isNew;
  sagas[sagaId].events.push(event);
  totalEvents++;

  if (event.eventId) {
    eventById[event.eventId] = event;
  }
  if (event.causationId && event.causationId !== event.eventId) {
    if (!childrenByCausation[event.causationId]) childrenByCausation[event.causationId] = [];
    childrenByCausation[event.causationId].push(event);
  }
}

function updateHeader() {
  const sagaIds = Object.keys(sagas);
  if (sagaIds.length === 0) return;

  // Find root saga info
  const rootSaga = sagas[targetSagaId] || Object.values(sagas)[0];
  const allEvents = [];
  for (const s of Object.values(sagas)) {
    for (const e of s.events) allEvents.push(e);
  }
  allEvents.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const status = getSagaStatus(allEvents);
  const duration = getTimeDiff(allEvents);
  const name = rootSaga.sagaName || targetSagaId;

  let html = '<h1>' + name + ' <span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span>';
  if (sagaIds.length > 1) html += ' <span class="badge-sub-saga">' + sagaIds.length + ' sagas</span>';
  html += '</h1>';
  if (rootSaga.sagaDescription) html += '<div class="saga-desc">' + rootSaga.sagaDescription + '</div>';
  html += '<div class="saga-meta-row">';
  html += '<span>ID: ' + targetSagaId + '</span>';
  if (duration) html += '<span>Duration: ' + duration + '</span>';
  html += '<span>Events: ' + totalEvents + '</span>';
  html += '</div>';

  document.getElementById('sagaHeaderInfo').innerHTML = html;
  document.getElementById('sagaCount').textContent = sagaIds.length;
  document.getElementById('eventCount').textContent = totalEvents;
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + view).classList.add('active');
  render();
}

function toggleGroupByRoot() {
  groupByRoot = !groupByRoot;
  const btn = document.getElementById('groupByRootBtn');
  btn.textContent = groupByRoot ? 'Grouped' : 'Individual';
  if (groupByRoot) btn.classList.add('active-toggle');
  else btn.classList.remove('active-toggle');
  render();
}

// --- Shared utils ---

function getSagaStatus(events) {
  const last = events[events.length - 1];
  const hasCompensation = events.some(e => e.hint === 'compensation');
  if (last.hint === 'final') return hasCompensation ? 'failed' : 'completed';
  if (hasCompensation) return 'compensating';
  return 'running';
}

function getEventDotClass(ev) {
  if (ev.hint === 'fork') return 'dot-fork';
  if (ev.hint === 'compensation') return 'dot-compensation';
  if (ev.hint === 'final') {
    const sagaEvents = sagas[ev.sagaId]?.events ?? [];
    return sagaEvents.some(e => e.hint === 'compensation') ? 'dot-final-fail' : 'dot-final-ok';
  }
  return 'dot-step';
}

function getEventTypeClass(ev) {
  if (ev.hint === 'fork') return ' hint-fork';
  if (ev.hint === 'compensation') return ' hint-compensation';
  if (ev.hint === 'final') {
    const sagaEvents = sagas[ev.sagaId]?.events ?? [];
    return sagaEvents.some(e => e.hint === 'compensation') ? ' hint-final-fail' : '';
  }
  return '';
}

function getTimeDiff(events) {
  if (events.length < 2) return '';
  const first = new Date(events[0].occurredAt).getTime();
  const last = new Date(events[events.length - 1].occurredAt).getTime();
  const diff = last - first;
  if (diff < 1000) return diff + 'ms';
  return (diff / 1000).toFixed(1) + 's';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function hintColor(ev) {
  if (ev.hint === 'compensation') return '#d29922';
  if (ev.hint === 'fork') return '#a371f7';
  if (ev.hint === 'final') {
    const sagaEvents = sagas[ev.sagaId]?.events ?? [];
    return sagaEvents.some(e => e.hint === 'compensation') ? '#f85149' : '#8b949e';
  }
  return '#c9d1d9';
}

function buildSagaGroups() {
  const groups = {};
  function findRoot(sagaId, visited) {
    if (!visited) visited = {};
    if (visited[sagaId]) return sagaId;
    visited[sagaId] = true;
    const saga = sagas[sagaId];
    if (!saga) return sagaId;
    if (saga.parentSagaId && sagas[saga.parentSagaId]) return findRoot(saga.parentSagaId, visited);
    return sagaId;
  }
  for (const [sagaId, saga] of Object.entries(sagas)) {
    const rootId = findRoot(sagaId);
    if (!groups[rootId]) groups[rootId] = [];
    groups[rootId].push({ sagaId, ...saga });
  }
  return groups;
}

// --- RENDER ---
function render() {
  for (const saga of Object.values(sagas)) {
    saga.events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  const container = document.getElementById('container');

  if (Object.keys(sagas).length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon pulse">&#9678;</div><div>No events found for this saga</div></div>';
    return;
  }

  if (currentView === 'trace') renderTrace(container);
  else if (currentView === 'span') renderSpan(container);
  else renderFlameGraph(container);
}

// --- TRACE VIEW ---
function renderTrace(container) {
  if (groupByRoot) {
    renderTraceGrouped(container);
  } else {
    renderTraceIndividual(container);
  }
}

function renderTraceTimeline(events) {
  let html = '';
  for (const ev of events) {
    const isNewEvent = ev._isNew;
    ev._isNew = false;

    const isCrossSaga = ev._crossSaga;

    html += '<div class="event-row' + (isNewEvent ? ' new' : '') + '" onclick="this.classList.toggle(\\'expanded\\')">';
    html += '<div class="event-line"></div>';
    html += '<div class="event-dot ' + getEventDotClass(ev) + '"></div>';
    html += '<div class="event-content">';
    html += '<div class="event-type' + getEventTypeClass(ev) + '">' + ev.topic + '</div>';
    html += '<div class="event-detail"><span class="event-step">' + ev.stepName + '</span>';
    if (isCrossSaga) html += ' <span style="color:#a371f7; font-size:10px">[' + ev.sagaId.slice(0, 8) + '...]</span>';
    if (ev.stepDescription) html += ' <span style="color:#8b949e; font-size:10px; font-style:italic">' + ev.stepDescription + '</span>';
    html += '</div>';

    const causedBy = (ev.causationId && ev.causationId !== ev.eventId) ? eventById[ev.causationId] : null;
    const triggered = childrenByCausation[ev.eventId] || [];
    if (causedBy || triggered.length > 0) {
      html += '<div class="event-causation">';
      if (causedBy) html += '<span class="event-caused-by">&#8592; ' + causedBy.topic + '</span>';
      if (triggered.length > 0) {
        if (causedBy) html += '<span style="color:#30363d; margin:0 3px"> | </span>';
        html += '<span class="event-triggered">&#8594; ' + triggered.map(t => t.topic).join(', ') + '</span>';
      }
      html += '</div>';
    }

    html += '<div class="event-headers"><table>';
    html += '<tr><td>saga-id</td><td>' + ev.sagaId + '</td></tr>';
    html += '<tr><td>saga-root-id</td><td>' + ev.rootSagaId + '</td></tr>';
    if (ev.parentSagaId) html += '<tr><td>saga-parent-id</td><td>' + ev.parentSagaId + '</td></tr>';
    html += '<tr><td>saga-event-id</td><td>' + ev.eventId + '</td></tr>';
    html += '<tr><td>saga-causation-id</td><td>' + ev.causationId + '</td></tr>';
    html += '<tr><td>saga-correlation-id</td><td>' + ev.correlationId + '</td></tr>';
    html += '<tr><td>saga-step-name</td><td>' + ev.stepName + '</td></tr>';
    if (ev.stepDescription) html += '<tr><td>saga-step-description</td><td>' + ev.stepDescription + '</td></tr>';
    html += '<tr><td>saga-event-hint</td><td>' + (ev.hint || 'step') + '</td></tr>';
    if (ev.sagaName) html += '<tr><td>saga-name</td><td>' + ev.sagaName + '</td></tr>';
    if (ev.sagaDescription) html += '<tr><td>saga-description</td><td>' + ev.sagaDescription + '</td></tr>';
    html += '<tr><td>saga-published-at</td><td>' + ev.occurredAt + '</td></tr>';
    html += '<tr><td>topic</td><td>' + ev.topic + '</td></tr>';
    html += '</table></div>';
    if (ev.payload) html += '<div class="event-payload">' + JSON.stringify(ev.payload, null, 2) + '</div>';
    html += '</div>';
    html += '<span class="event-time">' + formatTime(ev.occurredAt) + '</span>';
    html += '</div>';
  }
  return html;
}

function renderTraceIndividual(container) {
  const sorted = Object.entries(sagas).sort((a, b) => {
    const aTime = a[1].events[0]?.occurredAt ?? '';
    const bTime = b[1].events[0]?.occurredAt ?? '';
    return bTime.localeCompare(aTime);
  });

  let html = '';
  for (const [sagaId, saga] of sorted) {
    const status = getSagaStatus(saga.events);
    const duration = getTimeDiff(saga.events);
    const isSubSaga = !!saga.parentSagaId;

    html += '<div class="saga-group">';
    html += '<div class="saga-group-header" onclick="toggleSaga(\\'' + sagaId + '\\')">';
    html += '<span class="chevron open" id="chevron-' + sagaId + '">&#9656;</span>';
    html += '<span class="saga-id">' + sagaId + '</span>';
    if (saga.sagaName) html += '<span class="saga-name-label">' + saga.sagaName + '</span>';
    if (saga.sagaDescription) html += '<span class="saga-desc-label">' + saga.sagaDescription + '</span>';
    if (isSubSaga) html += '<span class="badge-sub-saga">sub-saga</span>';
    html += '<span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span>';
    if (duration) html += '<span class="saga-meta">' + duration + '</span>';
    html += '<span class="saga-count">' + saga.events.length + ' event' + (saga.events.length !== 1 ? 's' : '') + '</span>';
    html += '</div>';

    html += '<div class="timeline" id="timeline-' + sagaId + '">';
    html += renderTraceTimeline(saga.events);
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function renderTraceGrouped(container) {
  const roots = buildSagaGroups();
  const sortedRoots = Object.entries(roots).sort((a, b) => {
    const aFirst = a[1][0]?.events[0]?.occurredAt ?? '';
    const bFirst = b[1][0]?.events[0]?.occurredAt ?? '';
    return bFirst.localeCompare(aFirst);
  });

  let html = '';
  for (const [rootId, sagaGroup] of sortedRoots) {
    const allEvents = [];
    for (const saga of sagaGroup) {
      for (const ev of saga.events) {
        ev._crossSaga = sagaGroup.length > 1 && saga.sagaId !== rootId;
        allEvents.push(ev);
      }
    }
    if (allEvents.length === 0) continue;
    allEvents.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    const status = getSagaStatus(allEvents);
    const duration = getTimeDiff(allEvents);

    html += '<div class="saga-group">';
    html += '<div class="saga-group-header" onclick="toggleSaga(\\'' + rootId + '\\')">';
    html += '<span class="chevron open" id="chevron-' + rootId + '">&#9656;</span>';
    const rootSaga = sagaGroup.find(s => s.sagaName);
    html += '<span class="saga-id">' + rootId + '</span>';
    if (rootSaga?.sagaName) html += '<span class="saga-name-label">' + rootSaga.sagaName + '</span>';
    if (rootSaga?.sagaDescription) html += '<span class="saga-desc-label">' + rootSaga.sagaDescription + '</span>';
    if (sagaGroup.length > 1) html += '<span class="badge-sub-saga">' + sagaGroup.length + ' sagas</span>';
    html += '<span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span>';
    if (duration) html += '<span class="saga-meta">' + duration + '</span>';
    html += '<span class="saga-count">' + allEvents.length + ' event' + (allEvents.length !== 1 ? 's' : '') + '</span>';
    html += '</div>';

    html += '<div class="timeline" id="timeline-' + rootId + '">';
    html += renderTraceTimeline(allEvents);
    html += '</div></div>';
  }
  container.innerHTML = html;
}

// --- SPAN VIEW ---
function renderSpan(container) {
  const roots = buildSagaGroups();
  const sortedRoots = Object.entries(roots).sort((a, b) => {
    const aFirst = a[1][0]?.events[0]?.occurredAt ?? '';
    const bFirst = b[1][0]?.events[0]?.occurredAt ?? '';
    return bFirst.localeCompare(aFirst);
  });

  let html = '';
  for (const [rootId, sagaGroup] of sortedRoots) {
    const allEvents = [];
    for (const saga of sagaGroup) {
      for (const ev of saga.events) allEvents.push(ev);
    }
    if (allEvents.length === 0) continue;

    allEvents.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const tMin = new Date(allEvents[0].occurredAt).getTime();
    const tMax = new Date(allEvents[allEvents.length - 1].occurredAt).getTime();
    const totalSpan = Math.max(tMax - tMin, 1);

    const status = getSagaStatus(allEvents);
    const duration = getTimeDiff(allEvents);

    html += '<div class="saga-group">';
    html += '<div class="saga-group-header" onclick="toggleSaga(\\'' + rootId + '-sp\\')">';
    html += '<span class="chevron open" id="chevron-' + rootId + '-sp">&#9656;</span>';
    const spRootSaga = sagaGroup.find(s => s.sagaName);
    html += '<span class="saga-id">' + rootId + '</span>';
    if (spRootSaga?.sagaName) html += '<span class="saga-name-label">' + spRootSaga.sagaName + '</span>';
    if (sagaGroup.length > 1) html += '<span class="badge-sub-saga">' + sagaGroup.length + ' sagas</span>';
    html += '<span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span>';
    if (duration) html += '<span class="saga-meta">' + duration + '</span>';
    html += '<span class="saga-count">' + allEvents.length + ' event' + (allEvents.length !== 1 ? 's' : '') + '</span>';
    html += '</div>';

    html += '<div class="span-container" id="timeline-' + rootId + '-sp">';

    // Time axis
    html += '<div class="span-time-axis">';
    const ticks = 6;
    for (let i = 0; i <= ticks; i++) {
      const pct = (i / ticks) * 100;
      const ms = Math.round((i / ticks) * totalSpan);
      const label = ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
      html += '<span class="span-time-tick" style="left:' + pct + '%">' + label + '</span>';
    }
    html += '</div>';

    const orderedSagas = sagaGroup.sort((a, b) => {
      if (a.sagaId === rootId) return -1;
      if (b.sagaId === rootId) return 1;
      return (a.events[0]?.occurredAt ?? '').localeCompare(b.events[0]?.occurredAt ?? '');
    });

    for (const saga of orderedSagas) {
      if (saga.events.length === 0) continue;
      const isSubSaga = saga.sagaId !== rootId;
      const sagaStatus = getSagaStatus(saga.events);
      const sagaDuration = getTimeDiff(saga.events);

      html += '<div class="span-saga-row">';
      if (isSubSaga) html += '<span class="span-indent"></span>';
      html += '<span class="span-saga-label' + (isSubSaga ? ' sub' : '') + '">';
      html += (isSubSaga ? '&#8627; ' : '') + (saga.sagaName || saga.sagaId.slice(0, 12) + '...');
      html += '</span>';
      html += '<span class="span-duration">' + sagaDuration + '</span>';
      html += '<span class="saga-badge badge-' + sagaStatus + '" style="margin-left:6px; font-size:9px">' + sagaStatus.toUpperCase() + '</span>';
      html += '</div>';

      for (let i = 0; i < saga.events.length; i++) {
        const ev = saga.events[i];
        const t = new Date(ev.occurredAt).getTime();
        const leftPct = ((t - tMin) / totalSpan) * 100;

        let widthPct = 2;
        if (i < saga.events.length - 1) {
          const tNext = new Date(saga.events[i + 1].occurredAt).getTime();
          widthPct = Math.max(((tNext - t) / totalSpan) * 100, 1.5);
        }

        let barClass = 'hint-step';
        if (ev.hint === 'compensation') barClass = 'hint-compensation';
        else if (ev.hint === 'final') {
          barClass = saga.events.some(e => e.hint === 'compensation') ? 'hint-final-fail' : 'hint-final';
        }
        else if (ev.hint === 'fork') barClass = 'hint-fork';

        const labelWidth = isSubSaga ? 240 : 220;

        html += '<div class="span-row">';
        html += '<div class="span-label" style="width:' + labelWidth + 'px">';
        if (isSubSaga) html += '<span class="span-indent"></span>';
        html += '<span style="color:' + hintColor(ev) + '">' + ev.topic + '</span>';
        html += '</div>';
        html += '<div class="span-bar-area">';
        html += '<div class="span-bar ' + barClass + '" style="left:' + leftPct + '%; width:' + widthPct + '%"';
        html += ' onmouseenter="showFlameTooltip(event, \\'' + ev.topic.replace(/'/g, "\\\\'") + '\\', \\'' + ev.stepName.replace(/'/g, "\\\\'") + '\\', \\'' + formatTime(ev.occurredAt) + '\\', \\'' + (ev.hint || 'step') + '\\', \\'' + (ev.eventId || '') + '\\', \\'' + (ev.stepDescription || '').replace(/'/g, "\\\\'") + '\\')"';
        html += ' onmouseleave="hideFlameTooltip()">';
        html += ev.stepName || ev.topic;
        html += '</div></div></div>';
      }
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

// --- FLAME GRAPH VIEW ---
function renderFlameGraph(container) {
  if (groupByRoot) {
    renderFlameGraphGrouped(container);
  } else {
    renderFlameGraphIndividual(container);
  }
}

function renderFlameEventRows(events, tMin, totalSpan) {
  let html = '';
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const t = new Date(ev.occurredAt).getTime();
    const evLeft = ((t - tMin) / totalSpan) * 100;

    let evWidth = 1.5;
    if (i < events.length - 1) {
      const tNext = new Date(events[i + 1].occurredAt).getTime();
      evWidth = Math.max(((tNext - t) / totalSpan) * 100, 1.5);
    }

    let barClass = 'hint-step';
    if (ev.hint === 'compensation') barClass = 'hint-compensation';
    else if (ev.hint === 'final') {
      barClass = events.some(e => e.hint === 'compensation') ? 'hint-final-fail' : 'hint-final';
    }
    else if (ev.hint === 'fork') barClass = 'hint-fork';

    html += '<div class="flame-row">';
    html += '<div class="flame-bar ' + barClass + '" style="left:' + evLeft + '%; width:' + evWidth + '%"';
    html += ' onmouseenter="showFlameTooltip(event, \\'' + ev.topic.replace(/'/g, "\\\\'") + '\\', \\'' + ev.stepName.replace(/'/g, "\\\\'") + '\\', \\'' + formatTime(ev.occurredAt) + '\\', \\'' + (ev.hint || 'step') + '\\', \\'' + (ev.eventId || '') + '\\', \\'' + (ev.stepDescription || '').replace(/'/g, "\\\\'") + '\\')"';
    html += ' onmouseleave="hideFlameTooltip()">';
    html += ev.topic;
    html += '</div></div>';
  }
  return html;
}

function renderFlameGraphGrouped(container) {
  const roots = buildSagaGroups();
  const sortedRoots = Object.entries(roots).sort((a, b) => {
    const aFirst = a[1][0]?.events[0]?.occurredAt ?? '';
    const bFirst = b[1][0]?.events[0]?.occurredAt ?? '';
    return bFirst.localeCompare(aFirst);
  });

  let html = '';
  for (const [rootId, sagaGroup] of sortedRoots) {
    const allEvents = [];
    for (const saga of sagaGroup) {
      for (const ev of saga.events) allEvents.push(ev);
    }
    if (allEvents.length === 0) continue;

    allEvents.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const tMin = new Date(allEvents[0].occurredAt).getTime();
    const tMax = new Date(allEvents[allEvents.length - 1].occurredAt).getTime();
    const totalSpan = Math.max(tMax - tMin, 1);

    const status = getSagaStatus(allEvents);
    const duration = getTimeDiff(allEvents);

    html += '<div class="saga-group">';
    const fgRootSaga = sagaGroup.find(s => s.sagaName);
    html += '<div class="saga-group-header" onclick="toggleSaga(\\'' + rootId + '-fg\\')">';
    html += '<span class="chevron open" id="chevron-' + rootId + '-fg">&#9656;</span>';
    html += '<span class="saga-id">' + rootId + '</span>';
    if (fgRootSaga?.sagaName) html += '<span class="saga-name-label">' + fgRootSaga.sagaName + '</span>';
    html += '<span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span>';
    if (duration) html += '<span class="saga-meta">' + duration + '</span>';
    html += '</div>';

    html += '<div class="flame-container" id="timeline-' + rootId + '-fg">';

    html += '<div class="flame-time-axis">';
    const ticks = 6;
    for (let i = 0; i <= ticks; i++) {
      const pct = (i / ticks) * 100;
      const ms = Math.round((i / ticks) * totalSpan);
      const label = ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
      html += '<span class="flame-time-tick" style="left:' + pct + '%">' + label + '</span>';
    }
    html += '</div>';

    const orderedSagas = sagaGroup.sort((a, b) => {
      if (a.sagaId === rootId) return -1;
      if (b.sagaId === rootId) return 1;
      return (a.events[0]?.occurredAt ?? '').localeCompare(b.events[0]?.occurredAt ?? '');
    });

    for (const saga of orderedSagas) {
      if (saga.events.length === 0) continue;

      const sagaStart = new Date(saga.events[0].occurredAt).getTime();
      const sagaEnd = new Date(saga.events[saga.events.length - 1].occurredAt).getTime();
      const leftPct = ((sagaStart - tMin) / totalSpan) * 100;
      const widthPct = Math.max(((sagaEnd - sagaStart) / totalSpan) * 100, 2);
      const isSubSaga = saga.sagaId !== rootId;
      const sagaStatus = getSagaStatus(saga.events);
      const statusColor = sagaStatus === 'completed' ? '#3fb950' : sagaStatus === 'failed' ? '#f85149' : sagaStatus === 'compensating' ? '#d29922' : '#58a6ff';

      html += '<div class="flame-row">';
      html += '<div class="flame-saga-bar" style="left:' + leftPct + '%; width:' + widthPct + '%; border-left: 3px solid ' + statusColor + '">';
      html += (isSubSaga ? '&#8627; ' : '') + (saga.sagaName || saga.sagaId) + ' (' + sagaStatus + ')';
      html += '</div></div>';

      html += renderFlameEventRows(saga.events, tMin, totalSpan);
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function renderFlameGraphIndividual(container) {
  const sorted = Object.entries(sagas).sort((a, b) => {
    const aTime = a[1].events[0]?.occurredAt ?? '';
    const bTime = b[1].events[0]?.occurredAt ?? '';
    return bTime.localeCompare(aTime);
  });

  let html = '';
  for (const [sagaId, saga] of sorted) {
    if (saga.events.length === 0) continue;
    const events = saga.events;
    const status = getSagaStatus(events);
    const duration = getTimeDiff(events);
    const isSubSaga = !!saga.parentSagaId;

    const tMin = new Date(events[0].occurredAt).getTime();
    const tMax = new Date(events[events.length - 1].occurredAt).getTime();
    const totalSpan = Math.max(tMax - tMin, 1);
    const statusColor = status === 'completed' ? '#3fb950' : status === 'failed' ? '#f85149' : status === 'compensating' ? '#d29922' : '#58a6ff';

    html += '<div class="saga-group">';
    html += '<div class="saga-group-header" onclick="toggleSaga(\\'' + sagaId + '-fg\\')">';
    html += '<span class="chevron open" id="chevron-' + sagaId + '-fg">&#9656;</span>';
    html += '<span class="saga-id">' + (isSubSaga ? '&#8627; ' : '') + sagaId + '</span>';
    if (saga.sagaName) html += '<span class="saga-name-label">' + saga.sagaName + '</span>';
    if (isSubSaga) html += '<span class="badge-sub-saga">sub-saga</span>';
    html += '<span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span>';
    if (duration) html += '<span class="saga-meta">' + duration + '</span>';
    html += '</div>';

    html += '<div class="flame-container" id="timeline-' + sagaId + '-fg">';

    html += '<div class="flame-time-axis">';
    const ticks = 6;
    for (let i = 0; i <= ticks; i++) {
      const pct = (i / ticks) * 100;
      const ms = Math.round((i / ticks) * totalSpan);
      const label = ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
      html += '<span class="flame-time-tick" style="left:' + pct + '%">' + label + '</span>';
    }
    html += '</div>';

    html += '<div class="flame-row">';
    html += '<div class="flame-saga-bar" style="left:0%; width:100%; border-left: 3px solid ' + statusColor + '">';
    html += (saga.sagaName || sagaId) + ' (' + status + ')';
    html += '</div></div>';

    html += renderFlameEventRows(events, tMin, totalSpan);
    html += '</div></div>';
  }
  container.innerHTML = html;
}

// --- Tooltip ---
function showFlameTooltip(e, type, step, time, hint, evId, stepDesc) {
  const tt = document.getElementById('flameTooltip');
  let tooltipHtml = '<div class="tt-type">' + type + '</div>'
    + '<div class="tt-detail">Step: ' + step + '</div>'
    + (stepDesc ? '<div class="tt-detail" style="color:#d2a8ff; font-style:italic">' + stepDesc + '</div>' : '')
    + '<div class="tt-detail">Time: ' + time + '</div>'
    + '<div class="tt-detail">Hint: ' + hint + '</div>';

  if (evId) {
    const triggered = childrenByCausation[evId] || [];
    const causedByEv = Object.values(eventById).find(ev => ev.eventId === evId);
    if (causedByEv && causedByEv.causationId && causedByEv.causationId !== causedByEv.eventId) {
      const parent = eventById[causedByEv.causationId];
      if (parent) tooltipHtml += '<div class="tt-detail" style="color:#58a6ff">&#8592; ' + parent.topic + '</div>';
    }
    if (triggered.length > 0) {
      tooltipHtml += '<div class="tt-detail" style="color:#3fb950">&#8594; ' + triggered.map(t => t.topic).join(', ') + '</div>';
    }
  }

  tt.innerHTML = tooltipHtml;
  tt.style.display = 'block';

  const ttRect = tt.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = e.clientX + 12;
  let top = e.clientY - 10;

  if (left + ttRect.width > vw - 8) left = e.clientX - ttRect.width - 12;
  if (top + ttRect.height > vh - 8) top = vh - ttRect.height - 8;
  if (left < 8) left = 8;

  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
}

function hideFlameTooltip() {
  document.getElementById('flameTooltip').style.display = 'none';
}

function toggleSaga(id) {
  const timeline = document.getElementById('timeline-' + id);
  const chevron = document.getElementById('chevron-' + id);
  if (!timeline) return;
  if (timeline.style.display === 'none') {
    timeline.style.display = '';
    if (chevron) chevron.classList.add('open');
  } else {
    timeline.style.display = 'none';
    if (chevron) chevron.classList.remove('open');
  }
}

init();
</script>
</body>
</html>`;

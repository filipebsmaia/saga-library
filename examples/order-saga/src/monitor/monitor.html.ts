export const MONITOR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saga Monitor</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; background: #0d1117; color: #c9d1d9; padding: 20px; }
  h1 { font-size: 18px; color: #58a6ff; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #484f58; margin-bottom: 20px; }
  .status-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; padding: 10px 14px; background: #161b22; border: 1px solid #21262d; border-radius: 6px; font-size: 12px; flex-wrap: wrap; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .status-dot.connected { background: #3fb950; box-shadow: 0 0 6px #3fb95066; }
  .status-dot.disconnected { background: #f85149; }
  .stat { color: #8b949e; }
  .stat b { color: #c9d1d9; }
  .controls { display: flex; gap: 8px; margin-left: auto; align-items: center; }
  .controls a, .controls button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: inherit; text-decoration: none; }
  .controls a:hover, .controls button:hover { background: #30363d; border-color: #484f58; }

  /* Filters */
  .filters { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid #21262d; }
  .filter-btn { padding: 8px 16px; font-size: 12px; color: #8b949e; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; background: none; border-top: none; border-left: none; border-right: none; }
  .filter-btn:hover { color: #c9d1d9; }
  .filter-btn.active { color: #58a6ff; border-bottom-color: #58a6ff; }
  .filter-count { font-size: 10px; background: #21262d; padding: 1px 6px; border-radius: 8px; margin-left: 4px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; padding: 8px 12px; font-size: 11px; color: #8b949e; font-weight: 600; border-bottom: 1px solid #21262d; position: sticky; top: 0; background: #0d1117; }
  tbody tr { border-bottom: 1px solid #21262d11; cursor: pointer; transition: background 0.15s; }
  tbody tr:hover { background: #161b22; }
  tbody td { padding: 8px 12px; font-size: 12px; white-space: nowrap; }
  .saga-id-cell { color: #58a6ff; font-weight: 600; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  .saga-id-cell.sub { padding-left: 28px; color: #a371f7; }
  .sub-indicator { color: #30363d; margin-right: 4px; }
  .saga-name-cell { color: #d2a8ff; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
  .saga-badge { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; display: inline-block; }
  .badge-running { background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb44; }
  .badge-completed { background: #3fb95022; color: #3fb950; border: 1px solid #3fb95044; }
  .badge-compensating { background: #d2992222; color: #d29922; border: 1px solid #d2992244; }
  .badge-failed { background: #f8514922; color: #f85149; border: 1px solid #f8514944; }
  .event-count { color: #8b949e; text-align: right; }
  .last-event-cell { color: #8b949e; font-size: 11px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
  .duration-cell { color: #8b949e; text-align: right; }
  .time-cell { color: #484f58; font-size: 11px; }

  .empty { text-align: center; padding: 60px 20px; color: #484f58; }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  tr.new { animation: slideIn 0.3s ease-out; }
</style>
</head>
<body>

<h1>Saga Monitor</h1>
<p class="subtitle">Real-time saga list</p>

<div class="status-bar">
  <div>
    <span class="status-dot disconnected" id="statusDot"></span>
    <span id="statusText">Connecting...</span>
  </div>
  <span class="stat">Sagas: <b id="sagaCount">0</b></span>
  <span class="stat">Events: <b id="eventCount">0</b></span>
  <span class="stat">Events/s: <b id="eventRate">0</b></span>
  <div class="controls">
    <label style="color:#8b949e; display:flex; align-items:center; gap:4px; font-size:11px;">Show
      <select id="maxSagasSelect" onchange="changeMaxSagas(this.value)" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; border-radius:4px; padding:2px 4px; font-size:11px; font-family:inherit;">
        <option value="10" selected>10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="0">All</option>
      </select>
    </label>
    <a href="/monitor/dashboard">Dashboard</a>
  </div>
</div>

<div class="filters">
  <button class="filter-btn active" data-filter="all" onclick="setFilter('all')">All <span class="filter-count" id="count-all">0</span></button>
  <button class="filter-btn" data-filter="running" onclick="setFilter('running')">Running <span class="filter-count" id="count-running">0</span></button>
  <button class="filter-btn" data-filter="completed" onclick="setFilter('completed')">Completed <span class="filter-count" id="count-completed">0</span></button>
  <button class="filter-btn" data-filter="failed" onclick="setFilter('failed')">Failed <span class="filter-count" id="count-failed">0</span></button>
  <button class="filter-btn" data-filter="compensating" onclick="setFilter('compensating')">Compensating <span class="filter-count" id="count-compensating">0</span></button>
</div>

<div id="container">
  <div class="empty" id="emptyState">
    <div class="empty-icon pulse">&#9678;</div>
    <div>Waiting for saga events...</div>
    <div style="font-size:12px; margin-top:8px; color:#30363d">POST /recurrings to start a saga</div>
  </div>
</div>

<script>
let sagas = {};
let totalEvents = 0;
let recentEvents = [];
let maxSagas = 10;
let currentFilter = 'all';

function init() {
  fetch('/monitor/api/sagas')
    .then(r => r.json())
    .then(data => {
      for (const s of data) {
        sagas[s.sagaId] = {
          rootSagaId: s.rootSagaId,
          parentSagaId: s.parentSagaId,
          sagaName: s.sagaName,
          _status: s.status,
          _groupStatus: s.groupStatus,
          eventCount: s.eventCount,
          firstEvent: s.firstEvent,
          lastEvent: s.lastEvent,
          startedAt: s.startedAt,
          lastUpdatedAt: s.lastUpdatedAt,
          isNew: false,
        };
        totalEvents += s.eventCount;
      }
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
    handleEvent(event);
  };
  es.onerror = () => {
    document.getElementById('statusDot').className = 'status-dot disconnected';
    document.getElementById('statusText').textContent = 'Disconnected';
  };

  setInterval(() => {
    const now = Date.now();
    recentEvents = recentEvents.filter(t => now - t < 1000);
    document.getElementById('eventRate').textContent = recentEvents.length;
  }, 500);
}

function handleEvent(event) {
  const sagaId = event.sagaId;
  totalEvents++;
  recentEvents.push(Date.now());

  if (!sagas[sagaId]) {
    sagas[sagaId] = {
      rootSagaId: event.rootSagaId,
      parentSagaId: event.parentSagaId,
      sagaName: event.sagaName,
      eventCount: 0,
      firstEvent: event.topic,
      lastEvent: event.topic,
      startedAt: event.receivedAt,
      lastUpdatedAt: event.receivedAt,
      isNew: true,
      _status: null,
      _events: [],
    };
  }

  const s = sagas[sagaId];
  s.eventCount++;
  s.lastEvent = event.topic;
  s.lastUpdatedAt = event.receivedAt;

  // Track hints to derive status
  if (!s._events) s._events = [];
  s._events.push({ hint: event.hint, occurredAt: event.occurredAt });

  // Derive individual status
  const last = s._events[s._events.length - 1];
  const hasCompensation = s._events.some(e => e.hint === 'compensation');
  if (last.hint === 'final') s._status = hasCompensation ? 'failed' : 'completed';
  else if (hasCompensation) s._status = 'compensating';
  else s._status = 'running';

  // Update groupStatus for all sagas in this group
  if (s._status !== 'running') {
    const groups = buildGroups();
    for (const [, group] of Object.entries(groups)) {
      if (group.some(g => g.sagaId === sagaId)) {
        // Recompute: use leaf-based derivation
        const hasChildren = {};
        for (const g of group) { if (g.parentSagaId) hasChildren[g.parentSagaId] = true; }
        const leafStatuses = group.filter(g => !hasChildren[g.sagaId]).map(g => getSagaStatus(g));
        let gs = 'completed';
        if (leafStatuses.includes('running')) gs = 'running';
        else if (leafStatuses.includes('compensating')) gs = 'compensating';
        else if (leafStatuses.includes('failed')) gs = 'failed';
        for (const g of group) { if (sagas[g.sagaId]) sagas[g.sagaId]._groupStatus = gs; }
        break;
      }
    }
  }

  updateRow(sagaId);
}

function getSagaStatus(saga) {
  return saga._status || 'running';
}

// Group status: use server-computed groupStatus (from merged events),
// falling back to client-side derivation for SSE-only sagas.
function getGroupStatus(group) {
  // Prefer server-computed groupStatus (available on initial fetch)
  const root = group.find(s => s._groupStatus);
  if (root) return root._groupStatus;

  // Fallback for SSE-only sagas: derive from leaf statuses
  if (group.length === 1) return getSagaStatus(group[0]);

  const hasChildren = {};
  for (const s of group) {
    if (s.parentSagaId) hasChildren[s.parentSagaId] = true;
  }
  const leafStatuses = group
    .filter(s => !hasChildren[s.sagaId])
    .map(s => getSagaStatus(s));

  if (leafStatuses.length === 0) return getSagaStatus(group[0]);
  if (leafStatuses.includes('running')) return 'running';
  if (leafStatuses.includes('compensating')) return 'compensating';
  if (leafStatuses.includes('failed')) return 'failed';
  return 'completed';
}

function getDuration(saga) {
  if (!saga.startedAt || !saga.lastUpdatedAt) return '-';
  const start = new Date(saga.startedAt).getTime();
  const end = new Date(saga.lastUpdatedAt).getTime();
  const diff = end - start;
  if (diff <= 0) return '-';
  if (diff < 1000) return diff + 'ms';
  return (diff / 1000).toFixed(1) + 's';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

// Group sagas by parent chain
function buildGroups() {
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

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="' + filter + '"]').classList.add('active');
  render();
}

function changeMaxSagas(val) {
  maxSagas = parseInt(val) || 0;
  render();
}

function updateRow(sagaId) {
  // Incremental: update a single row or insert at top, then update counters
  // For simplicity, re-render on each event but only update the table body
  render();
}

function render() {
  const groups = buildGroups();

  // Sort roots by most recent event desc
  const sortedRoots = Object.entries(groups).sort((a, b) => {
    const aTime = a[1].reduce((m, s) => s.lastUpdatedAt > m ? s.lastUpdatedAt : m, '');
    const bTime = b[1].reduce((m, s) => s.lastUpdatedAt > m ? s.lastUpdatedAt : m, '');
    return bTime.localeCompare(aTime);
  });

  // Count statuses (use group status for roots, individual for children)
  const counts = { all: 0, running: 0, completed: 0, failed: 0, compensating: 0 };
  for (const [rootId, group] of sortedRoots) {
    const groupSt = getGroupStatus(group);
    for (const saga of group) {
      const st = saga.sagaId === rootId ? groupSt : getSagaStatus(saga);
      counts.all++;
      if (counts[st] !== undefined) counts[st]++;
    }
  }
  document.getElementById('count-all').textContent = counts.all;
  document.getElementById('count-running').textContent = counts.running;
  document.getElementById('count-completed').textContent = counts.completed;
  document.getElementById('count-failed').textContent = counts.failed;
  document.getElementById('count-compensating').textContent = counts.compensating;

  document.getElementById('sagaCount').textContent = Object.keys(sagas).length;
  document.getElementById('eventCount').textContent = totalEvents;

  const container = document.getElementById('container');

  if (Object.keys(sagas).length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon pulse">&#9678;</div><div>Waiting for saga events...</div><div style="font-size:12px; margin-top:8px; color:#30363d">POST /recurrings to start a saga</div></div>';
    return;
  }

  // Filter roots by group status
  let filteredRoots = sortedRoots;
  if (currentFilter !== 'all') {
    filteredRoots = sortedRoots.filter(([, group]) => {
      return getGroupStatus(group) === currentFilter;
    });
  }

  // Apply limit
  const limitedRoots = maxSagas > 0 ? filteredRoots.slice(0, maxSagas) : filteredRoots;

  let html = '<table><thead><tr>';
  html += '<th>Saga ID</th>';
  html += '<th>Name</th>';
  html += '<th>Status</th>';
  html += '<th style="text-align:right">Events</th>';
  html += '<th>Last Event</th>';
  html += '<th style="text-align:right">Duration</th>';
  html += '<th>Started</th>';
  html += '</tr></thead><tbody>';

  for (const [rootId, group] of limitedRoots) {
    // Sort: root first, then children by startedAt
    const ordered = group.sort((a, b) => {
      if (a.sagaId === rootId) return -1;
      if (b.sagaId === rootId) return 1;
      return (a.startedAt || '').localeCompare(b.startedAt || '');
    });

    const groupSt = getGroupStatus(group);

    for (const saga of ordered) {
      const isSub = saga.sagaId !== rootId;
      const status = isSub ? getSagaStatus(saga) : groupSt;
      const duration = getDuration(saga);
      const isNew = saga.isNew;
      saga.isNew = false;
      if (sagas[saga.sagaId]) sagas[saga.sagaId].isNew = false;

      const detailUrl = '/monitor/saga/' + (isSub ? rootId : saga.sagaId);

      html += '<tr class="' + (isNew ? 'new' : '') + '" onclick="window.location.href=\\'' + detailUrl + '\\'">';
      html += '<td class="saga-id-cell' + (isSub ? ' sub' : '') + '">';
      if (isSub) html += '<span class="sub-indicator">&#8627;</span>';
      html += saga.sagaId.slice(0, 12) + '...';
      html += '</td>';
      html += '<td class="saga-name-cell">' + (saga.sagaName || '-') + '</td>';
      html += '<td><span class="saga-badge badge-' + status + '">' + status.toUpperCase() + '</span></td>';
      html += '<td class="event-count">' + saga.eventCount + '</td>';
      html += '<td class="last-event-cell">' + (saga.lastEvent || '-') + '</td>';
      html += '<td class="duration-cell">' + duration + '</td>';
      html += '<td class="time-cell">' + formatTime(saga.startedAt) + '</td>';
      html += '</tr>';
    }
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

init();
</script>
</body>
</html>`;

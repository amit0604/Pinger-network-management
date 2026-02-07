// script-dashboard.js

const REFRESH_INTERVAL = 30000; // fallback polling every 30s
const LATENCY_MAX_MS = 200; // used to normalize latency into percentage (adjustable)

const avgLatencyEl = document.getElementById('avg-latency');
const globalAvailabilityEl = document.getElementById('global-availability');
const globalSummaryEl = document.getElementById('global-summary');
const offlineListEl = document.getElementById('offline-list');
const groupsListEl = document.getElementById('groups-list');
const deviceTableBody = document.querySelector('#device-table tbody');
const tableSearch = document.getElementById('table-search');

let history = {};

let devices = [];
let status = {};
let selectedDevice = null; // ip of device to show per-device metrics (null = aggregated)
// Socket.IO connection
let socket = null;

// General recent events (online/offline) tracked client-side
const generalLogs = [];
// previous snapshot removed — server now emits alerts

// alerts are now shown only in Logs & SNMP merged panel; no dedicated alerts panel

async function fetchData() {
  const [devRes, statusRes, historyRes, snmpRes] = await Promise.all([
    fetch('/api/devices'),
    fetch('/api/status'),
    fetch('/api/status/history'),
    fetch('/api/snmp')
  ]);

  devices = await devRes.json();
  status = await statusRes.json();
  history = await historyRes.json().catch(() => ({}));
  window.__snmpLogs = await snmpRes.json().catch(() => ([]));
  // ensure merged logs render on initial load
  renderSNMP();
}

function renderSNMP(){
  const snmpLogs = window.__snmpLogs || [];
  const mergedUl = document.getElementById('merged-logs');
  if (!mergedUl) return;

  // merge general events and snmp logs by timestamp (most recent first)
  const gen = (generalLogs || []).map(e => {
    let msg = '';
    if (e.msg) msg = e.msg;
    else if (e.type && e.device) {
      const d = e.device || {};
      msg = `${e.type}: name=${d.name||''} ip=${d.ip||''} type=${d.type||''} group=${d.group||''}`;
    } else if (e.type && e.ip) {
      msg = `${e.type}: ${e.ip}`;
    } else {
      msg = JSON.stringify(e);
    }
    return { ts: e.ts || Math.floor(Date.now()/1000), msg };
  });
  const snmp = (snmpLogs || []).map(s => ({ ts: s.ts || 0, msg: s.msg || JSON.stringify(s) }));
  const merged = gen.concat(snmp).sort((a,b) => (b.ts || 0) - (a.ts || 0)).slice(0,3);

  mergedUl.innerHTML = '';
  if (!merged.length) {
    const li = document.createElement('li');
    li.textContent = 'No recent events';
    mergedUl.appendChild(li);
  } else {
    merged.forEach(e => {
      const li = document.createElement('li');
      try {
        const when = e.ts ? new Date(e.ts*1000).toLocaleString() : '';
        li.textContent = `${e.msg} ${when}`;
      } catch (ex) {
        li.textContent = `${e.msg}`;
      }
      mergedUl.appendChild(li);
    });
  }
}

function updateMetrics(){
  // Calculate bandwidth and throughput from history data
  const bwEl = document.getElementById('bandwidth-val');
  const tpEl = document.getElementById('throughput-val');
  
  // Calculate throughput: successful pings / time window * packet size
  // Ping packet is typically 56 bytes + 8 bytes ICMP header = 64 bytes
  const PING_PACKET_SIZE = 64; // bytes
  let totalSuccessfulPings = 0;
  let totalTimeWindow = 0;
  
  Object.values(history).forEach(samples => {
    if (!Array.isArray(samples) || samples.length === 0) return;
    samples.forEach(s => {
      if (s && s.online) totalSuccessfulPings += 1;
      if (s && s.ts) totalTimeWindow = Math.max(totalTimeWindow, s.ts);
    });
  });
  
  // Get earliest timestamp to calculate time window
  let earliestTime = Infinity;
  Object.values(history).forEach(samples => {
    if (Array.isArray(samples) && samples.length > 0) {
      const first = samples[0];
      if (first && first.ts) earliestTime = Math.min(earliestTime, first.ts);
    }
  });
  
  let throughputKbps = 0;
  if (totalTimeWindow && earliestTime !== Infinity) {
    const timeWindowSecs = (totalTimeWindow - earliestTime) || 1;
    const packetsPerSec = totalSuccessfulPings / timeWindowSecs;
    throughputKbps = (packetsPerSec * PING_PACKET_SIZE * 8) / 1000; // convert to Kbps
  }
  
  // Calculate effective bandwidth from packet loss
  // Assume devices have typical gigabit links; effective = theoretical * (1 - packet_loss)
  const packetLossRate = computePacketLoss() / 100;
  const theoreticalBandwidth = 1000; // assume 1 Gbps theoretical
  const effectiveBandwidth = theoreticalBandwidth * (1 - packetLossRate);
  
  if (bwEl) bwEl.textContent = effectiveBandwidth.toFixed(1) + ' Mbps';
  if (tpEl) tpEl.textContent = throughputKbps.toFixed(2) + ' Kbps';
}

function computePacketLoss(){
  // calculate overall packet loss from history samples
  let totalSamples = 0;
  let totalFailures = 0;

  Object.values(history).forEach(samples => {
    if (!Array.isArray(samples) || samples.length === 0) return;
    samples.forEach(s => {
      totalSamples += 1;
      if (!s || !s.online) totalFailures += 1;
    });
  });

  const overallLoss = totalSamples ? (totalFailures / totalSamples) * 100 : 0;
  const el = document.getElementById('avg-packet-loss');
  if (el) el.textContent = `${overallLoss.toFixed(1)}%`;
  return overallLoss;
}

function computeGlobalMetrics() {
  const entries = Object.entries(status);
  const total = entries.length;
  const online = entries.filter(([, s]) => s && s.online).length;
  const availability = total ? Math.round((online / total) * 100) : 0;

  // update gauge and summary
  const gaugeEl = document.getElementById('global-gauge');
  const valEl = document.getElementById('global-availability');
  if (gaugeEl && valEl) {
    valEl.textContent = `${availability}%`;
    // color thresholds: good >=90, warn >=70, else bad
    gaugeEl.classList.remove('good','warn','bad');
    if (availability >= 90) gaugeEl.classList.add('good');
    else if (availability >= 70) gaugeEl.classList.add('warn');
    else gaugeEl.classList.add('bad');

    // update svg stroke dash
    const progress = gaugeEl.querySelector('.gauge-progress');
    if (progress) {
      const r = progress.r.baseVal.value;
      const c = 2 * Math.PI * r;
      const offset = c * (1 - availability / 100);
      progress.style.strokeDasharray = `${c}`;
      progress.style.strokeDashoffset = `${offset}`;
    }
  }

  globalSummaryEl.textContent = `${online} / ${total} devices online`;
  // also update packet loss display from history
  computePacketLoss();
}

function computeAverageLatency() {
  const latencies = Object.values(status)
    .filter(s => s && s.online && typeof s.latency === 'number')
    .map(s => s.latency);

  if (!latencies.length) {
    avgLatencyEl.textContent = '-- ms';
    return;
  }

  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = sum / latencies.length;
  avgLatencyEl.textContent = `${avg.toFixed(1)} ms`;
}

// top-latency panel removed — no rendering function

function renderOffline() {
  const list = Object.entries(status)
    .filter(([, s]) => !s || !s.online)
    .map(([ip, s]) => ({ ip, last_seen: s && s.last_seen }))
    .slice(0, 8);

  offlineListEl.innerHTML = '';
  list.forEach(item => {
    const dev = devices.find(d => d.ip === item.ip) || { name: item.ip };
    const li = document.createElement('li');
    li.textContent = `${dev.name} (${item.ip})${item.last_seen ? ' — last: ' + new Date(item.last_seen*1000).toLocaleString() : ''}`;
    offlineListEl.appendChild(li);
  });
}

function renderGroupsOverview() {
  const groups = {};
  devices.forEach(d => {
    const g = d.group || 'ungrouped';
    groups[g] = groups[g] || { total: 0, online: 0 };
    groups[g].total += 1;
    const s = status[d.ip];
    if (s && s.online) groups[g].online += 1;
  });

  groupsListEl.innerHTML = '';
  Object.entries(groups).forEach(([g, v]) => {
    const li = document.createElement('li');
    const pct = v.total ? Math.round((v.online / v.total) * 100) : 0;
    li.textContent = `${g} — ${v.online}/${v.total} (${pct}%)`;
    groupsListEl.appendChild(li);
  });
}

function renderDeviceTable(filter = '') {
  const q = filter.trim().toLowerCase();
  deviceTableBody.innerHTML = '';

  devices.forEach(d => {
    const s = status[d.ip] || null;
    const name = d.name || d.ip;
    const rowText = `${name} ${d.ip}`.toLowerCase();
    if (q && !rowText.includes(q)) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name}</td>
      <td>${d.ip}</td>
      <td>${d.type || ''}</td>
      <td>${d.group || ''}</td>
      <td>${s && s.online ? 'Online' : 'Offline'}</td>
      <td>${s && s.online && typeof s.latency === 'number' ? s.latency + ' ms' : '-'}</td>
      <td>${s && s.last_seen ? new Date(s.last_seen*1000).toLocaleString() : '-'}</td>
    `;
    // attach click to select device for per-device charting
    tr.addEventListener('click', () => {
      // toggle selection
      if (selectedDevice === d.ip) selectedDevice = null;
      else selectedDevice = d.ip;
      // highlight selection
      Array.from(deviceTableBody.querySelectorAll('tr')).forEach(r => r.classList.remove('selected'));
      if (selectedDevice) tr.classList.add('selected');
      updateCharts();
    });
    deviceTableBody.appendChild(tr);
  });
}

function updateCharts() {
  // Render Top Latency list (current status values)
  const list = document.getElementById('top-latency-list');
  if (!list) return;

  const rows = [];
  Object.entries(status || {}).forEach(([ip, s]) => {
    if (s && s.online && typeof s.latency === 'number') rows.push({ ip, latency: s.latency });
  });

  // sort descending by latency and take top 5
  rows.sort((a,b) => b.latency - a.latency);
  const top = rows.slice(0,5);

  list.innerHTML = '';
  if (!top.length) {
    const li = document.createElement('li'); li.textContent = 'No latency data'; list.appendChild(li); return;
  }

  const maxVal = Math.max(...top.map(r => r.latency), 1);
  top.forEach(r => {
    const dev = devices.find(d => d.ip === r.ip) || { name: r.ip };
    const li = document.createElement('li');
    li.className = 'top-latency-item';
    li.innerHTML = `
      <div class="top-latency-row">
        <div class="tl-left"><strong>${dev.name}</strong> <span class="tl-ip">${r.ip}</span></div>
        <div class="tl-right">${r.latency.toFixed(1)} ms</div>
      </div>
      <div class="tl-bar"><div class="tl-bar-fill" style="width:${Math.min(100, (r.latency / maxVal) * 100)}%"></div></div>
    `;
    list.appendChild(li);
  });
}

function renderHeatmap(){
  const container = document.getElementById('heatmap-container');
  if (!container) return;
  container.innerHTML = '';
  const maxCols = 30; // lookback samples

  // for each device produce a row with last N samples
  (devices || []).forEach(d => {
    const row = document.createElement('div');
    row.className = 'heatmap-row';
    const name = document.createElement('div');
    name.className = 'heatmap-name';
    name.textContent = d.name || d.ip;
    const cells = document.createElement('div');
    cells.className = 'heatmap-cells';

    const samples = (history[d.ip] || []).slice(-maxCols);
    // pad left so most recent at right
    const pad = maxCols - samples.length;
    for (let i=0;i<pad;i++){ const c = document.createElement('div'); c.className='heatmap-cell unknown'; cells.appendChild(c);}    
    samples.forEach(s => {
      const c = document.createElement('div');
      c.className = 'heatmap-cell ' + (s && s.online ? 'online' : (s && s.online === false ? 'offline' : 'unknown'));
      cells.appendChild(c);
    });

    row.appendChild(name);
    row.appendChild(cells);
    container.appendChild(row);
  });
}

// stacked area chart removed per user request

async function refresh() {
  try {
    await fetchData();
    computeGlobalMetrics();
    computeAverageLatency();
    renderOffline();
    renderGroupsOverview();
    updateMetrics();
    renderSNMP();
    renderDeviceTable(tableSearch.value || '');
    updateCharts();
    renderHeatmap();
  } catch (e) {
    console.error('Dashboard refresh error', e);
  }
}

function setupSocket() {
  if (typeof io === 'undefined') return;
  socket = io();

  socket.on('connect', () => {
    console.log('socket connected');
  });

  socket.on('status_update', (data) => {
    status = data;
    // update UI immediately
    computeGlobalMetrics();
    computeAverageLatency();
    renderOffline();
    renderGroupsOverview();
    renderDeviceTable(tableSearch.value || '');
    updateCharts();
    renderSNMP();
    renderHeatmap();
    
  });

  socket.on('alert', (a) => {
    try {
      // store in merged recent events and render merged logs
      generalLogs.unshift(a);
      if (generalLogs.length > 50) generalLogs.pop();
      renderSNMP();
      showNotification(a.msg || `${a.type.toUpperCase()}: ${a.ip || ''}`);
    } catch (e) { console.error(e); }
  });

  socket.on('snmp_log', (entry) => {
    try {
      window.__snmpLogs = window.__snmpLogs || [];
      window.__snmpLogs.unshift(entry);
      if (window.__snmpLogs.length > 500) window.__snmpLogs.pop();
      renderSNMP();
      showNotification(`SNMP: ${entry.msg || entry}`);
    } catch (e) { console.error(e); }
  });
}

// alerts panel removed; alerts are shown only in Logs & SNMP merged panel

// Simple transient notification (bottom-right toast)
function showNotification(msg){
  try {
    // Native browser notification when permitted
    try {
      if (window.Notification) {
        if (Notification.permission === 'granted') {
          new Notification(msg);
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => { if (p === 'granted') new Notification(msg); });
        }
      }
    } catch (e) { /* ignore Notification API errors */ }

    // Fallback toast
    const el = document.createElement('div');
    el.className = 'dash-notif';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 3500);
    setTimeout(() => { try{ el.remove(); }catch(e){} }, 4200);
  } catch (e) { /* noop */ }
}

// Panel tooltip helpers
function showPanelTooltip(title, body){
  const modal = document.getElementById('panel-tooltip-modal');
  if (!modal) return;
  document.getElementById('tooltip-title').textContent = title || 'Panel Information';
  const bodyEl = document.getElementById('tooltip-body');
  bodyEl.textContent = '';
  if (typeof body === 'string') bodyEl.textContent = body;
  else bodyEl.textContent = JSON.stringify(body);
  modal.classList.remove('hidden');
}

function hidePanelTooltip(){
  const modal = document.getElementById('panel-tooltip-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function attachPanelTooltips(){
  document.querySelectorAll('.panel[data-tooltip]').forEach(panel => {
    // avoid double-binding
    panel.removeEventListener('click', panel._tooltipHandler);
    const handler = (ev) => {
      ev.stopPropagation();
      const titleEl = panel.querySelector('h3');
      const title = titleEl ? titleEl.textContent : (panel.id || 'Panel');
      const body = panel.dataset.tooltip || '';
      showPanelTooltip(title, body);
    };
    panel._tooltipHandler = handler;
    panel.addEventListener('click', handler);
  });

  // close button
  const closeBtn = document.getElementById('tooltip-close');
  if (closeBtn){
    closeBtn.removeEventListener('click', hidePanelTooltip);
    closeBtn.addEventListener('click', hidePanelTooltip);
  }

  // clicking outside modal-content closes it
  const modal = document.getElementById('panel-tooltip-modal');
  if (modal){
    modal.removeEventListener('click', modal._outsideHandler);
    modal._outsideHandler = function(e){ if (e.target === modal) hidePanelTooltip(); };
    modal.addEventListener('click', modal._outsideHandler);
  }
}

// initial load + socket
refresh().then(() => { setupSocket(); attachPanelTooltips(); });
// fallback polling in case socket not available
setInterval(refresh, REFRESH_INTERVAL);

// search filter
tableSearch.addEventListener('input', () => renderDeviceTable(tableSearch.value));

const state = {
  history: []
};

const el = (id) => document.getElementById(id);

const nodes = {
  updatedAt: el('updated-at'),
  servicePill: el('service-pill'),
  serviceState: el('service-state'),
  serviceNote: el('service-note'),
  players: el('players'),
  latency: el('latency'),
  uptime: el('uptime'),
  wsState: el('ws-state'),
  cpuValue: el('cpu-value'),
  cpuBar: el('cpu-bar'),
  memoryValue: el('memory-value'),
  memoryBar: el('memory-bar'),
  availability: el('availability'),
  availabilityNote: el('availability-note'),
  latencyCard: el('latency-card'),
  latencyNote: el('latency-note'),
  wsCard: el('ws-card'),
  history: el('history'),
  themeToggle: el('theme-toggle')
};

function formatTime(iso) {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(iso));
}

function statusLabel(stateValue) {
  if (stateValue === 'online') return 'Servicio estable';
  if (stateValue === 'degraded') return 'Servicio con carga';
  return 'Servicio caído';
}

function availabilityValue(stateValue) {
  if (stateValue === 'online') return 99.9;
  if (stateValue === 'degraded') return 97.4;
  return 0;
}

function memoryUsagePercent(item) {
  if (!item.memoryTotal) {
    return 0;
  }

  return Math.min((item.memoryUsed / item.memoryTotal) * 100, 100);
}

function renderHistory() {
  nodes.history.innerHTML = state.history
    .slice(-5)
    .reverse()
    .map((item) => {
      const cpuWidth = `${item.cpuLoad}%`;
      const memoryWidth = `${memoryUsagePercent(item)}%`;

      return `
        <div class="history-item">
          <span class="history-time">${formatTime(item.updatedAt)}</span>
          <div class="history-bars">
            <div class="mini-bar">
              <span>CPU</span>
              <div class="bar"><span class="fill cpu" style="width: ${cpuWidth}"></span></div>
            </div>
            <div class="mini-bar">
              <span>RAM</span>
              <div class="bar"><span class="fill memory" style="width: ${memoryWidth}"></span></div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function render(snapshot, connected) {
  state.history.push(snapshot);
  nodes.updatedAt.textContent = formatTime(snapshot.updatedAt);
  nodes.servicePill.textContent = statusLabel(snapshot.serviceState);
  nodes.serviceState.textContent = snapshot.serviceState.toUpperCase();
  nodes.serviceNote.textContent = snapshot.note;
  nodes.players.textContent = `${snapshot.players}/${snapshot.maxPlayers}`;
  nodes.latency.textContent = snapshot.latency > 0 ? `Latencia ${snapshot.latency} ms` : 'Latencia sin respuesta';
  nodes.uptime.textContent = `${Math.floor(snapshot.uptimeSeconds / 3600)}h ${Math.floor((snapshot.uptimeSeconds % 3600) / 60)}m`;
  nodes.wsState.textContent = connected ? 'WS connected' : 'WS reconnecting';
  nodes.cpuValue.textContent = `${snapshot.cpuLoad}%`;
  nodes.cpuBar.style.width = `${snapshot.cpuLoad}%`;
  nodes.memoryValue.textContent = `${snapshot.memoryUsed.toFixed(1)} / ${snapshot.memoryTotal.toFixed(1)} GB`;
  nodes.memoryBar.style.width = `${memoryUsagePercent(snapshot)}%`;
  nodes.availability.textContent = `${availabilityValue(snapshot.serviceState).toFixed(1)}%`;
  nodes.availabilityNote.textContent = statusLabel(snapshot.serviceState);
  nodes.latencyCard.textContent = `${snapshot.latency} ms`;
  nodes.latencyNote.textContent = snapshot.latency > 40 ? 'Alta' : snapshot.latency > 0 ? 'Normal' : 'Sin datos';
  nodes.wsCard.textContent = connected ? 'Connected' : 'Offline';
  renderHistory();
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/ws`);

  socket.addEventListener('open', () => {
    render({ ...state.history.at(-1), wsState: 'connected' }, true);
  });

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === 'snapshot') {
      render(payload.data, true);
    }
  });

  socket.addEventListener('close', () => {
    const last = state.history.at(-1);
    if (last) {
      render({ ...last, wsState: 'reconnecting' }, false);
    }
    setTimeout(connect, 2000);
  });
}

nodes.themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  nodes.themeToggle.textContent = document.body.classList.contains('light') ? 'Modo noche' : 'Modo día';
});

fetch('/api/snapshot')
  .then((response) => response.json())
  .then((snapshot) => {
    render(snapshot, false);
    connect();
  })
  .catch(() => {
    const fallback = {
      updatedAt: new Date().toISOString(),
      serviceState: 'offline',
      players: 0,
      maxPlayers: 32,
      cpuLoad: 0,
      memoryUsed: 0,
      memoryTotal: 8,
      latency: 0,
      uptimeSeconds: 0,
      note: 'No se pudo leer el backend.'
    };
    render(fallback, false);
    connect();
  });

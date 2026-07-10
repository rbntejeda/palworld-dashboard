const state = {
  history: [],
  historyMode: 'hour',
  historySeries: []
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
  serverFps: el('server-fps'),
  serverFpsNote: el('server-fps-note'),
  gameDays: el('game-days'),
  gameDaysNote: el('game-days-note'),
  baseCamps: el('base-camps'),
  baseCampsNote: el('base-camps-note'),
  serverName: el('server-name'),
  serverDescription: el('server-description'),
  serverVersion: el('server-version'),
  worldGuid: el('world-guid'),
  playerCount: el('player-count'),
  playersPill: el('players-pill'),
  playersList: el('players-list'),
  history: el('history'),
  themeToggle: el('theme-toggle'),
  historyNote: el('history-note'),
  historyChart: el('history-chart'),
  historyGrid: el('history-grid'),
  cpuArea: el('cpu-area'),
  memoryArea: el('memory-area'),
  cpuLine: el('cpu-line'),
  memoryLine: el('memory-line'),
  historyPoints: el('history-points'),
  historyLabels: el('history-labels'),
  historySummary: el('history-summary'),
  historyButtons: Array.from(document.querySelectorAll('.history-toggle'))
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

function formatWorldCoord(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }

  return Number(value).toFixed(0);
}

function formatGameDays(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }

  return `${Number(value).toFixed(0)} d`;
}

function memoryUsagePercent(item) {
  if (!item.memoryTotal) {
    return 0;
  }

  return Math.min((item.memoryUsed / item.memoryTotal) * 100, 100);
}

function metricColor(stateValue) {
  if (stateValue === 'online') return '#6ee7b7';
  if (stateValue === 'degraded') return '#ffbe5d';
  return '#ff5f6d';
}

function platformMeta(player) {
  const userId = String(player.userId || '').toLowerCase();

  if (userId.startsWith('steam_')) {
    return { label: 'Steam', glyph: 'S', key: 'steam' };
  }

  if (userId.startsWith('xbox_') || userId.startsWith('xbl') || userId.includes('xbox')) {
    return { label: 'Xbox', glyph: 'X', key: 'xbox' };
  }

  return { label: 'PC', glyph: 'P', key: 'pc' };
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
  nodes.playerCount.textContent = `${snapshot.players} player${snapshot.players === 1 ? '' : 's'} online`;
  nodes.playersPill.textContent = snapshot.rest?.configured ? 'REST API' : 'Fallback';
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
  nodes.serverFps.textContent = snapshot.rest?.metrics?.serverfps ?? '--';
  nodes.serverFpsNote.textContent = snapshot.rest?.configured ? 'REST metrics' : 'No REST';
  nodes.gameDays.textContent = formatGameDays(snapshot.rest?.metrics?.days);
  nodes.gameDaysNote.textContent = snapshot.rest?.configured ? 'In-game calendar' : 'No REST';
  nodes.baseCamps.textContent = snapshot.rest?.metrics?.basecampnum ?? '--';
  nodes.baseCampsNote.textContent = snapshot.rest?.configured ? 'World bases' : 'No REST';
  nodes.serverName.textContent = snapshot.rest?.serverInfo?.servername || 'Palworld';
  nodes.serverDescription.textContent = snapshot.rest?.serverInfo?.description || 'Esperando datos REST.';
  nodes.serverVersion.textContent = snapshot.rest?.serverInfo?.version || '--';
  nodes.worldGuid.textContent = snapshot.rest?.serverInfo?.worldguid || '--';
  nodes.playersList.innerHTML = renderPlayers(snapshot.rest?.players || []);
  renderHistory();
}

function renderPlayers(players) {
  if (!players.length) {
    return `
      <div class="player-empty">
        <strong>No players online</strong>
        <span>El REST API devolvió una lista vacía.</span>
      </div>
    `;
  }

  return players
    .map((player) => {
      const platform = platformMeta(player);
      const coords = `${formatWorldCoord(player.locationX)}, ${formatWorldCoord(player.locationY)}`;

      return `
        <article class="player-row">
          <div class="player-main">
            <div class="player-avatar ${platform.key}" aria-hidden="true">${platform.glyph}</div>
            <div class="player-copy">
              <strong>${escapeHtml(player.name)}</strong>
              <span>${escapeHtml(player.accountName || player.name)}</span>
            </div>
          </div>
          <div class="player-meta">
            <span class="platform-badge ${platform.key}">${platform.label}</span>
            <span>Loc ${coords}</span>
            <span>Ping ${Number(player.ping || 0).toFixed(0)} ms</span>
            <span>Lvl ${player.level || 0}</span>
            <span>Bld ${player.buildingCount || 0}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildChartPath(points, key, width, height, padding) {
  if (!points.length) {
    return { line: '', area: '' };
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const step = points.length === 1 ? 0 : innerWidth / (points.length - 1);
  const toY = (value) => padding + innerHeight - (Math.max(0, Math.min(100, value)) / 100) * innerHeight;

  const coords = points.map((point, index) => ({
    x: padding + index * step,
    y: toY(point[key])
  }));

  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area =
    coords.length === 1
      ? `M ${coords[0].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${coords[0].x.toFixed(1)} ${height - padding} Z`
      : `M ${coords[0].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} ${coords
          .slice(1)
          .map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
          .join(' ')} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding} Z`;

  return { line, area };
}

function renderHistoryChart(points) {
  const width = 1200;
  const height = 360;
  const padding = 42;

  if (!points.length) {
    nodes.historyNote.textContent = 'No hay datos suficientes todavía.';
    nodes.historySummary.innerHTML = '';
    nodes.historyGrid.innerHTML = '';
    nodes.cpuLine.setAttribute('points', '');
    nodes.memoryLine.setAttribute('points', '');
    nodes.cpuArea.setAttribute('d', '');
    nodes.memoryArea.setAttribute('d', '');
    nodes.historyPoints.innerHTML = '';
    nodes.historyLabels.innerHTML = '';
    return;
  }

  nodes.historyNote.textContent = `Mostrando ${points.length} bucket(s) por ${state.historyMode === 'day' ? 'día' : 'hora'} desde Redis o memoria.`;

  const cpuPath = buildChartPath(points, 'cpuLoad', width, height, padding);
  const memoryPath = buildChartPath(points, 'memoryUsagePercent', width, height, padding);
  const gridLines = [0, 25, 50, 75, 100];

  nodes.historyGrid.innerHTML = gridLines
    .map((value) => {
      const y = padding + (height - padding * 2) - (value / 100) * (height - padding * 2);
      return `
        <g>
          <line x1="${padding}" y1="${y.toFixed(1)}" x2="${width - padding}" y2="${y.toFixed(1)}"></line>
          <text x="${padding - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${value}%</text>
        </g>
      `;
    })
    .join('');

  nodes.cpuLine.setAttribute('points', cpuPath.line);
  nodes.memoryLine.setAttribute('points', memoryPath.line);
  nodes.cpuArea.setAttribute('d', cpuPath.area);
  nodes.memoryArea.setAttribute('d', memoryPath.area);

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const step = points.length === 1 ? 0 : innerWidth / (points.length - 1);
  const toY = (value) => padding + innerHeight - (Math.max(0, Math.min(100, value)) / 100) * innerHeight;

  nodes.historyPoints.innerHTML = points
    .map((point, index) => {
      const x = padding + index * step;
      const cpuY = toY(point.cpuLoad);
      const memoryY = toY(point.memoryUsagePercent);
      return `
        <g>
          <circle cx="${x.toFixed(1)}" cy="${cpuY.toFixed(1)}" r="5" fill="#ffbe5d"></circle>
          <circle cx="${x.toFixed(1)}" cy="${memoryY.toFixed(1)}" r="5" fill="#6ee7b7"></circle>
        </g>
      `;
    })
    .join('');

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  nodes.historyLabels.innerHTML = points
    .map((point, index) => {
      if (index % labelStep !== 0 && index !== points.length - 1) {
        return '';
      }

      const x = padding + index * step;
      return `<text x="${x.toFixed(1)}" y="${height - 12}" text-anchor="middle">${point.label}</text>`;
    })
    .join('');

  nodes.historySummary.innerHTML = points
    .slice(-8)
    .map(
      (point) => `
        <div class="summary-card">
          <strong>${point.label}</strong>
          <span>CPU ${point.cpuLoad}%</span>
          <span>RAM ${point.memoryUsagePercent}%</span>
          <span>Lat ${point.latency} ms</span>
        </div>
      `
    )
    .join('');
}

async function fetchHistory(bucket) {
  state.historyMode = bucket;
  nodes.historyButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.bucket === bucket);
  });

  try {
    const limit = bucket === 'day' ? 30 : 24;
    const response = await fetch(`/api/history?bucket=${encodeURIComponent(bucket)}&limit=${limit}`);
    const data = await response.json();
    state.historySeries = Array.isArray(data.points) ? data.points : [];
    renderHistoryChart(state.historySeries);
  } catch (error) {
    nodes.historyNote.textContent = `No pude cargar el histórico: ${error.message}`;
    renderHistoryChart([]);
  }
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

nodes.historyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    void fetchHistory(button.dataset.bucket);
  });
});

fetch('/api/snapshot')
  .then((response) => response.json())
  .then((snapshot) => {
    render(snapshot, false);
    connect();
    void fetchHistory(state.historyMode);
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
    void fetchHistory(state.historyMode);
  });

const state = {
  history: [],
  historyMode: 'hour',
  historySeries: [],
  mapViewer: null,
  mapAnno: null,
  mapImageUrl: '',
  mapPlayers: [],
  mapConfig: null
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
  serverTemp: el('server-temp'),
  serverTempNote: el('server-temp-note'),
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
  mapNote: el('map-note'),
  mapPill: el('map-pill'),
  mapSurface: el('map-surface'),
  mapLegend: el('map-legend'),
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

function formatTemperature(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }

  return `${Number(value).toFixed(1)}°C`;
}

function abbreviateId(value, head = 8, tail = 6) {
  const text = String(value || '').trim();

  if (text.length <= head + tail + 3) {
    return text || '--';
  }

  return `${text.slice(0, head)}…${text.slice(-tail)}`;
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeMapBounds(bounds) {
  const xMin = Number(bounds?.xMin);
  const xMax = Number(bounds?.xMax);
  const yMin = Number(bounds?.yMin);
  const yMax = Number(bounds?.yMax);

  return {
    xMin: Number.isFinite(xMin) ? xMin : -500000,
    xMax: Number.isFinite(xMax) ? xMax : 500000,
    yMin: Number.isFinite(yMin) ? yMin : -500000,
    yMax: Number.isFinite(yMax) ? yMax : 500000
  };
}

function normalizeMapTransform(mapConfig) {
  const transform = String(mapConfig?.transform || 'reference').toLowerCase();

  if (transform === 'bounds') {
    return { type: 'bounds' };
  }

  return {
    type: 'reference',
    xOffset: 157664.55791065,
    yOffset: -123467.1611767,
    scale: 462.962962963
  };
}

function normalizePlayerPosition(player, mapConfig) {
  if (!player?.hasCoordinates) {
    return null;
  }

  const transform = normalizeMapTransform(mapConfig);

  if (transform.type === 'reference') {
    const x = ((player.locationY - transform.xOffset) / transform.scale + 1000) / 2000;
    const y = ((1000 - ((player.locationX - transform.yOffset) / transform.scale)) / 2000);

    return {
      x: clamp(x * 100, 0, 100),
      y: clamp(y * 100, 0, 100)
    };
  }

  const bounds = normalizeMapBounds(mapConfig?.bounds);
  const xSpan = bounds.xMax - bounds.xMin;
  const ySpan = bounds.yMax - bounds.yMin;

  if (xSpan === 0 || ySpan === 0) {
    return null;
  }

  const xRatio = clamp((player.locationX - bounds.xMin) / xSpan, 0, 1);
  const yRatio = clamp((player.locationY - bounds.yMin) / ySpan, 0, 1);

  return {
    x: xRatio * 100,
    y: mapConfig?.invertY === false ? yRatio * 100 : (1 - yRatio) * 100
  };
}

function formatMapLocation(player) {
  if (!player?.hasCoordinates) {
    return 'Sin coordenadas';
  }

  return `${formatWorldCoord(player.locationX)}, ${formatWorldCoord(player.locationY)}`;
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
  state.lastSnapshot = snapshot;
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
  nodes.serverTemp.textContent = formatTemperature(snapshot.serverTemperatureC);
  nodes.serverTempNote.textContent = snapshot.serverTemperatureC === null ? 'Sin sensor' : 'Sensor del host';
  nodes.gameDays.textContent = formatGameDays(snapshot.rest?.metrics?.days);
  nodes.gameDaysNote.textContent = snapshot.rest?.configured ? 'In-game calendar' : 'No REST';
  nodes.baseCamps.textContent = snapshot.rest?.metrics?.basecampnum ?? '--';
  nodes.baseCampsNote.textContent = snapshot.rest?.configured ? 'World bases' : 'No REST';
  nodes.serverName.textContent = snapshot.rest?.serverInfo?.servername || 'Palworld';
  nodes.serverDescription.textContent = snapshot.rest?.serverInfo?.description || 'Esperando datos REST.';
  nodes.serverVersion.textContent = snapshot.rest?.serverInfo?.version || '--';
  const worldGuid = snapshot.rest?.serverInfo?.worldguid || '';
  nodes.worldGuid.textContent = abbreviateId(worldGuid);
  nodes.worldGuid.title = worldGuid || 'Sin world GUID';
  nodes.playersList.innerHTML = renderPlayers(snapshot.rest?.players || []);
  renderMap(snapshot.rest?.players || [], snapshot.map);
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
      const coords = formatMapLocation(player);

      return `
        <article class="player-row">
          <div class="player-main">
            <div class="player-avatar ${platform.key}" aria-hidden="true">${platform.glyph}</div>
            <div class="player-copy">
              <strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
              <span title="${escapeHtml(player.accountName || player.name)}">${escapeHtml(player.accountName || player.name)}</span>
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

function renderMap(players, mapConfig) {
  const imageUrl = mapConfig?.imageUrl || '';
  const visiblePlayers = players.filter((player) => player?.hasCoordinates);
  state.mapPlayers = visiblePlayers;
  state.mapConfig = mapConfig;

  const viewer = ensureMapViewer(imageUrl);

  if (nodes.mapPill) {
    nodes.mapPill.textContent = `${visiblePlayers.length} marker${visiblePlayers.length === 1 ? '' : 's'}`;
  }

  if (nodes.mapNote) {
    const transformLabel = mapConfig?.transform === 'bounds' ? 'bounds' : 'reference';
    nodes.mapNote.textContent = imageUrl
      ? `${mapConfig?.caption || 'Mapa de jugadores'} · transform ${transformLabel} · zoom, pinch y anotaciones`
      : 'El mapa incluido no está disponible. Define PALWORLD_MAP_IMAGE si quieres usar otro archivo.';
  }
  if (viewer && viewer.isOpen()) {
    renderMapOverlays();
  }

  const legendPlayers = visiblePlayers.slice(0, 4);
  nodes.mapLegend.innerHTML = legendPlayers
    .map((player) => {
      const platform = platformMeta(player);
      return `
        <div class="map-legend-item">
          <span class="map-legend-dot ${platform.key}"></span>
          <span>${escapeHtml(player.name)}</span>
        </div>
      `;
    })
    .join('');
}

function ensureMapViewer(imageUrl) {
  if (!nodes.mapSurface || typeof OpenSeadragon === 'undefined' || !imageUrl) {
    return null;
  }

  if (!state.mapViewer) {
    state.mapViewer = OpenSeadragon({
      element: nodes.mapSurface,
      tileSources: {
        type: 'image',
        url: imageUrl
      },
      crossOriginPolicy: 'Anonymous',
      gestureSettingsMouse: {
        clickToZoom: true,
        dblClickToZoom: true,
        dragToPan: true,
        scrollToZoom: true,
        pinchToZoom: true
      },
      gestureSettingsTouch: {
        clickToZoom: true,
        dblClickToZoom: true,
        dragToPan: true,
        scrollToZoom: true,
        pinchToZoom: true
      },
      showNavigationControl: false,
      preserveViewport: true,
      visibilityRatio: 1,
      constrainDuringPan: true,
      minZoomLevel: 0.75
    });

    state.mapViewer.addHandler('open', () => {
      ensureMapAnno();
      renderMapOverlays();
    });
  }

  if (state.mapImageUrl !== imageUrl) {
    state.mapImageUrl = imageUrl;
    state.mapViewer.open({ type: 'image', url: imageUrl });
  }

  return state.mapViewer;
}

function ensureMapAnno() {
  if (state.mapAnno || !state.mapViewer || typeof OpenSeadragon.Annotorious !== 'function') {
    return state.mapAnno;
  }

  state.mapAnno = OpenSeadragon.Annotorious(state.mapViewer, {
    allowEmpty: true
  });

  return state.mapAnno;
}

function renderMapOverlays() {
  const viewer = state.mapViewer;

  if (!viewer || !viewer.isOpen()) {
    return;
  }

  viewer.clearOverlays();

  const item = viewer.world.getItemAt(0);
  if (!item) {
    return;
  }

  const size = item.getContentSize();

  for (const player of state.mapPlayers) {
    const platform = platformMeta(player);
    const position = normalizePlayerPosition(player, state.mapConfig);

    if (!position) {
      continue;
    }

    const imagePoint = new OpenSeadragon.Point(
      (position.x / 100) * size.x,
      (position.y / 100) * size.y
    );

    const tooltip = [
      player.name,
      platform.label,
      `Lvl ${player.level || 0}`
    ].join(' · ');

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `map-marker ${platform.key}`;
    marker.title = tooltip;
    marker.setAttribute('aria-label', tooltip);
    marker.innerHTML = `
      <span class="map-marker-main">
        <strong>${escapeHtml(player.name)}</strong>
      </span>
    `;

    viewer.addOverlay({
      element: marker,
      location: viewer.viewport.imageToViewportCoordinates(imagePoint.x, imagePoint.y),
      placement: OpenSeadragon.Placement.CENTER
    });
  }
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
            <span>Temp ${formatTemperature(point.serverTemperatureC)}</span>
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
      serverTemperatureC: null,
      latency: 0,
      uptimeSeconds: 0,
      note: 'No se pudo leer el backend.'
    };
    render(fallback, false);
    connect();
    void fetchHistory(state.historyMode);
  });

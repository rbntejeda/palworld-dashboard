const state = {
  history: [],
  historyMode: 'hour',
  historySeries: [],
  paldex: {
    section: 'pals',
    query: '',
    page: 1,
    loading: false,
    configured: false,
    baseUrl: '',
    results: [],
    selectedSignature: '',
    selectedItem: null
  },
  dashboardView: 'server',
  mapViewer: null,
  mapAnno: null,
  mapImageUrl: '',
  mapPlayers: [],
  mapConfig: null,
  paldexSearchTimer: null
};

const PALDEX_TYPE_OPTIONS = [
  { value: 'fire', label: 'Fuego', icon: '/images/elements/fire.png' },
  { value: 'water', label: 'Agua', icon: '/images/elements/water.png' },
  { value: 'grass', label: 'Planta', icon: '/images/elements/grass.png' },
  { value: 'ice', label: 'Hielo', icon: '/images/elements/ice.png' },
  { value: 'electric', label: 'Rayo', icon: '/images/elements/electric.png' },
  { value: 'ground', label: 'Tierra', icon: '/images/elements/ground.png' },
  { value: 'dark', label: 'Oscuridad', icon: '/images/elements/dark.png' },
  { value: 'dragon', label: 'Dragón', icon: '/images/elements/dragon.png' },
  { value: 'neutral', label: 'No elemental', icon: '/images/elements/neutral.png' }
];

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
  availabilityAverage: el('availability-average'),
  availabilityAverageNote: el('availability-average-note'),
  availabilityDowntime: el('availability-downtime'),
  availabilityDowntimeNote: el('availability-downtime-note'),
  availabilityCurrent: el('availability-current'),
  availabilityCurrentNote: el('availability-current-note'),
  availabilityTimeline: el('availability-timeline'),
  paldexQuery: el('paldex-query'),
  paldexSearch: el('paldex-search'),
  paldexType: el('paldex-type'),
  paldexTypeMenu: el('paldex-type-menu'),
  paldexTypeSummary: el('paldex-type-summary'),
  paldexTypeCount: el('paldex-type-count'),
  paldexTypeOptions: el('paldex-type-options'),
  paldexSuitabilities: el('paldex-suitabilities'),
  paldexDrops: el('paldex-drops'),
  paldexClear: el('paldex-clear'),
  paldexPagination: el('paldex-pagination'),
  paldexPage: el('paldex-page'),
  paldexPrev: el('paldex-prev'),
  paldexNext: el('paldex-next'),
  paldexResults: el('paldex-results'),
  paldexResultsPanel: el('paldex-results-panel'),
  paldexDetail: el('paldex-detail'),
  paldexNote: el('paldex-note'),
  paldexCount: el('paldex-count'),
  paldexSource: el('paldex-source'),
  paldexRoute: el('paldex-route'),
  paldexSectionPill: el('paldex-section-pill'),
  paldexFilterRow: el('paldex-filter-row'),
  dashboardSidebarButtons: Array.from(document.querySelectorAll('[data-dashboard-nav]')),
  dashboardViewButtons: Array.from(document.querySelectorAll('[data-dashboard-view]')),
  dashboardViewPanels: Array.from(document.querySelectorAll('[data-dashboard-view-panel]')),
  paldexTabs: Array.from(document.querySelectorAll('[data-paldex-section]')),
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
  return availabilityScore(stateValue);
}

function availabilityScore(stateValue) {
  if (stateValue === 'online') return 100;
  if (stateValue === 'degraded') return 65;
  return 0;
}

function availabilityStateLabel(stateValue) {
  if (stateValue === 'online') return 'En línea';
  if (stateValue === 'degraded') return 'Degradado';
  return 'Caído';
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

function formatTemperatureSource(source) {
  if (source === 'thermal') {
    return 'Sensor thermal';
  }

  if (source === 'hwmon') {
    return 'Sensor hwmon';
  }

  return 'Sin sensor';
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

function renderPaldexEmpty(message, hint) {
  return `
    <div class="paldex-empty">
      <strong>${escapeHtml(message)}</strong>
      <span>${escapeHtml(hint)}</span>
    </div>
  `;
}

function paldexSectionLabel(section) {
  if (section === 'items') return 'Items';
  if (section === 'gear') return 'Gear';
  return 'Pals';
}

function paldexCountLabel(section, count) {
  if (section === 'items') {
    return count === 1 ? 'item' : 'items';
  }

  if (section === 'gear') {
    return 'gear';
  }

  return count === 1 ? 'pal' : 'pals';
}

function paldexRouteLabel(section) {
  return `/api/paldex/catalog?section=${section}`;
}

function paldexPlaceholder(section) {
  if (section === 'items') {
    return 'Gold Coin, saddle, pal sphere...';
  }

  if (section === 'gear') {
    return 'Cloth Outfit, Metal Helm, Pal Metal Armor...';
  }

  return 'Relaxaurus, fire, lightning, aqua...';
}

function paldexLimit(section) {
  if (section === 'gear') return 6;
  if (section === 'items') return 8;
  return 12;
}

function paldexTypeLabel(value) {
  const option = PALDEX_TYPE_OPTIONS.find((entry) => entry.value === value);
  return option?.label || String(value || '').trim();
}

function paldexTypeIcon(value) {
  return PALDEX_TYPE_OPTIONS.find((entry) => entry.value === value)?.icon || '';
}

function paldexSelectedTypes() {
  if (!nodes.paldexTypeOptions) {
    return [];
  }

  return Array.from(nodes.paldexTypeOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function syncPaldexTypeField() {
  if (!nodes.paldexType) {
    return [];
  }

  const selected = paldexSelectedTypes();
  nodes.paldexType.value = selected.join(',');

  if (nodes.paldexTypeSummary) {
    nodes.paldexTypeSummary.textContent = selected.length
      ? selected.map((value) => paldexTypeLabel(value)).join(', ')
      : 'Todos los elementos';
  }

  if (nodes.paldexTypeCount) {
    nodes.paldexTypeCount.textContent = String(selected.length);
  }

  if (nodes.paldexTypeMenu) {
    nodes.paldexTypeMenu.classList.toggle('has-selection', selected.length > 0);
  }

  return selected;
}

function renderPaldexTypeOptions() {
  if (!nodes.paldexTypeOptions) {
    return;
  }

  nodes.paldexTypeOptions.innerHTML = PALDEX_TYPE_OPTIONS.map(
    (option) => `
      <label class="paldex-multiselect-option">
        <input type="checkbox" value="${escapeHtml(option.value)}" data-paldex-type-option>
        <span class="paldex-multiselect-option-copy">
          <img src="${escapeHtml(option.icon)}" alt="" aria-hidden="true">
          <span>${escapeHtml(option.label)}</span>
        </span>
      </label>
    `
  ).join('');

  syncPaldexTypeField();
}

function hasPaldexCriteria(query, section = state.paldex.section) {
  const normalizedQuery = normalizePaldexSearchValue(query);

  if (normalizedQuery) {
    return true;
  }

  if (section !== 'pals') {
    return false;
  }

  return Boolean(
    normalizePaldexSearchValue(nodes.paldexType?.value) ||
      normalizePaldexSearchValue(nodes.paldexSuitabilities?.value) ||
      normalizePaldexSearchValue(nodes.paldexDrops?.value)
  );
}

function syncPaldexResultsVisibility(isVisible) {
  if (!nodes.paldexResultsPanel) {
    return;
  }

  nodes.paldexResultsPanel.hidden = !isVisible;
}

function setDashboardView(view) {
  const normalizedView = view === 'world' ? 'world' : 'server';
  state.dashboardView = normalizedView;

  if (nodes.dashboardViewButtons) {
    nodes.dashboardViewButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.dashboardView === normalizedView);
    });
  }

  if (nodes.dashboardViewPanels) {
    nodes.dashboardViewPanels.forEach((panel) => {
      const isActive = panel.dataset.dashboardViewPanel === normalizedView;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });
  }

  if (nodes.dashboardSidebarButtons) {
    nodes.dashboardSidebarButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.dashboardNav === normalizedView);
    });
  }
}

function scrollToDashboardTarget(targetId) {
  if (!targetId) {
    return;
  }

  const selector = targetId.startsWith('#') ? targetId : `#${targetId}`;
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }

  window.requestAnimationFrame(() => {
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
}

function paldexSignature(section, item, index) {
  return `${section}:${String(item?.key || item?.id || item?.name || index)}`;
}

function normalizePaldexSearchValue(value) {
  return String(value || '').trim();
}

function buildPaldexRequestParams(section, query, page) {
  const params = new URLSearchParams();
  params.set('term', normalizePaldexSearchValue(query));
  params.set('page', String(page));
  params.set('limit', String(paldexLimit(section)));

  if (section === 'pals') {
    if (nodes.paldexType?.value.trim()) {
      params.set('types', nodes.paldexType.value.trim());
    }

    if (nodes.paldexSuitabilities?.value.trim()) {
      params.set('suitabilities', nodes.paldexSuitabilities.value.trim());
    }

    if (nodes.paldexDrops?.value.trim()) {
      params.set('drops', nodes.paldexDrops.value.trim());
    }
  }

  return params;
}

function paldexFilterValues(section) {
  if (section !== 'pals') {
    return {};
  }

  return {
    types: normalizePaldexSearchValue(nodes.paldexType?.value),
    suitabilities: normalizePaldexSearchValue(nodes.paldexSuitabilities?.value),
    drops: normalizePaldexSearchValue(nodes.paldexDrops?.value)
  };
}

function syncPaldexFilterVisibility(section) {
  if (nodes.paldexFilterRow) {
    nodes.paldexFilterRow.hidden = section !== 'pals';
  }
}

function renderPaldexDetail(section, item) {
  if (!nodes.paldexDetail) {
    return;
  }

  if (!item) {
    nodes.paldexDetail.innerHTML = `
      <div class="paldex-detail-empty">
        <strong>Haz click en una card</strong>
        <span>Verás un detalle compacto con imagen, métricas y campos útiles del catálogo.</span>
      </div>
    `;
    return;
  }

  if (section === 'items') {
    nodes.paldexDetail.innerHTML = `
      <div class="paldex-detail-card">
        <div class="paldex-detail-media">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : '<div class="paldex-thumb-fallback">Sin imagen</div>'}
        </div>
        <div class="paldex-detail-copy">
          <div class="paldex-topline">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="paldex-key">${escapeHtml(item.key || 'item')}</span>
          </div>
          <p class="paldex-description">Detalle de item del catálogo Paldex.</p>
          <div class="paldex-mini-list">
            <span class="paldex-item-badge">Gold ${escapeHtml(item.gold || 0)}</span>
            <span class="paldex-mini-chip"><strong>Weight</strong> ${escapeHtml(item.weight || 0)}</span>
            <span class="paldex-mini-chip"><strong>Type</strong> ${escapeHtml(item.type || 'unknown')}</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (section === 'gear') {
    const tiers = Array.isArray(item.tiers) ? item.tiers : [];

    nodes.paldexDetail.innerHTML = `
      <div class="paldex-detail-card">
        <div class="paldex-detail-media">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : '<div class="paldex-thumb-fallback">Sin imagen</div>'}
        </div>
        <div class="paldex-detail-copy">
          <div class="paldex-topline">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="paldex-key">${escapeHtml(item.key || 'gear')}</span>
          </div>
          <p class="paldex-description">Equipo y sus variantes por rareza.</p>
          <div class="paldex-tier-grid">
            ${tiers
              .map(
                (tier) => `
                  <div class="paldex-tier-card">
                    <strong>${escapeHtml(tier.tier)}</strong>
                    <span>HP ${escapeHtml(tier.hp)} · DEF ${escapeHtml(tier.defense)}</span>
                    <span>Durability ${escapeHtml(tier.durability)} · Price ${escapeHtml(tier.price)}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
    return;
  }

  const types = Array.isArray(item.types) ? item.types : [];
  const suitabilities = Array.isArray(item.suitabilities) ? item.suitabilities : [];
  const drops = Array.isArray(item.drops) ? item.drops : [];
  const suitabilityLabels = suitabilities
    .map((suitability) => suitability?.name || suitability?.type || suitability?.level || suitability)
    .map((value) => String(value).trim())
    .filter(Boolean);

  nodes.paldexDetail.innerHTML = `
    <div class="paldex-detail-card">
      <div class="paldex-detail-media">
        ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : '<div class="paldex-thumb-fallback">Sin imagen</div>'}
      </div>
      <div class="paldex-detail-copy">
        <div class="paldex-topline">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="paldex-key">#${escapeHtml(item.key || item.id || '--')}</span>
        </div>
        <p class="paldex-description">${escapeHtml(item.description || 'Sin descripción')}</p>
        <div class="paldex-type-list">
          ${types
            .map(
              (type) => `
                <span class="paldex-type-chip">
                  ${type.imageUrl ? `<img class="paldex-type-icon" src="${escapeHtml(type.imageUrl)}" alt="${escapeHtml(type.name)}">` : ''}
                  <span>${escapeHtml(type.name)}</span>
                </span>
              `
            )
            .join('')}
        </div>
        <div class="paldex-mini-list">
          ${item.genus ? `<span class="paldex-mini-chip"><strong>Genus</strong> ${escapeHtml(item.genus)}</span>` : ''}
          ${Number.isFinite(item.rarity) ? `<span class="paldex-mini-chip"><strong>Rareza</strong> ${escapeHtml(item.rarity)}</span>` : ''}
          ${Number.isFinite(item.price) ? `<span class="paldex-mini-chip"><strong>Precio</strong> ${escapeHtml(item.price)}</span>` : ''}
          ${drops.length ? `<span class="paldex-mini-chip"><strong>Drops</strong> ${escapeHtml(drops.slice(0, 3).join(', '))}</span>` : ''}
          ${suitabilityLabels.length ? `<span class="paldex-mini-chip"><strong>Skills</strong> ${escapeHtml(suitabilityLabels.slice(0, 3).join(', '))}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderPaldexPagination(section, payload) {
  if (!nodes.paldexPagination || !nodes.paldexPage) {
    return;
  }

  const page = Number(payload?.page || 1);
  const limit = Number(payload?.limit || paldexLimit(section));
  const total = Number(payload?.total ?? payload?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  nodes.paldexPagination.hidden = total <= limit;
  nodes.paldexPage.textContent = `Página ${safePage} de ${totalPages}`;

  if (nodes.paldexPrev) {
    nodes.paldexPrev.disabled = safePage <= 1;
  }

  if (nodes.paldexNext) {
    nodes.paldexNext.disabled = safePage >= totalPages;
  }
}

function renderPaldexResults(section, results, selectedSignature = '') {
  if (!results.length) {
    return renderPaldexEmpty(
      'Sin resultados todavía',
      section === 'pals'
        ? 'Prueba con Relaxaurus, Fire, Dragon o una habilidad.'
        : section === 'items'
          ? 'Prueba con gold, saddle, armor o material.'
          : 'Prueba con Outfit, Helm, Armor o Saddle.'
    );
  }

  return results
    .map((item, index) => {
      const signature = paldexSignature(section, item, index);
      const selectedClass = selectedSignature && selectedSignature === signature ? ' is-selected' : '';

      if (section === 'items') {
        return `
          <button type="button" class="paldex-card paldex-card-button items${selectedClass}" data-paldex-index="${index}" data-paldex-signature="${escapeHtml(signature)}">
            <div class="paldex-thumb">
              ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : '<div class="paldex-thumb-fallback">Sin imagen</div>'}
            </div>
            <div class="paldex-body">
              <div class="paldex-topline">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="paldex-key">${escapeHtml(item.type || 'item')}</span>
              </div>
              <p class="paldex-description">${escapeHtml(item.key || 'Sin key')}</p>
              <div class="paldex-mini-list">
                <span class="paldex-item-badge">Gold ${escapeHtml(item.gold || 0)}</span>
                <span class="paldex-mini-chip"><strong>Weight</strong> ${escapeHtml(item.weight || 0)}</span>
                <span class="paldex-mini-chip"><strong>Type</strong> ${escapeHtml(item.type || 'unknown')}</span>
              </div>
            </div>
          </button>
        `;
      }

      if (section === 'gear') {
        const tiers = Array.isArray(item.tiers) ? item.tiers : [];

        return `
          <button type="button" class="paldex-card paldex-card-button gear${selectedClass}" data-paldex-index="${index}" data-paldex-signature="${escapeHtml(signature)}">
            <div class="paldex-thumb">
              ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : '<div class="paldex-thumb-fallback">Sin imagen</div>'}
            </div>
            <div class="paldex-body">
              <div class="paldex-topline">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="paldex-key">${escapeHtml(item.key || 'gear')}</span>
              </div>
              <p class="paldex-description">Equipo y variantes por rareza.</p>
              <div class="paldex-tier-grid">
                ${tiers
                  .map(
                    (tier) => `
                      <div class="paldex-tier-card">
                        <strong>${escapeHtml(tier.tier)}</strong>
                        <span>HP ${escapeHtml(tier.hp)} · DEF ${escapeHtml(tier.defense)}</span>
                        <span>Durability ${escapeHtml(tier.durability)} · Price ${escapeHtml(tier.price)}</span>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          </button>
        `;
      }

      const types = Array.isArray(item.types) ? item.types : [];
      const suitabilities = Array.isArray(item.suitabilities) ? item.suitabilities : [];
      const drops = Array.isArray(item.drops) ? item.drops : [];
      const suitabilityLabels = suitabilities
        .map((suitability) => suitability?.name || suitability?.type || suitability?.level || suitability)
        .map((value) => String(value).trim())
        .filter(Boolean);

      return `
        <button type="button" class="paldex-card paldex-card-button${selectedClass}" data-paldex-index="${index}" data-paldex-signature="${escapeHtml(signature)}">
          <div class="paldex-thumb">
            ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : '<div class="paldex-thumb-fallback">Sin imagen</div>'}
          </div>
          <div class="paldex-body">
            <div class="paldex-topline">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="paldex-key">#${escapeHtml(item.key || item.id || '--')}</span>
            </div>
            <p class="paldex-description">${escapeHtml(item.description || 'Sin descripción')}</p>
            <div class="paldex-type-list">
              ${types
                .map(
                  (type) => `
                    <span class="paldex-type-chip">
                      ${type.imageUrl ? `<img class="paldex-type-icon" src="${escapeHtml(type.imageUrl)}" alt="${escapeHtml(type.name)}">` : ''}
                      <span>${escapeHtml(type.name)}</span>
                    </span>
                  `
                )
                .join('')}
            </div>
            <div class="paldex-mini-list">
              ${item.genus ? `<span class="paldex-mini-chip"><strong>Genus</strong> ${escapeHtml(item.genus)}</span>` : ''}
              ${Number.isFinite(item.rarity) ? `<span class="paldex-mini-chip"><strong>Rareza</strong> ${escapeHtml(item.rarity)}</span>` : ''}
              ${Number.isFinite(item.price) ? `<span class="paldex-mini-chip"><strong>Precio</strong> ${escapeHtml(item.price)}</span>` : ''}
              ${drops.length ? `<span class="paldex-mini-chip"><strong>Drops</strong> ${escapeHtml(drops.slice(0, 2).join(', '))}</span>` : ''}
              ${suitabilityLabels.length ? `<span class="paldex-mini-chip"><strong>Skills</strong> ${escapeHtml(suitabilityLabels.slice(0, 2).join(', '))}</span>` : ''}
            </div>
          </div>
        </button>
      `;
    })
    .join('');
}

function renderPaldexState(payload, query, section = state.paldex.section) {
  const results = Array.isArray(payload?.content) ? payload.content : [];
  const count = Number(payload?.total ?? results.length ?? 0);
  const configured = Boolean(payload?.configured);
  const selectedSignature = state.paldex.selectedSignature || '';
  const selectedItem = results.find((item, index) => paldexSignature(section, item, index) === selectedSignature) || null;
  const hasCriteria = hasPaldexCriteria(query, section);

  state.paldex.loading = false;
  state.paldex.configured = configured;
  state.paldex.baseUrl = payload?.baseUrl || '';
  state.paldex.results = results;
  state.paldex.query = query;
  state.paldex.section = section;
  state.paldex.page = Number(payload?.page || 1);
  state.paldex.selectedItem = selectedItem;

  if (nodes.paldexSearch) {
    nodes.paldexSearch.disabled = false;
    nodes.paldexSearch.textContent = state.paldex.loading ? 'Buscando...' : 'Buscar';
  }

  if (nodes.paldexCount) {
    nodes.paldexCount.textContent = `${count} ${paldexCountLabel(section, count)}`;
  }

  if (nodes.paldexSource) {
    nodes.paldexSource.textContent = payload?.baseUrl || 'Paldex module';
  }

  if (nodes.paldexRoute) {
    nodes.paldexRoute.textContent = paldexRouteLabel(section);
  }

  if (nodes.paldexSectionPill) {
    nodes.paldexSectionPill.textContent = paldexSectionLabel(section);
  }

  syncPaldexFilterVisibility(section);

  if (nodes.paldexTabs) {
    nodes.paldexTabs.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.paldexSection === section);
    });
  }

  if (nodes.paldexNote) {
    if (payload?.note) {
      nodes.paldexNote.textContent = payload.note;
    } else if (!configured && section === 'pals') {
      nodes.paldexNote.textContent = 'El catálogo usa el dataset público del repo y puede apuntar a tu propia API si defines PALDEX_API_URL.';
    } else if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      nodes.paldexNote.textContent = payload.errors.join(' · ');
    } else {
      nodes.paldexNote.textContent = query
        ? `Mostrando resultados para "${query}".`
        : `Escribe un término para buscar ${paldexSectionLabel(section).toLowerCase()}.`;
    }
  }

  syncPaldexResultsVisibility(hasCriteria);

  if (nodes.paldexResults) {
    nodes.paldexResults.innerHTML = hasCriteria
      ? renderPaldexResults(section, results, selectedItem ? selectedSignature : '')
      : '';
  }

  if (nodes.paldexQuery) {
    nodes.paldexQuery.placeholder = paldexPlaceholder(section);
  }

  if (hasCriteria) {
    renderPaldexDetail(section, selectedItem);
    renderPaldexPagination(section, payload);
  } else if (nodes.paldexDetail) {
    nodes.paldexDetail.innerHTML = `
      <div class="paldex-detail-empty">
        <strong>Escribe algo para desplegar resultados</strong>
        <span>El panel de contenido se abre cuando escribes un nombre o eliges filtros.</span>
      </div>
    `;
    if (nodes.paldexPagination) {
      nodes.paldexPagination.hidden = true;
    }
  }
}

function setPaldexLoading(query, section = state.paldex.section) {
  state.paldex.loading = true;
  state.paldex.query = query;
  state.paldex.section = section;
  const hasCriteria = hasPaldexCriteria(query, section);

  if (nodes.paldexSearch) {
    nodes.paldexSearch.disabled = true;
    nodes.paldexSearch.textContent = 'Buscando...';
  }

  if (nodes.paldexCount) {
    nodes.paldexCount.textContent = 'Buscando...';
  }

  if (nodes.paldexNote) {
    nodes.paldexNote.textContent = query
      ? `Buscando "${query}" en ${paldexSectionLabel(section).toLowerCase()}...`
      : `Escribe un término para buscar ${paldexSectionLabel(section).toLowerCase()}.`;
  }

  syncPaldexResultsVisibility(hasCriteria);

  if (nodes.paldexResults) {
    nodes.paldexResults.innerHTML = renderPaldexEmpty(
      query ? `Buscando "${query}"` : 'Escribe un término',
      'El dashboard consulta el catálogo desde backend y pinta las cards cuando llegan los resultados.'
    );
  }

  if (nodes.paldexDetail && hasCriteria) {
    nodes.paldexDetail.innerHTML = `
      <div class="paldex-detail-empty">
        <strong>Buscando catálogo</strong>
        <span>La vista de detalle se actualiza cuando llega la respuesta.</span>
      </div>
    `;
  } else if (nodes.paldexDetail) {
    nodes.paldexDetail.innerHTML = `
      <div class="paldex-detail-empty">
        <strong>Escribe algo para desplegar resultados</strong>
        <span>El panel de contenido se abre cuando escribes un nombre o eliges filtros.</span>
      </div>
    `;
  }
}

async function fetchPaldex(query, section = state.paldex.section) {
  const normalizedQuery = String(query || '').trim();
  const page = Number(state.paldex.page || 1);
  const normalizedSection = String(section || state.paldex.section || 'pals').trim().toLowerCase();
  const filters = paldexFilterValues(normalizedSection);
  const hasCriteria = hasPaldexCriteria(normalizedQuery, normalizedSection);

  if (!hasCriteria) {
    state.paldex.loading = false;
    syncPaldexResultsVisibility(false);
    if (nodes.paldexResults) {
      nodes.paldexResults.innerHTML = '';
    }
    if (nodes.paldexDetail) {
      nodes.paldexDetail.innerHTML = `
        <div class="paldex-detail-empty">
          <strong>Escribe algo para desplegar resultados</strong>
          <span>El panel de contenido se abre cuando escribes un nombre o eliges filtros.</span>
        </div>
      `;
    }
    if (nodes.paldexSearch) {
      nodes.paldexSearch.disabled = false;
      nodes.paldexSearch.textContent = 'Buscar';
    }
    if (nodes.paldexCount) {
      nodes.paldexCount.textContent = '0 resultados';
    }
    if (nodes.paldexPagination) {
      nodes.paldexPagination.hidden = true;
    }
    if (nodes.paldexNote) {
      nodes.paldexNote.textContent = 'Escribe un término o elige un elemento para desplegar el catálogo.';
    }
    return;
  }

  setPaldexLoading(normalizedQuery, normalizedSection);

  try {
    const params = buildPaldexRequestParams(normalizedSection, normalizedQuery, page);

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }

    const response = await fetch(`/api/paldex/catalog?section=${encodeURIComponent(normalizedSection)}&${params.toString()}`);
    const payload = await response.json();
    renderPaldexState(payload, normalizedQuery, normalizedSection);
  } catch (error) {
    renderPaldexState(
      {
        configured: state.paldex.configured,
        baseUrl: state.paldex.baseUrl,
        errors: [error.message || String(error)],
        content: [],
        total: 0
      },
      normalizedQuery,
      normalizedSection
    );
  }
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

function renderAvailability(points) {
  if (!nodes.availabilityAverage || !nodes.availabilityTimeline) {
    return;
  }

  if (!points.length) {
    nodes.availabilityAverage.textContent = '--%';
    nodes.availabilityAverageNote.textContent = 'Esperando puntos';
    nodes.availabilityDowntime.textContent = '--';
    nodes.availabilityDowntimeNote.textContent = 'Sin historial';
    nodes.availabilityCurrent.textContent = '--';
    nodes.availabilityCurrentNote.textContent = 'Sin snapshot';
    nodes.availabilityTimeline.innerHTML = '';
    return;
  }

  const total = points.length;
  const onlineCount = points.filter((point) => point.serviceState === 'online').length;
  const degradedCount = points.filter((point) => point.serviceState === 'degraded').length;
  const offlineCount = points.filter((point) => point.serviceState === 'offline').length;
  const averageAvailability = points.reduce((sum, point) => sum + availabilityScore(point.serviceState), 0) / total;
  const lastPoint = points.at(-1);
  const downtimePercent = (offlineCount / total) * 100;

  nodes.availabilityAverage.textContent = `${averageAvailability.toFixed(1)}%`;
  nodes.availabilityAverageNote.textContent = `${onlineCount}/${total} buckets estables`;
  nodes.availabilityDowntime.textContent = `${downtimePercent.toFixed(1)}%`;
  nodes.availabilityDowntimeNote.textContent = `${offlineCount} offline · ${degradedCount} degradados`;
  nodes.availabilityCurrent.textContent = availabilityStateLabel(lastPoint.serviceState);
  nodes.availabilityCurrentNote.textContent = `Último punto ${lastPoint.label}`;

  nodes.availabilityTimeline.innerHTML = points
    .map((point) => {
      const label = `${point.label} · ${availabilityStateLabel(point.serviceState)} · ${point.count} snapshot${point.count === 1 ? '' : 's'}`;
      return `<span class="availability-segment ${point.serviceState}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
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
  nodes.serverTempNote.textContent = snapshot.serverTemperatureC === null
    ? 'Monta /sys/class/thermal y /sys/class/hwmon en Docker'
    : formatTemperatureSource(snapshot.serverTemperatureSource);
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
    renderAvailability([]);
    return;
  }

  nodes.historyNote.textContent = `Mostrando ${points.length} bucket(s) por ${state.historyMode === 'day' ? 'día' : 'hora'} desde Redis o memoria.`;
  renderAvailability(points);

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

if (nodes.paldexSearch) {
  nodes.paldexSearch.addEventListener('click', () => {
    state.paldex.page = 1;
    state.paldex.selectedSignature = '';
    void fetchPaldex(nodes.paldexQuery?.value || '', state.paldex.section);
  });
}

if (nodes.paldexQuery) {
  nodes.paldexQuery.addEventListener('input', () => {
    const query = nodes.paldexQuery.value;
    if (state.paldexSearchTimer) {
      clearTimeout(state.paldexSearchTimer);
    }

    state.paldex.page = 1;
    state.paldex.selectedSignature = '';
    state.paldexSearchTimer = setTimeout(() => {
      void fetchPaldex(query, state.paldex.section);
    }, 350);
  });

  nodes.paldexQuery.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (state.paldexSearchTimer) {
        clearTimeout(state.paldexSearchTimer);
      }
      state.paldex.page = 1;
      state.paldex.selectedSignature = '';
      void fetchPaldex(nodes.paldexQuery.value, state.paldex.section);
    }
  });
}

if (nodes.paldexTypeOptions) {
  nodes.paldexTypeOptions.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="checkbox"][data-paldex-type-option]');
    if (!input) {
      return;
    }

    syncPaldexTypeField();

    if (state.paldexSearchTimer) {
      clearTimeout(state.paldexSearchTimer);
    }

    state.paldex.page = 1;
    state.paldex.selectedSignature = '';
    state.paldexSearchTimer = setTimeout(() => {
      void fetchPaldex(nodes.paldexQuery?.value || '', state.paldex.section);
    }, 250);
  });
}

if (nodes.paldexTabs) {
  nodes.paldexTabs.forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.paldexSection || 'pals';
      if (section === state.paldex.section) {
        return;
      }

      state.paldex.section = section;
      state.paldex.page = 1;
      state.paldex.selectedSignature = '';
      if (state.paldexSearchTimer) {
        clearTimeout(state.paldexSearchTimer);
      }
      void fetchPaldex(nodes.paldexQuery?.value || '', section);
    });
  });
}

if (nodes.dashboardViewButtons) {
  nodes.dashboardViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setDashboardView(button.dataset.dashboardView || 'server');
    });
  });
}

if (nodes.dashboardSidebarButtons) {
  nodes.dashboardSidebarButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.dashboardNav || 'server';
      const target = button.dataset.target || '';
      setDashboardView(view);
      scrollToDashboardTarget(target);
    });
  });
}

if (nodes.paldexResults) {
  nodes.paldexResults.addEventListener('click', (event) => {
    const button = event.target.closest('[data-paldex-index]');
    if (!button) {
      return;
    }

    const index = Number(button.dataset.paldexIndex);
    const item = state.paldex.results[index];
    if (!item) {
      return;
    }

    state.paldex.selectedSignature = button.dataset.paldexSignature || paldexSignature(state.paldex.section, item, index);
    state.paldex.selectedItem = item;
    renderPaldexResults(state.paldex.section, state.paldex.results, state.paldex.selectedSignature);
    renderPaldexDetail(state.paldex.section, item);
  });
}

if (nodes.paldexPrev) {
  nodes.paldexPrev.addEventListener('click', () => {
    if (state.paldex.page <= 1) {
      return;
    }

    state.paldex.page -= 1;
    void fetchPaldex(nodes.paldexQuery?.value || '', state.paldex.section);
  });
}

if (nodes.paldexNext) {
  nodes.paldexNext.addEventListener('click', () => {
    state.paldex.page += 1;
    void fetchPaldex(nodes.paldexQuery?.value || '', state.paldex.section);
  });
}

if (nodes.paldexClear) {
  nodes.paldexClear.addEventListener('click', () => {
    if (nodes.paldexQuery) nodes.paldexQuery.value = '';
    if (nodes.paldexTypeOptions) {
      nodes.paldexTypeOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
    }
    syncPaldexTypeField();
    if (nodes.paldexSuitabilities) nodes.paldexSuitabilities.value = '';
    if (nodes.paldexDrops) nodes.paldexDrops.value = '';
    state.paldex.page = 1;
    state.paldex.selectedSignature = '';
    void fetchPaldex('', state.paldex.section);
  });
}

for (const filterNode of [nodes.paldexSuitabilities, nodes.paldexDrops]) {
  if (!filterNode) continue;

  filterNode.addEventListener('input', () => {
    if (state.paldexSearchTimer) {
      clearTimeout(state.paldexSearchTimer);
    }

    state.paldex.page = 1;
    state.paldex.selectedSignature = '';
    state.paldexSearchTimer = setTimeout(() => {
      void fetchPaldex(nodes.paldexQuery?.value || '', state.paldex.section);
    }, 350);
  });
}

renderPaldexTypeOptions();
setDashboardView('server');

renderPaldexState(
  {
    configured: true,
    baseUrl: 'Paldex module',
    content: [],
    total: 0,
    note: 'El catálogo Paldex usa el dataset público del repo y también puede apuntar a tu propia instancia.'
  },
  '',
  'pals'
);

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
      serverTemperatureSource: null,
      latency: 0,
      uptimeSeconds: 0,
      note: 'No se pudo leer el backend.'
    };
    render(fallback, false);
    connect();
    void fetchHistory(state.historyMode);
  });

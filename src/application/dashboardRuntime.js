const { summarizeHistory } = require('../domain/history');
const { fetchPalworldRestData } = require('../infrastructure/palworldRestClient');
const { probeGameServer } = require('../infrastructure/gameProbe');
const { createHistoryStore } = require('../infrastructure/historyStore');
const { createDockerContainerService } = require('../infrastructure/dockerContainerService');
const { readCpuUsage, readMemoryUsage, readTemperature } = require('../infrastructure/systemMetrics');

function createDashboardRuntime(config) {
  const startedAt = Date.now();
  const state = {
    startedAt,
    lastUpdatedAt: startedAt,
    lastPlayerSeenAt: null,
    lastServiceAction: null,
    snapshot: createEmptySnapshot(config, startedAt),
    samples: []
  };

  const historyStore = createHistoryStore({
    databaseUrl: config.databaseUrl,
    redisUrl: config.redisUrl,
    redisHistoryKey: config.redisHistoryKey,
    historyRetentionDays: config.historyRetentionDays,
    refreshIntervalMs: config.refreshIntervalMs,
    samples: state.samples
  });
  const dockerService = createDockerContainerService(config);

  let refreshInFlight = false;
  let serviceActionInFlight = false;

  async function buildSnapshot() {
    const [cpuLoad, memory, temperatureReading, probe, rest, dockerStatus] = await Promise.all([
      readCpuUsage(),
      readMemoryUsage(),
      readTemperature(),
      probeGameServer({ host: config.gameHost, port: config.gamePort }),
      fetchPalworldRestData({
        baseUrl: config.restBaseUrl,
        username: config.restUsername,
        password: config.restPassword
      }),
      dockerService.inspect()
    ]);

    const worldInfo = rest.serverInfo || {};
    const restMetrics = rest.metrics || {};
    const restPlayers = rest.players || [];
    const playerCount = Number(restMetrics.currentplayernum ?? restPlayers.length ?? 0);
    const maxPlayers = Number(restMetrics.maxplayernum || config.maxPlayers);
    const restLatency = rest.latencyMs || 0;
    const apiHealthy = !rest.configured || rest.ok;
    const highLoad = cpuLoad >= 80 || memory.usagePercent >= 85;
    const serviceState = apiHealthy
      ? highLoad
        ? 'degraded'
        : 'online'
      : rest.serverInfo || rest.metrics
        ? 'degraded'
        : 'offline';

    const note = rest.configured
      ? rest.ok
        ? `REST API ${config.restBaseUrl}. ${worldInfo.servername || 'Palworld'} | ${restMetrics.days ?? 0} days | ${restMetrics.basecampnum ?? 0} base camps.`
        : `REST API at ${config.restBaseUrl} returned errors: ${rest.errors.join(', ')}`
      : probe.configured
        ? probe.connected
          ? `Host metrics from /proc. Game probe OK for ${probe.target}.`
          : `Host metrics from /proc. Game probe failed for ${probe.target}.`
        : 'Host metrics from /proc. Set PALWORLD_HOST and PALWORLD_PORT to probe the game server.';

    const playersList = restPlayers.slice(0, 20);
    const now = Date.now();
    if (playerCount > 0) {
      state.lastPlayerSeenAt = now;
    }

    const serverService = await maybeAutoStopIdleServer({
      dockerStatus,
      playerCount,
      now
    });

    return {
      id: `snapshot-${Math.floor(Date.now() / config.refreshIntervalMs)}`,
      updatedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
      wsState: 'connected',
      serviceState,
      players: playerCount,
      maxPlayers,
      cpuLoad: round(cpuLoad),
      memoryUsed: round(memory.usedGb),
      memoryTotal: round(memory.totalGb),
      serverTemperatureC: temperatureReading.value === null ? null : round(temperatureReading.value),
      serverTemperatureSource: temperatureReading.source,
      latency: rest.configured ? restLatency : probe.latencyMs,
      note,
      probeTarget: rest.configured ? config.restBaseUrl : probe.target,
      memoryUsagePercent: round(memory.usagePercent),
      serverService,
      map: {
        imageUrl: config.mapImageUrl,
        caption: config.mapCaption,
        transform: config.mapTransform,
        invertY: config.mapInvertY,
        bounds: {
          xMin: config.mapBounds.xMin,
          xMax: config.mapBounds.xMax,
          yMin: config.mapBounds.yMin,
          yMax: config.mapBounds.yMax
        }
      },
      rest: {
        configured: rest.configured,
        baseUrl: rest.baseUrl,
        ok: rest.ok,
        errors: rest.errors,
        latencyMs: restLatency,
        serverInfo: worldInfo,
        metrics: restMetrics,
        players: playersList
      }
    };
  }

  async function refreshSnapshot(options = {}) {
    if (refreshInFlight && !options.force) {
      return state.snapshot;
    }

    refreshInFlight = true;

    try {
      state.snapshot = await buildSnapshot();
      state.lastUpdatedAt = Date.now();
      await historyStore.persistSnapshot(state.snapshot);
      return state.snapshot;
    } catch (error) {
      console.error(`Refresh failed: ${error.message}`);
      return state.snapshot;
    } finally {
      refreshInFlight = false;
    }
  }

  async function getHistorySummary(bucket, limit) {
    const bucketMs = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const since = Date.now() - bucketMs * limit;
    const rawSamples = await historyStore.loadRawHistory(since);

    return {
      bucket,
      limit,
      source: historyStore.getSource(),
      points: summarizeHistory(rawSamples, bucket, limit, config.maxPlayers)
    };
  }

  async function ensureHistoryBackend() {
    await historyStore.ensureHistoryBackend();
  }

  async function runServerServiceAction(action) {
    if (serviceActionInFlight) {
      return {
        ok: false,
        action,
        message: 'Ya hay una operación Docker en curso.',
        snapshot: state.snapshot
      };
    }

    serviceActionInFlight = true;

    try {
      const result = await dockerService.runAction(action);
      state.lastServiceAction = {
        ...result,
        at: new Date().toISOString()
      };

      const snapshot = await forceRefreshSnapshot();
      return {
        ...result,
        snapshot
      };
    } finally {
      serviceActionInFlight = false;
    }
  }

  async function forceRefreshSnapshot() {
    return refreshSnapshot({ force: true });
  }

  async function maybeAutoStopIdleServer({ dockerStatus, playerCount, now }) {
    const idleThresholdMs = Math.max(0, Number(config.autoStopIdleHours || 0)) * 60 * 60 * 1000;
    const idleSince = state.lastPlayerSeenAt || state.startedAt;
    const idleMs = playerCount > 0 ? 0 : now - idleSince;
    const autoStop = {
      enabled: idleThresholdMs > 0,
      idleHours: idleMs / (60 * 60 * 1000),
      thresholdHours: Number(config.autoStopIdleHours || 0),
      eligible: false,
      lastPlayerSeenAt: state.lastPlayerSeenAt ? new Date(state.lastPlayerSeenAt).toISOString() : null,
      lastAction: state.lastServiceAction
    };

    const status = {
      ...dockerStatus,
      autoStop,
      operations: describeDockerOperations(dockerStatus, autoStop)
    };

    if (!autoStop.enabled || playerCount > 0 || !dockerStatus.running || idleMs < idleThresholdMs) {
      autoStop.eligible = autoStop.enabled && playerCount === 0 && dockerStatus.running;
      return status;
    }

    const result = await dockerService.runAction('stop');
    state.lastServiceAction = {
      ...result,
      automatic: true,
      reason: `Sin jugadores por ${autoStop.idleHours.toFixed(1)} horas.`,
      at: new Date().toISOString()
    };

    const updatedDockerStatus = await dockerService.inspect();
    const updatedAutoStop = {
      ...autoStop,
      eligible: true,
      lastAction: state.lastServiceAction
    };

    return {
      ...updatedDockerStatus,
      autoStop: {
        ...updatedAutoStop
      },
      operations: describeDockerOperations(updatedDockerStatus, updatedAutoStop)
    };
  }

  return {
    state,
    close: historyStore.close,
    ensureHistoryBackend,
    getHistorySummary,
    runServerServiceAction,
    refreshSnapshot
  };
}

function createEmptySnapshot(config, startedAt) {
  return {
    id: 'snapshot-0',
    updatedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: 0,
    wsState: 'connected',
    serviceState: 'offline',
    players: 0,
    maxPlayers: config.maxPlayers,
    cpuLoad: 0,
    memoryUsed: 0,
    memoryTotal: 1,
    serverTemperatureC: null,
    serverTemperatureSource: null,
    latency: 0,
    note: 'Waiting for first system sample.',
    probeTarget: config.gameHost && config.gamePort ? `${config.gameHost}:${config.gamePort}` : 'not configured',
    memoryUsagePercent: 0,
    serverService: {
      configured: Boolean(config.serverContainerName),
      containerName: config.serverContainerName,
      status: config.serverContainerName ? 'unknown' : 'unconfigured',
      running: false,
      available: false,
      canStart: false,
      canRestart: false,
      canStop: false,
      state: 'unknown',
      startedAt: null,
      finishedAt: null,
      error: '',
      description: config.serverContainerName
        ? 'Esperando lectura de Docker.'
        : 'Define CONTAINER_NAME para habilitar operaciones Docker.',
      autoStop: {
        enabled: Number(config.autoStopIdleHours || 0) > 0,
        idleHours: 0,
        thresholdHours: Number(config.autoStopIdleHours || 0),
        eligible: false,
        lastPlayerSeenAt: null,
        lastAction: null
      },
      operations: []
    },
    map: {
      imageUrl: config.mapImageUrl,
      caption: config.mapCaption,
      transform: config.mapTransform,
      invertY: config.mapInvertY,
      bounds: {
        xMin: config.mapBounds.xMin,
        xMax: config.mapBounds.xMax,
        yMin: config.mapBounds.yMin,
        yMax: config.mapBounds.yMax
      }
    },
    rest: {
      configured: false,
      baseUrl: config.restBaseUrl || 'not configured',
      ok: false,
      errors: [],
      serverInfo: null,
      players: [],
      metrics: null,
      latencyMs: 0
    }
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function describeDockerOperations(status, autoStop) {
  if (!status.configured) {
    return [
      'Configura CONTAINER_NAME para habilitar iniciar, reiniciar y detener.'
    ];
  }

  if (status.status === 'missing' || status.status === 'unknown') {
    return [
      status.description || 'No se puede operar el contenedor hasta resolver la conexión con Docker.'
    ];
  }

  const operations = [];

  if (status.canStart) {
    operations.push('Servicio detenido: iniciar ejecuta Docker start sobre el contenedor configurado.');
  }

  if (status.canRestart) {
    operations.push('Servicio disponible: reiniciar ejecuta Docker restart sobre el contenedor.');
  }

  if (status.canStop) {
    operations.push('Detener apaga el contenedor de Palworld manualmente.');
  }

  if (autoStop.enabled) {
    operations.push(`Auto-stop activo: si no hay jugadores por ${autoStop.thresholdHours}h, el dashboard detiene el contenedor.`);
  } else {
    operations.push('Auto-stop inactivo: define INACTIVITY_SHUTDOWN_DELAY para apagar por inactividad.');
  }

  return operations;
}

module.exports = {
  createDashboardRuntime
};

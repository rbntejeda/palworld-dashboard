const { summarizeHistory } = require('../domain/history');
const { fetchPalworldRestData } = require('../infrastructure/palworldRestClient');
const { probeGameServer } = require('../infrastructure/gameProbe');
const { createHistoryStore } = require('../infrastructure/historyStore');
const { readCpuUsage, readMemoryUsage, readTemperature } = require('../infrastructure/systemMetrics');

function createDashboardRuntime(config) {
  const startedAt = Date.now();
  const state = {
    startedAt,
    lastUpdatedAt: startedAt,
    snapshot: createEmptySnapshot(config, startedAt),
    samples: []
  };

  const historyStore = createHistoryStore({
    redisUrl: config.redisUrl,
    redisHistoryKey: config.redisHistoryKey,
    historyRetentionDays: config.historyRetentionDays,
    refreshIntervalMs: config.refreshIntervalMs,
    samples: state.samples
  });

  let refreshInFlight = false;

  async function buildSnapshot() {
    const [cpuLoad, memory, temperatureC, probe, rest] = await Promise.all([
      readCpuUsage(),
      readMemoryUsage(),
      readTemperature(),
      probeGameServer({ host: config.gameHost, port: config.gamePort }),
      fetchPalworldRestData({
        baseUrl: config.restBaseUrl,
        username: config.restUsername,
        password: config.restPassword
      })
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
      serverTemperatureC: temperatureC === null ? null : round(temperatureC),
      latency: rest.configured ? restLatency : probe.latencyMs,
      note,
      probeTarget: rest.configured ? config.restBaseUrl : probe.target,
      memoryUsagePercent: round(memory.usagePercent),
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

  async function refreshSnapshot() {
    if (refreshInFlight) {
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

  return {
    state,
    ensureHistoryBackend,
    getHistorySummary,
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
    latency: 0,
    note: 'Waiting for first system sample.',
    probeTarget: config.gameHost && config.gamePort ? `${config.gameHost}:${config.gamePort}` : 'not configured',
    memoryUsagePercent: 0,
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

module.exports = {
  createDashboardRuntime
};

const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createClient } = require('redis');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const MAX_PLAYERS = Number(process.env.PALWORLD_MAX_PLAYERS || 32);
const GAME_HOST = process.env.PALWORLD_HOST || process.env.GAME_HOST || '';
const GAME_PORT = Number(process.env.PALWORLD_PORT || process.env.GAME_PORT || 0);
const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_HISTORY_KEY = process.env.REDIS_HISTORY_KEY || 'palworld:history';
const HISTORY_RETENTION_DAYS = Number(process.env.HISTORY_RETENTION_DAYS || 30);
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS || 5000);
const HISTORY_DEFAULT_LIMIT = 24;
const HISTORY_MAX_LIMIT = 90;
const startedAt = Date.now();

const app = express();
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

const state = {
  startedAt,
  lastUpdatedAt: startedAt,
  snapshot: createEmptySnapshot(),
  samples: []
};

let refreshInFlight = false;
let previousCpuSample = null;
let previousOsCpuSample = null;
let redisClient = null;
let redisConnectPromise = null;

app.get('/api/snapshot', (_req, res) => {
  res.json(state.snapshot);
});

app.get('/api/history', async (req, res) => {
  const bucket = normalizeBucket(req.query.bucket);
  const limit = normalizeLimit(req.query.limit, bucket);
  const summary = await getHistorySummary(bucket, limit);
  res.json(summary);
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function createEmptySnapshot() {
  return {
    id: 'snapshot-0',
    updatedAt: new Date().toISOString(),
    uptimeSeconds: 0,
    wsState: 'connected',
    serviceState: 'offline',
    players: 0,
    maxPlayers: MAX_PLAYERS,
    cpuLoad: 0,
    memoryUsed: 0,
    memoryTotal: 1,
    latency: 0,
    note: 'Waiting for first system sample.',
    probeTarget: GAME_HOST && GAME_PORT ? `${GAME_HOST}:${GAME_PORT}` : 'not configured',
    memoryUsagePercent: 0
  };
}

function normalizeBucket(value) {
  return value === 'day' ? 'day' : 'hour';
}

function normalizeLimit(value, bucket) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value || '', 10);
  const maxLimit = bucket === 'day' ? 30 : HISTORY_MAX_LIMIT;
  const fallback = bucket === 'day' ? 30 : HISTORY_DEFAULT_LIMIT;

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, maxLimit);
}

async function getRedisClient() {
  if (!REDIS_URL) {
    return null;
  }

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', (error) => {
    console.error(`Redis error: ${error.message}`);
  });

  redisConnectPromise = redisClient
    .connect()
    .then(() => redisClient)
    .catch((error) => {
      console.error(`Redis connect failed: ${error.message}`);
      redisClient = null;
      return null;
    })
    .finally(() => {
      redisConnectPromise = null;
    });

  return redisConnectPromise;
}

async function persistSnapshot(snapshot) {
  state.samples.push(snapshot);

  const maxSamples = Math.max(60, Math.floor((HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000) / REFRESH_INTERVAL_MS));
  if (state.samples.length > maxSamples) {
    state.samples.splice(0, state.samples.length - maxSamples);
  }

  const client = await getRedisClient();
  if (!client) {
    return;
  }

  const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify(snapshot);

  await client.zAdd(REDIS_HISTORY_KEY, [
    {
      score: Date.parse(snapshot.updatedAt),
      value: payload
    }
  ]);

  await client.zRemRangeByScore(REDIS_HISTORY_KEY, 0, cutoff - 1);
}

async function loadRawHistory(since) {
  const client = await getRedisClient();
  if (client) {
    const entries = await client.zRangeByScore(REDIS_HISTORY_KEY, since, '+inf');
    if (entries.length > 0) {
      return entries
        .map((entry) => {
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  }

  return state.samples.filter((sample) => Date.parse(sample.updatedAt) >= since);
}

async function getHistorySummary(bucket, limit) {
  const bucketMs = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const now = Date.now();
  const since = now - bucketMs * limit;
  const rawSamples = await loadRawHistory(since);
  const groups = new Map();

  for (const sample of rawSamples) {
    const timestamp = Date.parse(sample.updatedAt);
    if (Number.isNaN(timestamp) || timestamp < since) {
      continue;
    }

    const bucketStart = Math.floor(timestamp / bucketMs) * bucketMs;
    const existing = groups.get(bucketStart) || createHistoryGroup(bucketStart, bucket);
    addSampleToGroup(existing, sample);
    groups.set(bucketStart, existing);
  }

  const points = Array.from(groups.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)
    .map(finalizeHistoryGroup);

  return {
    bucket,
    limit,
    source: REDIS_URL ? 'redis-or-memory' : 'memory',
    points
  };
}

function createHistoryGroup(timestamp, bucket) {
  return {
    timestamp,
    bucket,
    count: 0,
    cpuLoadSum: 0,
    memoryUsagePercentSum: 0,
    playersSum: 0,
    latencySum: 0,
    serviceState: 'online',
    maxPlayers: MAX_PLAYERS
  };
}

function addSampleToGroup(group, sample) {
  group.count += 1;
  group.cpuLoadSum += Number(sample.cpuLoad || 0);
  group.memoryUsagePercentSum += Number(sample.memoryUsagePercent || 0);
  group.playersSum += Number(sample.players || 0);
  group.latencySum += Number(sample.latency || 0);
  group.maxPlayers = Number(sample.maxPlayers || group.maxPlayers);
  group.serviceState = mergeServiceState(group.serviceState, sample.serviceState);
}

function mergeServiceState(current, next) {
  const rank = { offline: 0, degraded: 1, online: 2 };
  return rank[next] < rank[current] ? next : current;
}

function finalizeHistoryGroup(group) {
  const date = new Date(group.timestamp);
  const label =
    group.bucket === 'day'
      ? new Intl.DateTimeFormat('es-CL', {
          month: 'short',
          day: '2-digit'
        }).format(date)
      : new Intl.DateTimeFormat('es-CL', {
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);

  return {
    timestamp: group.timestamp,
    label,
    count: group.count,
    cpuLoad: round(group.cpuLoadSum / group.count),
    memoryUsagePercent: round(group.memoryUsagePercentSum / group.count),
    players: round(group.playersSum / group.count),
    latency: round(group.latencySum / group.count),
    serviceState: group.serviceState,
    maxPlayers: group.maxPlayers
  };
}

async function readCpuUsage() {
  try {
    const firstSample = await readProcStat();

    if (!previousCpuSample) {
      previousCpuSample = firstSample;
      await sleep(120);
    }

    const secondSample = await readProcStat();
    const baseline = previousCpuSample || firstSample;
    previousCpuSample = secondSample;

    const totalDelta = secondSample.total - baseline.total;
    const idleDelta = secondSample.idle - baseline.idle;

    if (totalDelta <= 0) {
      return 0;
    }

    const usage = (1 - idleDelta / totalDelta) * 100;
    return clamp(usage, 0, 100);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }

    return readCpuUsageFromOs();
  }
}

async function readProcStat() {
  const content = await fs.readFile('/proc/stat', 'utf8');
  const cpuLine = content.split('\n').find((line) => line.startsWith('cpu '));

  if (!cpuLine) {
    return { total: 0, idle: 0 };
  }

  const parts = cpuLine
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((value) => Number(value));

  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((sum, value) => sum + value, 0);

  return { total, idle };
}

async function readMemoryUsage() {
  try {
    const content = await fs.readFile('/proc/meminfo', 'utf8');
    const entries = Object.fromEntries(
      content
        .trim()
        .split('\n')
        .map((line) => {
          const [key, rawValue] = line.split(':');
          const value = Number.parseInt(rawValue.trim(), 10);
          return [key, Number.isNaN(value) ? 0 : value];
        })
    );

    const totalKb = entries.MemTotal || 0;
    const availableKb = entries.MemAvailable || 0;
    const usedKb = Math.max(totalKb - availableKb, 0);

    return {
      totalGb: totalKb / 1024 / 1024,
      usedGb: usedKb / 1024 / 1024,
      usagePercent: totalKb > 0 ? (usedKb / totalKb) * 100 : 0
    };
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }

    return readMemoryUsageFromOs();
  }
}

function probeGameServer() {
  if (!GAME_HOST || !GAME_PORT) {
    return Promise.resolve({
      configured: false,
      connected: false,
      latencyMs: 0,
      target: 'not configured'
    });
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host: GAME_HOST, port: GAME_PORT });
    let settled = false;

    const finalize = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1200);

    socket.on('connect', () => {
      finalize({
        configured: true,
        connected: true,
        latencyMs: Date.now() - started,
        target: `${GAME_HOST}:${GAME_PORT}`
      });
    });

    socket.on('timeout', () => {
      finalize({
        configured: true,
        connected: false,
        latencyMs: 0,
        target: `${GAME_HOST}:${GAME_PORT}`
      });
    });

    socket.on('error', () => {
      finalize({
        configured: true,
        connected: false,
        latencyMs: 0,
        target: `${GAME_HOST}:${GAME_PORT}`
      });
    });
  });
}

async function readCpuUsageFromOs() {
  const firstSample = sampleOsCpu();

  if (!previousOsCpuSample) {
    previousOsCpuSample = firstSample;
    await sleep(120);
  }

  const secondSample = sampleOsCpu();
  const baseline = previousOsCpuSample || firstSample;
  previousOsCpuSample = secondSample;

  const totalDelta = secondSample.total - baseline.total;
  const idleDelta = secondSample.idle - baseline.idle;

  if (totalDelta <= 0) {
    return 0;
  }

  const usage = (1 - idleDelta / totalDelta) * 100;
  return clamp(usage, 0, 100);
}

function sampleOsCpu() {
  const cpus = os.cpus();
  let total = 0;
  let idle = 0;

  for (const cpu of cpus) {
    const times = cpu.times;
    const cpuIdle = times.idle || 0;
    const cpuTotal =
      (times.user || 0) +
      (times.nice || 0) +
      (times.sys || 0) +
      (times.irq || 0) +
      (times.idle || 0) +
      (times.steal || 0) +
      (times.unknown || 0);

    idle += cpuIdle;
    total += cpuTotal;
  }

  return { total, idle };
}

function readMemoryUsageFromOs() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(totalBytes - freeBytes, 0);

  return {
    totalGb: totalBytes / 1024 / 1024 / 1024,
    usedGb: usedBytes / 1024 / 1024 / 1024,
    usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
  };
}

async function buildSnapshot() {
  const [cpuLoad, memory, probe] = await Promise.all([
    readCpuUsage(),
    readMemoryUsage(),
    probeGameServer()
  ]);

  const serviceState = probe.configured
    ? probe.connected
      ? cpuLoad >= 80 || memory.usagePercent >= 85
        ? 'degraded'
        : 'online'
      : 'offline'
    : cpuLoad >= 80 || memory.usagePercent >= 85
      ? 'degraded'
      : 'online';

  const note = probe.configured
    ? probe.connected
      ? `Host metrics from /proc. Game probe OK for ${probe.target}.`
      : `Host metrics from /proc. Game probe failed for ${probe.target}.`
    : 'Host metrics from /proc. Set PALWORLD_HOST and PALWORLD_PORT to probe the game server.';

  return {
    id: `snapshot-${Math.floor(Date.now() / REFRESH_INTERVAL_MS)}`,
    updatedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
    wsState: 'connected',
    serviceState,
    players: 0,
    maxPlayers: MAX_PLAYERS,
    cpuLoad: round(cpuLoad),
    memoryUsed: round(memory.usedGb),
    memoryTotal: round(memory.totalGb),
    latency: probe.latencyMs,
    note,
    probeTarget: probe.target,
    memoryUsagePercent: round(memory.usagePercent)
  };
}

async function refreshSnapshot() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;

  try {
    state.snapshot = await buildSnapshot();
    state.lastUpdatedAt = Date.now();
    await persistSnapshot(state.snapshot);

    const payload = JSON.stringify({
      type: 'snapshot',
      data: state.snapshot
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  } catch (error) {
    console.error(`Refresh failed: ${error.message}`);
  } finally {
    refreshInFlight = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', data: state.snapshot }));
});

void refreshSnapshot();
void getRedisClient();
setInterval(() => {
  void refreshSnapshot();
}, REFRESH_INTERVAL_MS);

server.listen(PORT, HOSTNAME, () => {
  console.log(`palworld-dashboard listening on http://${HOSTNAME}:${PORT}`);
});

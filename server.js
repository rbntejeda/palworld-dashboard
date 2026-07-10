const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const MAX_PLAYERS = Number(process.env.PALWORLD_MAX_PLAYERS || 32);
const GAME_HOST = process.env.PALWORLD_HOST || process.env.GAME_HOST || '';
const GAME_PORT = Number(process.env.PALWORLD_PORT || process.env.GAME_PORT || 0);
const startedAt = Date.now();
const refreshIntervalMs = Number(process.env.REFRESH_INTERVAL_MS || 5000);

const app = express();
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));

const state = {
  startedAt,
  lastUpdatedAt: startedAt,
  snapshot: createEmptySnapshot()
};

app.get('/api/snapshot', (_req, res) => {
  res.json(state.snapshot);
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

let refreshInFlight = false;
let previousCpuSample = null;
let previousOsCpuSample = null;

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
    probeTarget: GAME_HOST && GAME_PORT ? `${GAME_HOST}:${GAME_PORT}` : 'not configured'
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
    id: `snapshot-${Math.floor(Date.now() / refreshIntervalMs)}`,
    updatedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
    wsState: 'connected',
    serviceState,
    players: 0,
    maxPlayers: MAX_PLAYERS,
    cpuLoad: Math.round(cpuLoad * 10) / 10,
    memoryUsed: Math.round(memory.usedGb * 100) / 100,
    memoryTotal: Math.round(memory.totalGb * 100) / 100,
    latency: probe.latencyMs,
    note,
    probeTarget: probe.target,
    memoryUsagePercent: Math.round(memory.usagePercent * 10) / 10
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

    const payload = JSON.stringify({
      type: 'snapshot',
      data: state.snapshot
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
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

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', data: state.snapshot }));
});

void refreshSnapshot();
setInterval(() => {
  void refreshSnapshot();
}, refreshIntervalMs);

server.listen(PORT, HOSTNAME, () => {
  console.log(`palworld-dashboard listening on http://${HOSTNAME}:${PORT}`);
});

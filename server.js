const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const startedAt = Date.now();

const app = express();
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));

const state = {
  startedAt,
  lastUpdatedAt: startedAt,
  index: 0,
  snapshot: buildSnapshot(0)
};

app.get('/api/snapshot', (_req, res) => {
  res.json(state.snapshot);
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function buildSnapshot(index) {
  const scenarios = [
    {
      serviceState: 'online',
      players: 7,
      maxPlayers: 32,
      cpuLoad: 24,
      memoryUsed: 4.1,
      memoryTotal: 8,
      latency: 22,
      note: 'Mundo tranquilo. El host está fresco y el juego responde rápido.'
    },
    {
      serviceState: 'online',
      players: 13,
      maxPlayers: 32,
      cpuLoad: 43,
      memoryUsed: 5.3,
      memoryTotal: 8,
      latency: 31,
      note: 'Aumenta la actividad. Conviene vigilar memoria y red.'
    },
    {
      serviceState: 'degraded',
      players: 20,
      maxPlayers: 32,
      cpuLoad: 71,
      memoryUsed: 6.7,
      memoryTotal: 8,
      latency: 54,
      note: 'Pico de carga. El dashboard marca degradación preventiva.'
    },
    {
      serviceState: 'online',
      players: 11,
      maxPlayers: 32,
      cpuLoad: 36,
      memoryUsed: 5.6,
      memoryTotal: 8,
      latency: 27,
      note: 'El servidor se normaliza y vuelve a respirar mejor.'
    },
    {
      serviceState: 'offline',
      players: 0,
      maxPlayers: 32,
      cpuLoad: 4,
      memoryUsed: 3.8,
      memoryTotal: 8,
      latency: 0,
      note: 'Mantenimiento o reinicio controlado del servicio.'
    }
  ];

  const scenario = scenarios[index];

  return {
    id: `snapshot-${index + 1}`,
    updatedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    wsState: 'connected',
    ...scenario
  };
}

function publishSnapshot() {
  state.index = (state.index + 1) % 5;
  state.lastUpdatedAt = Date.now();
  state.snapshot = buildSnapshot(state.index);

  const payload = JSON.stringify({
    type: 'snapshot',
    data: state.snapshot
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', data: state.snapshot }));
});

setInterval(publishSnapshot, 5000);

server.listen(PORT, HOSTNAME, () => {
  console.log(`palworld-dashboard listening on http://${HOSTNAME}:${PORT}`);
});

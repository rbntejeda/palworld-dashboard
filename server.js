const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { loadConfig } = require('./src/config');
const { createDashboardRuntime } = require('./src/application/dashboardRuntime');
const { normalizeBucket, normalizeLimit } = require('./src/domain/history');
const { searchPaldexCatalog } = require('./src/infrastructure/paldexCatalog');

const config = loadConfig();
const runtime = createDashboardRuntime(config);
const app = express();
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));

app.get('/api/snapshot', (_req, res) => {
  res.json(runtime.state.snapshot);
});

app.get('/api/history', async (req, res) => {
  const bucket = normalizeBucket(req.query.bucket);
  const limit = normalizeLimit(req.query.limit, bucket);
  const summary = await runtime.getHistorySummary(bucket, limit);
  res.json(summary);
});

app.get('/api/paldex/search', async (req, res) => {
  const result = await searchPaldexCatalog({
    section: 'pals',
    query: req.query,
    apiBaseUrl: config.paldexApiUrl,
    assetBaseUrl: config.paldexAssetBaseUrl,
    dataBaseUrl: config.paldexDataBaseUrl,
    timeoutMs: config.paldexApiTimeoutMs
  });

  res.status(result.ok || !result.configured ? 200 : 502).json(result);
});

app.get('/api/paldex/catalog', async (req, res) => {
  const result = await searchPaldexCatalog({
    section: req.query.section || 'pals',
    query: req.query,
    apiBaseUrl: config.paldexApiUrl,
    assetBaseUrl: config.paldexAssetBaseUrl,
    dataBaseUrl: config.paldexDataBaseUrl,
    timeoutMs: config.paldexApiTimeoutMs
  });

  res.status(result.ok || !result.configured ? 200 : 502).json(result);
});

app.get('/api/paldex/:section/search', async (req, res) => {
  const result = await searchPaldexCatalog({
    section: req.params.section,
    query: req.query,
    apiBaseUrl: config.paldexApiUrl,
    assetBaseUrl: config.paldexAssetBaseUrl,
    dataBaseUrl: config.paldexDataBaseUrl,
    timeoutMs: config.paldexApiTimeoutMs
  });

  res.status(result.ok || !result.configured ? 200 : 502).json(result);
});

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.floor((Date.now() - runtime.state.startedAt) / 1000)
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastSnapshot(snapshot) {
  const payload = JSON.stringify({
    type: 'snapshot',
    data: snapshot
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', data: runtime.state.snapshot }));
});

async function refreshAndBroadcast() {
  const snapshot = await runtime.refreshSnapshot();
  broadcastSnapshot(snapshot);
}

setInterval(() => {
  void refreshAndBroadcast();
}, config.refreshIntervalMs);

async function start() {
  await runtime.ensureHistoryBackend();
  await refreshAndBroadcast();

  server.listen(config.port, config.hostname, () => {
    console.log(`palworld-dashboard listening on http://${config.hostname}:${config.port}`);
  });
}

void start().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});

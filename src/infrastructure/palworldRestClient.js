const { normalizePlayer } = require('../domain/player');

async function fetchPalworldRestData({ baseUrl, username, password }) {
  if (!baseUrl) {
    return {
      configured: false,
      baseUrl: 'not configured',
      ok: false,
      errors: [],
      serverInfo: null,
      players: [],
      metrics: null,
      latencyMs: 0
    };
  }

  const headers = {};
  if (username || password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  const started = Date.now();
  const [infoResult, playersResult, metricsResult] = await Promise.all([
    fetchPalworldJson(baseUrl, '/info', headers),
    fetchPalworldJson(baseUrl, '/players', headers),
    fetchPalworldJson(baseUrl, '/metrics', headers)
  ].map((promise) => promise.catch((error) => ({ error }))));

  const errors = [];
  const serverInfo = normalizeFetchResult(infoResult, errors);
  const playersPayload = normalizeFetchResult(playersResult, errors);
  const metrics = normalizeFetchResult(metricsResult, errors);

  return {
    configured: true,
    baseUrl,
    ok: errors.length === 0,
    errors,
    serverInfo,
    players: Array.isArray(playersPayload?.players) ? playersPayload.players.map(normalizePlayer) : [],
    metrics,
    latencyMs: Date.now() - started
  };
}

async function fetchPalworldJson(baseUrl, pathname, headers) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers,
    signal: AbortSignal.timeout(2500)
  });

  if (!response.ok) {
    throw new Error(`${pathname} -> ${response.status}`);
  }

  return response.json();
}

function normalizeFetchResult(result, errors) {
  if (result && result.error) {
    errors.push(result.error.message || String(result.error));
    return null;
  }

  return result;
}

module.exports = {
  fetchPalworldRestData
};

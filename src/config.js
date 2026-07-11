function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadConfig() {
  return {
    port: parseNumber(process.env.PORT || 3000, 3000),
    hostname: process.env.HOSTNAME || '0.0.0.0',
    maxPlayers: parseNumber(process.env.PALWORLD_MAX_PLAYERS || 32, 32),
    gameHost: process.env.PALWORLD_HOST || process.env.GAME_HOST || '',
    gamePort: parseNumber(process.env.PALWORLD_PORT || process.env.GAME_PORT || 0, 0),
    restBaseUrl: (process.env.PALWORLD_REST_URL || process.env.PALWORLD_API_URL || '').replace(/\/$/, ''),
    restUsername: process.env.PALWORLD_REST_USER || process.env.PALWORLD_REST_USERNAME || '',
    restPassword: process.env.PALWORLD_REST_PASSWORD || process.env.PALWORLD_REST_PASS || '',
    redisUrl: process.env.REDIS_URL || '',
    redisHistoryKey: process.env.REDIS_HISTORY_KEY || 'palworld:history',
    historyRetentionDays: parseNumber(process.env.HISTORY_RETENTION_DAYS || 30, 30),
    refreshIntervalMs: parseNumber(process.env.REFRESH_INTERVAL_MS || 5000, 5000)
  };
}

module.exports = {
  loadConfig
};

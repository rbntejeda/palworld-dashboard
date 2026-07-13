function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseCoordinate(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadConfig() {
  const mapBounds = {
    xMin: parseCoordinate(process.env.PALWORLD_MAP_X_MIN, -500000),
    xMax: parseCoordinate(process.env.PALWORLD_MAP_X_MAX, 500000),
    yMin: parseCoordinate(process.env.PALWORLD_MAP_Y_MIN, -500000),
    yMax: parseCoordinate(process.env.PALWORLD_MAP_Y_MAX, 500000)
  };

  const mapTransform = (process.env.PALWORLD_MAP_TRANSFORM || 'reference').trim().toLowerCase();
  const normalizedMapTransform = mapTransform === 'bounds' ? 'bounds' : 'reference';

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
    refreshIntervalMs: parseNumber(process.env.REFRESH_INTERVAL_MS || 5000, 5000),
    mapImageUrl: process.env.PALWORLD_MAP_IMAGE || '/map.jpg',
    mapCaption: process.env.PALWORLD_MAP_CAPTION || 'Mapa del mundo de Palworld',
    mapInvertY: parseBoolean(process.env.PALWORLD_MAP_INVERT_Y, true),
    mapBounds,
    mapTransform: normalizedMapTransform
  };
}

module.exports = {
  loadConfig
};

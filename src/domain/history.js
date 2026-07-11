function normalizeBucket(value) {
  return value === 'day' ? 'day' : 'hour';
}

function normalizeLimit(value, bucket) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value || '', 10);
  const maxLimit = bucket === 'day' ? 30 : 90;
  const fallback = bucket === 'day' ? 30 : 24;

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, maxLimit);
}

function createHistoryGroup(timestamp, bucket, maxPlayers) {
  return {
    timestamp,
    bucket,
    count: 0,
    cpuLoadSum: 0,
    memoryUsagePercentSum: 0,
    playersSum: 0,
    latencySum: 0,
    serverFpsSum: 0,
    serverFrameTimeSum: 0,
    baseCampNumSum: 0,
    daysSum: 0,
    currentPlayerNumSum: 0,
    serviceState: 'online',
    maxPlayers,
    serverName: '',
    worldGuid: '',
    description: ''
  };
}

function mergeServiceState(current, next) {
  const rank = { offline: 0, degraded: 1, online: 2 };
  return rank[next] < rank[current] ? next : current;
}

function addSampleToGroup(group, sample, maxPlayers) {
  group.count += 1;
  group.cpuLoadSum += Number(sample.cpuLoad || 0);
  group.memoryUsagePercentSum += Number(sample.memoryUsagePercent || 0);
  group.playersSum += Number(sample.players || 0);
  group.latencySum += Number(sample.latency || 0);
  group.maxPlayers = Number(sample.maxPlayers || maxPlayers || group.maxPlayers);
  group.serviceState = mergeServiceState(group.serviceState, sample.serviceState);
  group.serverFpsSum += Number(sample.rest?.metrics?.serverfps || 0);
  group.serverFrameTimeSum += Number(sample.rest?.metrics?.serverframetime || 0);
  group.baseCampNumSum += Number(sample.rest?.metrics?.basecampnum || 0);
  group.daysSum += Number(sample.rest?.metrics?.days || 0);
  group.currentPlayerNumSum += Number(sample.rest?.metrics?.currentplayernum || sample.players || 0);
  group.serverName = sample.rest?.serverInfo?.servername || group.serverName;
  group.worldGuid = sample.rest?.serverInfo?.worldguid || group.worldGuid;
  group.description = sample.rest?.serverInfo?.description || group.description;
}

function round(value) {
  return Math.round(value * 10) / 10;
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
    serverFps: round(group.serverFpsSum / group.count),
    serverFrameTime: round(group.serverFrameTimeSum / group.count),
    baseCampNum: round(group.baseCampNumSum / group.count),
    days: round(group.daysSum / group.count),
    currentPlayerNum: round(group.currentPlayerNumSum / group.count),
    serviceState: group.serviceState,
    maxPlayers: group.maxPlayers,
    serverName: group.serverName,
    worldGuid: group.worldGuid,
    description: group.description
  };
}

function summarizeHistory(samples, bucket, limit, maxPlayers) {
  const bucketMs = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const now = Date.now();
  const since = now - bucketMs * limit;
  const groups = new Map();

  for (const sample of samples) {
    const timestamp = Date.parse(sample.updatedAt);

    if (Number.isNaN(timestamp) || timestamp < since) {
      continue;
    }

    const bucketStart = Math.floor(timestamp / bucketMs) * bucketMs;
    const existing = groups.get(bucketStart) || createHistoryGroup(bucketStart, bucket, maxPlayers);
    addSampleToGroup(existing, sample, maxPlayers);
    groups.set(bucketStart, existing);
  }

  return Array.from(groups.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)
    .map(finalizeHistoryGroup);
}

module.exports = {
  addSampleToGroup,
  createHistoryGroup,
  finalizeHistoryGroup,
  mergeServiceState,
  normalizeBucket,
  normalizeLimit,
  summarizeHistory
};

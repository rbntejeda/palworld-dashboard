const { createClient } = require('redis');

function createHistoryStore({ redisUrl, redisHistoryKey, historyRetentionDays, refreshIntervalMs, samples }) {
  let redisClient = null;
  let redisConnectPromise = null;

  async function getRedisClient() {
    if (!redisUrl) {
      return null;
    }

    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }

    if (redisConnectPromise) {
      return redisConnectPromise;
    }

    redisClient = createClient({ url: redisUrl });
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
    samples.push(snapshot);

    const maxSamples = Math.max(60, Math.floor((historyRetentionDays * 24 * 60 * 60 * 1000) / refreshIntervalMs));
    if (samples.length > maxSamples) {
      samples.splice(0, samples.length - maxSamples);
    }

    const client = await getRedisClient();
    if (!client) {
      return;
    }

    const cutoff = Date.now() - historyRetentionDays * 24 * 60 * 60 * 1000;
    const payload = JSON.stringify(snapshot);

    await client.zAdd(redisHistoryKey, [
      {
        score: Date.parse(snapshot.updatedAt),
        value: payload
      }
    ]);

    await client.zRemRangeByScore(redisHistoryKey, 0, cutoff - 1);
  }

  async function loadRawHistory(since) {
    const client = await getRedisClient();
    if (client) {
      const entries = await client.zRangeByScore(redisHistoryKey, since, '+inf');
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

    return samples.filter((sample) => Date.parse(sample.updatedAt) >= since);
  }

  async function ensureHistoryBackend() {
    await getRedisClient();
  }

  function getSource() {
    return redisUrl ? 'redis-or-memory' : 'memory';
  }

  return {
    ensureHistoryBackend,
    getSource,
    loadRawHistory,
    persistSnapshot
  };
}

module.exports = {
  createHistoryStore
};

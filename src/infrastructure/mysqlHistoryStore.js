const { PrismaClient } = require('@prisma/client');
const { runPrismaMigrations } = require('./prismaMigrations');

function createMysqlHistoryStore({ databaseUrl }) {
  let prisma = null;
  let connectPromise = null;
  let readinessPromise = null;

  async function getPrismaClient() {
    if (!databaseUrl) {
      return null;
    }

    if (prisma) {
      return prisma;
    }

    if (connectPromise) {
      return connectPromise;
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    });

    connectPromise = prisma
      .$connect()
      .then(() => prisma)
      .catch((error) => {
        console.error(`Prisma connect failed: ${error.message}`);
        prisma = null;
        return null;
      })
      .finally(() => {
        connectPromise = null;
      });

    return connectPromise;
  }

  async function ensureHistoryBackend() {
    if (!databaseUrl) {
      return false;
    }

    if (!readinessPromise) {
      readinessPromise = (async () => {
        await runPrismaMigrations(databaseUrl);
        return Boolean(await getPrismaClient());
      })()
        .catch((error) => {
          console.error(`Prisma migrations failed: ${error.message}`);
          return false;
        })
        .finally(() => {
          readinessPromise = null;
        });
    }

    return readinessPromise;
  }

  async function persistSnapshot(snapshot) {
    const client = await getPrismaClient();
    if (!client) {
      return;
    }

    await client.snapshot.create({
      data: mapSnapshotToRecord(snapshot)
    });
  }

  async function loadRawHistory(since) {
    const client = await getPrismaClient();
    if (!client) {
      return [];
    }

    const rows = await client.snapshot.findMany({
      where: {
        snapshotAt: {
          gte: new Date(since)
        }
      },
      orderBy: {
        snapshotAt: 'asc'
      }
    });

    return rows.map(mapRecordToSnapshot);
  }

  async function close() {
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
    }
  }

  function getSource() {
    return 'mysql';
  }

  return {
    close,
    ensureHistoryBackend,
    getSource,
    loadRawHistory,
    persistSnapshot
  };
}

function mapSnapshotToRecord(snapshot) {
  return {
    id: snapshot.id,
    snapshotAt: new Date(snapshot.updatedAt),
    uptimeSeconds: snapshot.uptimeSeconds,
    wsState: snapshot.wsState,
    serviceState: snapshot.serviceState,
    players: snapshot.players,
    maxPlayers: snapshot.maxPlayers,
    cpuLoad: snapshot.cpuLoad,
    memoryUsed: snapshot.memoryUsed,
    memoryTotal: snapshot.memoryTotal,
    memoryUsagePercent: snapshot.memoryUsagePercent,
    serverTemperatureC: snapshot.serverTemperatureC,
    serverTemperatureSource: snapshot.serverTemperatureSource,
    latency: snapshot.latency,
    note: snapshot.note,
    probeTarget: snapshot.probeTarget,
    map: snapshot.map,
    rest: snapshot.rest
  };
}

function mapRecordToSnapshot(record) {
  return {
    id: record.id,
    updatedAt: record.snapshotAt.toISOString(),
    uptimeSeconds: record.uptimeSeconds,
    wsState: record.wsState,
    serviceState: record.serviceState,
    players: record.players,
    maxPlayers: record.maxPlayers,
    cpuLoad: record.cpuLoad,
    memoryUsed: record.memoryUsed,
    memoryTotal: record.memoryTotal,
    memoryUsagePercent: record.memoryUsagePercent,
    serverTemperatureC: record.serverTemperatureC,
    serverTemperatureSource: record.serverTemperatureSource,
    latency: record.latency,
    note: record.note,
    probeTarget: record.probeTarget,
    map: record.map,
    rest: record.rest
  };
}

module.exports = {
  createMysqlHistoryStore
};

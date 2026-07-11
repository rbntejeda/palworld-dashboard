const fs = require('node:fs/promises');
const os = require('node:os');

let previousCpuSample = null;
let previousOsCpuSample = null;

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

    return clamp((1 - idleDelta / totalDelta) * 100, 0, 100);
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

  return clamp((1 - idleDelta / totalDelta) * 100, 0, 100);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  readCpuUsage,
  readMemoryUsage,
  readCpuUsageFromOs,
  readMemoryUsageFromOs
};

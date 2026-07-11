const net = require('node:net');

function probeGameServer({ host, port }) {
  if (!host || !port) {
    return Promise.resolve({
      configured: false,
      connected: false,
      latencyMs: 0,
      target: 'not configured'
    });
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port });
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
        target: `${host}:${port}`
      });
    });

    socket.on('timeout', () => {
      finalize({
        configured: true,
        connected: false,
        latencyMs: 0,
        target: `${host}:${port}`
      });
    });

    socket.on('error', () => {
      finalize({
        configured: true,
        connected: false,
        latencyMs: 0,
        target: `${host}:${port}`
      });
    });
  });
}

module.exports = {
  probeGameServer
};

const http = require('node:http');

function createDockerContainerService(config) {
  const containerName = String(config.serverContainerName || '').trim();
  const socketPath = config.dockerSocketPath || '/var/run/docker.sock';

  async function inspect() {
    if (!containerName) {
      return createUnconfiguredStatus();
    }

    try {
      const payload = await dockerRequest({
        socketPath,
        method: 'GET',
        path: `/containers/${encodeURIComponent(containerName)}/json`,
        expectJson: true
      });

      const state = payload.State || {};
      const running = Boolean(state.Running);
      const status = running ? 'running' : 'stopped';
      const startedAt = parseDockerDate(state.StartedAt);
      const finishedAt = parseDockerDate(state.FinishedAt);

      return {
        configured: true,
        containerName,
        status,
        running,
        available: running,
        canStart: !running,
        canRestart: running,
        canStop: running,
        state: state.Status || status,
        startedAt,
        finishedAt,
        error: '',
        description: running
          ? `Contenedor ${containerName} en ejecución. Puedes reiniciarlo o detenerlo manualmente.`
          : `Contenedor ${containerName} detenido. Puedes iniciar el servicio desde el dashboard.`
      };
    } catch (error) {
      const notFound = error.statusCode === 404;
      return {
        configured: true,
        containerName,
        status: notFound ? 'missing' : 'unknown',
        running: false,
        available: false,
        canStart: false,
        canRestart: false,
        canStop: false,
        state: notFound ? 'not_found' : 'error',
        startedAt: null,
        finishedAt: null,
        error: error.message,
        description: notFound
          ? `No encontré el contenedor ${containerName}. Revisa CONTAINER_NAME.`
          : `No pude consultar Docker: ${error.message}`
      };
    }
  }

  async function runAction(action) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (!['start', 'restart', 'stop'].includes(normalizedAction)) {
      return {
        ok: false,
        action: normalizedAction,
        message: 'Acción no soportada.'
      };
    }

    if (!containerName) {
      return {
        ok: false,
        action: normalizedAction,
        message: 'CONTAINER_NAME no está configurado.'
      };
    }

    try {
      await dockerRequest({
        socketPath,
        method: 'POST',
        path: `/containers/${encodeURIComponent(containerName)}/${normalizedAction}`
      });

      return {
        ok: true,
        action: normalizedAction,
        message: dockerActionMessage(normalizedAction, containerName)
      };
    } catch (error) {
      return {
        ok: false,
        action: normalizedAction,
        message: error.message
      };
    }
  }

  return {
    inspect,
    runAction
  };
}

function dockerRequest({ socketPath, method, path, expectJson = false }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        method,
        path
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');

          if (response.statusCode >= 400) {
            const error = new Error(parseDockerError(body) || `Docker respondió HTTP ${response.statusCode}`);
            error.statusCode = response.statusCode;
            reject(error);
            return;
          }

          if (!expectJson) {
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(body || '{}'));
          } catch (error) {
            reject(new Error(`Docker devolvió JSON inválido: ${error.message}`));
          }
        });
      }
    );

    request.on('error', (error) => {
      reject(new Error(`Docker socket ${socketPath}: ${error.message}`));
    });

    request.end();
  });
}

function parseDockerError(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed.message || '';
  } catch (_error) {
    return body;
  }
}

function parseDockerDate(value) {
  const text = String(value || '').trim();
  if (!text || text.startsWith('0001-')) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dockerActionMessage(action, containerName) {
  if (action === 'start') {
    return `Iniciando contenedor ${containerName}.`;
  }

  if (action === 'restart') {
    return `Reiniciando contenedor ${containerName}.`;
  }

  return `Deteniendo contenedor ${containerName}.`;
}

function createUnconfiguredStatus() {
  return {
    configured: false,
    containerName: '',
    status: 'unconfigured',
    running: false,
    available: false,
    canStart: false,
    canRestart: false,
    canStop: false,
    state: 'unconfigured',
    startedAt: null,
    finishedAt: null,
    error: '',
    description: 'Define CONTAINER_NAME para habilitar operaciones Docker.'
  };
}

module.exports = {
  createDockerContainerService
};

# palworld-dashboard

Panel simple para monitorear un servidor Palworld con snapshots cada 5 segundos y actualización por WebSocket.

## Stack

- Node.js
- Express
- `ws`
- HTML, CSS y JavaScript

## Arquitectura

El backend está separado por contexto:

- `src/application`: orquestación y casos de uso
- `src/domain`: reglas y modelos puros
- `src/infrastructure`: Redis, REST API de Palworld, probe de red y métricas del host
- `public/`: UI estática

La idea es mantener el dashboard como un monolito modular, no como un archivo gigante.

## Desarrollo local

```bash
npm install
npm start
```

Luego abre `http://localhost:3000`.

## Docker

```bash
docker build -t palworld-dashboard .
docker run --rm -p 3000:3000 palworld-dashboard
```

## API

- `GET /api/snapshot`
- `GET /api/history?bucket=hour|day&limit=24`
- `GET /healthz`
- `WS /ws`

## Palworld REST API

Si quieres leer el mundo y los jugadores desde la API oficial, configura:

- `PALWORLD_REST_URL`
- `PALWORLD_REST_USER`
- `PALWORLD_REST_PASSWORD`

Ejemplo:

```bash
PALWORLD_REST_URL=http://palworld-server:8212
PALWORLD_REST_USER=usuario
PALWORLD_REST_PASSWORD=clave
```

## Qué hace

- Sirve un dashboard visual.
- Lee CPU y memoria reales desde `/proc`.
- Puede probar el puerto del servidor de Palworld si configuras `PALWORLD_HOST` y `PALWORLD_PORT`.
- Si configuras la REST API de Palworld, muestra nombre del servidor, descripción, world GUID, jugadores conectados y métricas del mundo.
- Mantiene una base lista para conectar pub/sub real y leer métricas del host o del contenedor.

## Variables de entorno

- `PORT`: puerto HTTP del dashboard, por defecto `3000`
- `HOSTNAME`: interfaz de escucha, por defecto `0.0.0.0`
- `PALWORLD_HOST`: host o IP del servidor Palworld
- `PALWORLD_PORT`: puerto del servidor Palworld
- `PALWORLD_MAX_PLAYERS`: capacidad máxima mostrada en el panel, por defecto `32`
- `REFRESH_INTERVAL_MS`: intervalo de refresco, por defecto `5000`
- `PALWORLD_REST_URL`: URL base de la REST API de Palworld
- `PALWORLD_REST_USER`: usuario de la REST API
- `PALWORLD_REST_PASSWORD`: contraseña de la REST API
- `REDIS_URL`: URL opcional para persistir y leer histórico
- `REDIS_HISTORY_KEY`: clave opcional para la serie histórica, por defecto `palworld:history`
- `HISTORY_RETENTION_DAYS`: cuántos días conservar en Redis, por defecto `30`

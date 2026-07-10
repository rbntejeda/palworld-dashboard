# palworld-dashboard

Panel simple para monitorear un servidor Palworld con snapshots cada 5 segundos y actualización por WebSocket.

## Stack

- Node.js
- Express
- `ws`
- HTML, CSS y JavaScript

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
- `GET /healthz`
- `WS /ws`

## Qué hace

- Sirve un dashboard visual.
- Lee CPU y memoria reales desde `/proc`.
- Puede probar el puerto del servidor de Palworld si configuras `PALWORLD_HOST` y `PALWORLD_PORT`.
- Mantiene una base lista para conectar pub/sub real y leer métricas del host o del contenedor.

## Variables de entorno

- `PORT`: puerto HTTP del dashboard, por defecto `3000`
- `HOSTNAME`: interfaz de escucha, por defecto `0.0.0.0`
- `PALWORLD_HOST`: host o IP del servidor Palworld
- `PALWORLD_PORT`: puerto del servidor Palworld
- `PALWORLD_MAX_PLAYERS`: capacidad máxima mostrada en el panel, por defecto `32`
- `REFRESH_INTERVAL_MS`: intervalo de refresco, por defecto `5000`

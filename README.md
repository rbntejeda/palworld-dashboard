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
- Simula un collector que publica métricas cada 5 segundos.
- Mantiene una base lista para conectar pub/sub real y leer métricas del host o del contenedor.

# palworld-dashboard

Panel simple para monitorear un servidor Palworld con snapshots cada 5 segundos y actualización por WebSocket.

## Stack

- Node.js
- Express
- `ws`
- Palworld Paldex API proxy
- HTML, CSS y JavaScript

## Arquitectura

El backend está separado por contexto:

- `src/application`: orquestación y casos de uso
- `src/domain`: reglas y modelos puros
- `src/infrastructure`: MySQL/Prisma, Redis, REST API de Palworld, probe de red y métricas del host
- `public/`: UI estática

La idea es mantener el dashboard como un monolito modular, no como un archivo gigante.

## Desarrollo local

```bash
npm install
npm start
```

Luego abre `http://localhost:3000`.

## Persistencia con MySQL

Si defines `DATABASE_URL`, el dashboard usa Prisma para guardar snapshots en MySQL 8 y ejecuta las migraciones al arrancar.

Ejemplo:

```bash
DATABASE_URL="mysql://usuario:clave@localhost:3306/palworld_dashboard"
```

Con esa variable activa:

- el arranque corre `prisma migrate deploy`
- se conecta el cliente Prisma
- los snapshots se guardan en la tabla `snapshots`

También puedes ejecutar las migraciones manualmente:

```bash
npm run db:migrate
```

## Despliegue automático

Hay un workflow de GitHub Actions en `.github/workflows/deploy-palworld-dashboard.yml` que:

- Se dispara en `push` a `main` cuando cambia este proyecto.
- Entra por SSH y ejecuta `/home/ruben/scripts/deploy-palworld-dashboard.sh`.

Necesitas definir estos secrets en el repositorio:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT` opcional, por defecto `22`

El servidor debe tener:

- El script en `/home/ruben/scripts/deploy-palworld-dashboard.sh`.
- Permisos de ejecución sobre ese script.
- `git`, `npm` y todo lo que use tu script instalados en el servidor.

## Docker

```bash
docker build -t palworld-dashboard .
docker run --rm -p 3000:3000 palworld-dashboard
```

Si quieres que el panel lea temperatura del host dentro de Docker, monta también:

```bash
-v /sys/class/hwmon:/sys/class/hwmon:ro \
-v /sys/class/thermal:/sys/class/thermal:ro
```

## API

- `GET /api/snapshot`
- `GET /api/history?bucket=hour|day&limit=24`
- `GET /api/paldex/catalog?section=pals|items|gear&term=Relaxaurus`
- `GET /api/paldex/search?term=Relaxaurus&limit=12`
- `GET /api/paldex/:section/search`
- `GET /healthz`
- `WS /ws`

## Palworld REST API

Si quieres leer el mundo y los jugadores desde la API oficial, configura:

- `PALWORLD_REST_URL`
- `PALWORLD_REST_USER`
- `PALWORLD_REST_PASSWORD`
- `DATABASE_URL`: cadena de conexión MySQL para Prisma

Ejemplo:

```bash
PALWORLD_REST_URL=http://palworld-server:8212
PALWORLD_REST_USER=usuario
PALWORLD_REST_PASSWORD=clave
```

## Palworld Paldex API

El dashboard también puede consultar el catálogo de Paldex para buscar pals, items y gear, mostrando imágenes e iconos de elementos.

Configura:

- `PALDEX_API_URL`: base URL del API de Paldex para la sección de pals, por ejemplo `http://paldex-api:3000`
- `PALDEX_ASSET_BASE_URL`: base URL para resolver imágenes del catálogo, por defecto usa la URL de la API o el repo público
- `PALDEX_DATA_BASE_URL`: base URL de los JSON públicos del catálogo, por defecto usa el repo de Paldex en GitHub
- `PALDEX_API_TIMEOUT_MS`: timeout en milisegundos para la búsqueda remota, por defecto `8000`

El dashboard no llama al origen directamente desde el navegador: lo hace por backend a través de `GET /api/paldex/catalog` y sus aliases.

El catálogo expone filtros como:

- `term`
- `name`
- `types`
- `suitabilities`
- `drops`
- `key`

El repo incluye assets en:

- `public/images/paldeck`
- `public/images/elements`
- `public/images/items`

## Qué hace

- Sirve un dashboard visual.
- Lee CPU y memoria reales desde `/proc`.
- Puede probar el puerto del servidor de Palworld si configuras `PALWORLD_HOST` y `PALWORLD_PORT`.
- Si configuras la REST API de Palworld, muestra nombre del servidor, descripción, world GUID, jugadores conectados y métricas del mundo.
- Puede dibujar los jugadores sobre un mapa OpenSeadragon con zoom y anotaciones sobre una imagen de alta resolución incluida o con otra que le pases, y ajusta los bounds del mundo por variables.
- Puede buscar pals, items y gear desde el catálogo de Paldex y mostrar cards con imagen, tipos e iconos elementales.
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
- `PALDEX_API_URL`: URL base del API de Palworld Paldex
- `PALDEX_ASSET_BASE_URL`: base URL para resolver imágenes del catálogo de Paldex
- `PALDEX_DATA_BASE_URL`: base URL de los JSON del catálogo de Paldex
- `PALDEX_API_TIMEOUT_MS`: timeout en milisegundos para consultas al Paldex API, por defecto `8000`
- `DATABASE_URL`: cadena de conexión MySQL para Prisma
- `PALWORLD_MAP_IMAGE`: URL o ruta pública de la imagen del mapa, por ejemplo `/map.jpg`. Si no la defines, usa la imagen incluida en `public/map.jpg`
- `PALWORLD_MAP_CAPTION`: texto de ayuda que se muestra sobre el mapa
- `PALWORLD_MAP_TRANSFORM`: `reference` para usar la misma proyección del mapa online de referencia, o `bounds` para usar límites configurables
- `PALWORLD_MAP_X_MIN`: límite mínimo X del mundo, por defecto `-500000`
- `PALWORLD_MAP_X_MAX`: límite máximo X del mundo, por defecto `500000`
- `PALWORLD_MAP_Y_MIN`: límite mínimo Y del mundo, por defecto `-500000`
- `PALWORLD_MAP_Y_MAX`: límite máximo Y del mundo, por defecto `500000`
- `PALWORLD_MAP_INVERT_Y`: invierte el eje Y al pintar el mapa, por defecto `true`
- `REDIS_URL`: URL opcional para persistir y leer histórico
- `REDIS_HISTORY_KEY`: clave opcional para la serie histórica, por defecto `palworld:history`
- `HISTORY_RETENTION_DAYS`: cuántos días conservar en Redis, por defecto `30`

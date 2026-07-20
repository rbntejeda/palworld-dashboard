FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY prisma ./prisma
RUN npm install

FROM deps AS build
COPY . .
RUN npm run build:web
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

RUN chown -R app:app /app
USER app

EXPOSE 3000

CMD ["node", "server.js"]

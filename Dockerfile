FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY database/package.json database/package.json
COPY frontend/package.json frontend/package.json
COPY scheduler/package.json scheduler/package.json
COPY shared/package.json shared/package.json

RUN npm ci

COPY backend backend
COPY database database
COPY frontend frontend
COPY scheduler scheduler
COPY shared shared

RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /app /app
COPY deploy/docker-app-entrypoint.sh /usr/local/bin/docker-app-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-app-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["docker-app-entrypoint.sh"]

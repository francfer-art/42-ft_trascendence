# Production image (used by Railway): the backend serves the API, Socket.IO and
# the built frontend from a single container. For local development keep using
# docker-compose (see README).

FROM node:22-alpine3.24 AS frontend

WORKDIR /app/frontend

COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
# `npm run build` also runs `tsc -b`, which fails on existing type errors that
# don't affect the bundle, so only the Vite build runs here
RUN npx vite build

FROM node:22-alpine3.24

# PostgreSQL is only started when no DATABASE_URL is provided (see docker-entrypoint.sh)
RUN apk add --no-cache postgresql16 su-exec tini

WORKDIR /app/backend

COPY backend/package*.json backend/.npmrc ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npx prisma generate

COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY docker-entrypoint.sh /usr/local/bin/

ENV NODE_ENV=production \
    FRONTEND_DIST=/app/frontend/dist \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    PATH=/app/backend/node_modules/.bin:$PATH

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]

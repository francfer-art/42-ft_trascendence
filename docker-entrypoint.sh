#!/bin/sh
# Entrypoint of the production image (root Dockerfile).
#
# - Uses DATABASE_URL when it is set (e.g. a Railway PostgreSQL service).
#   Otherwise it starts a PostgreSQL server inside this container, so the app
#   works without creating any other service.
# - If a Railway volume is attached, the embedded database and the uploaded
#   avatars are stored in it and survive redeploys. Without a volume they are
#   reset on every deploy.
# - Syncs the Prisma schema, seeds the game data and starts the backend.
set -eu

DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-/var/lib/transcendence}"
PGDATA="$DATA_DIR/postgres"
export UPLOADS_DIR="${UPLOADS_DIR:-$DATA_DIR/uploads}"

# Public URL used in emails and in the 42 OAuth redirect
if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  export FRONTEND_URL="${FRONTEND_URL:-https://$RAILWAY_PUBLIC_DOMAIN}"
  export FORTYTWO_REDIRECT_URI="${FORTYTWO_REDIRECT_URI:-$FRONTEND_URL/api/auth/42/callback}"
fi

embedded_db=false
server_pid=

start_embedded_db() {
  echo "DATABASE_URL is not set, starting the embedded PostgreSQL in $PGDATA"

  mkdir -p "$PGDATA" /run/postgresql
  chown -R postgres:postgres "$PGDATA" /run/postgresql
  chmod 700 "$PGDATA"

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    su-exec postgres initdb -D "$PGDATA" -U postgres --auth=trust \
      --encoding=UTF8 --no-locale > /dev/null
  fi

  # Left behind if the previous container was killed; no server is running yet
  rm -f "$PGDATA/postmaster.pid"

  su-exec postgres pg_ctl -D "$PGDATA" -w -o "-c listen_addresses=127.0.0.1" start
  embedded_db=true

  if ! su-exec postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'transcendence'" | grep -q 1; then
    su-exec postgres createdb transcendence
  fi

  export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/transcendence"
}

stop_embedded_db() {
  if [ "$embedded_db" = true ]; then
    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop || true
  fi
}

on_signal() {
  if [ -n "$server_pid" ]; then
    kill -TERM "$server_pid" 2> /dev/null || true
  else
    stop_embedded_db
    exit 143
  fi
}

trap on_signal INT TERM

if [ -z "${DATABASE_URL:-}" ]; then
  start_embedded_db
fi

mkdir -p "$UPLOADS_DIR"

prisma db push --skip-generate

echo "Seeding the database..."
# The seed logs every imported row; errors still go to stderr
prisma db seed > /dev/null
echo "Seed finished"

node --import tsx src/server.ts &
server_pid=$!

# `wait` returns early when a signal is trapped, so keep waiting until the
# server has really exited
while :; do
  status=0
  wait "$server_pid" || status=$?
  kill -0 "$server_pid" 2> /dev/null || break
done

stop_embedded_db
exit "$status"

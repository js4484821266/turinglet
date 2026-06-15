#!/usr/bin/env sh
set -eu

cd /app/database
node dist/migrate.js

cd /app
exec node backend/dist/src/server.js

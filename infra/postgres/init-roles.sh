#!/bin/sh
# Runs once on first container start. Passwords come from the environment (.env).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_pw="$APP_OWNER_PASSWORD" -v user_pw="$APP_USER_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
-- Owns tables and creates policies. Used by Prisma Migrate only.
CREATE ROLE app_owner LOGIN PASSWORD :'owner_pw' NOSUPERUSER NOBYPASSRLS;
-- Runtime role for API and worker: DML grants only, subject to RLS.
CREATE ROLE app_user LOGIN PASSWORD :'user_pw' NOSUPERUSER NOBYPASSRLS;

GRANT ALL ON DATABASE :"db" TO app_owner;
GRANT CONNECT ON DATABASE :"db" TO app_user;

ALTER SCHEMA public OWNER TO app_owner;
GRANT USAGE ON SCHEMA public TO app_user;

-- Tables and sequences created later by app_owner are readable/writable by app_user.
-- AuditLog gets narrower grants in its own migration.
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
SQL

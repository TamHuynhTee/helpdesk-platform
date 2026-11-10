# Helpdesk SaaS

Multi-tenant helpdesk (Zendesk-like), built with Nx, Next.js, NestJS, Prisma and PostgreSQL 16 with Row-Level Security. Specs are in [docs/](docs/); working rules are in [CLAUDE.md](CLAUDE.md).

## Prerequisites

- Node.js 24+
- pnpm 12+ (`packageManager` is pinned in `package.json`)
- Docker (for Postgres, Redis, MinIO and Mailpit)

## Local setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm nx run @helpdesk/prisma:prisma-generate
```

Services started by Docker Compose:

| Service | Port | Notes |
| --- | --- | --- |
| Postgres 16 | 5432 | Roles `app_owner` (migrations) and `app_user` (runtime, no RLS bypass) are created on first start |
| Redis | 6379 | BullMQ, introduced at the milestone that needs it |
| MinIO | 9000 / 9001 | S3-compatible storage; console on 9001 |
| Mailpit | 1025 / 8025 | SMTP sink; web UI on 8025 |

The role-init script only runs on the first start of an empty volume. To reset: `docker compose down -v && docker compose up -d`.

## Commands

```bash
pnpm nx serve api
pnpm nx dev web
pnpm nx serve worker
pnpm nx run-many -t lint test build
pnpm nx test <project>
```

Migrations run from `libs/data-access/prisma` as `app_owner`:

```bash
cd libs/data-access/prisma && pnpm prisma migrate dev
```

## Layout

See [docs/architecture.md](docs/architecture.md). Module boundaries are enforced by Nx tags (`scope:web`, `scope:api`, `scope:shared`, `scope:data`, plus `type:domain` / `type:tenancy` for API libs). Importing `@prisma/client` outside `libs/data-access/prisma` is an ESLint error.

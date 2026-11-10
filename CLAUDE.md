# Helpdesk SaaS

Multi-tenant helpdesk (Zendesk-like). Learning project: one developer plus Claude Code.
Spec lives in @docs/product-scope.md, @docs/architecture.md, @docs/data-model.md, @docs/roadmap.md.

## Stack
Nx monorepo, pnpm. Next.js (apps/web), NestJS + Prisma (apps/api, apps/worker),
PostgreSQL 16 with Row-Level Security. TypeScript strict everywhere.

## Commands
- `docker compose up -d`: Postgres, Redis, SeaweedFS, Mailpit
- `pnpm nx serve api` / `pnpm nx dev web` / `pnpm nx serve worker`
- `pnpm nx run-many -t lint test build`
- `pnpm nx test <project>`: run one project's tests
- Migrations: from libs/data-access/prisma, `pnpm prisma migrate dev`

## Tenancy rules (non-negotiable)
1. Every tenant-owned table has `tenant_id uuid NOT NULL`, RLS enabled AND forced,
   a `tenant_isolation` policy, and indexes that start with `tenantId`.
2. Never import the raw PrismaClient outside libs/data-access/prisma. Use the tenant-scoped client.
3. The tenant id comes only from TenantContext, never from a request body or query.
4. A new table ships with its RLS migration and an isolation test in the same change.
5. Worker jobs carry `tenantId` in the payload and open TenantContext before any query.
6. Runtime connects as `app_user`. `app_owner` is for migrations only.
7. Cross-tenant access returns 404, never 403, so tenant existence does not leak.

## Conventions
- DTOs and zod schemas live in libs/shared/contracts; validate at the API boundary.
- Integration tests run against a real Postgres. Do not mock the database.
- Jest for unit and integration, Playwright for e2e.
- Commit format (enforced by commitlint via a husky hook): `<type>(<optional scope>): <description>`.
  Types: `feat|fix|chore|docs|infra|update|merge|conflict`. Scope is one word, e.g. `feat(auth): add login endpoint`.
- One small PR-sized change at a time.
- Docs and code comments in English. Non-obvious decisions get an ADR in docs/adr/NNNN-title.md.

## Git branching
- Every feature, fix or update starts on its own branch cut from `main` (e.g. `feat/<name>`, `fix/<name>`, `chore/<name>`).
- Never commit directly to `main` and never merge into `main` yourself. Merging happens through a reviewed PR by the developer.

## Workflow
- For work touching more than 3 files, post a plan first and wait for approval.
- Run lint and tests for affected projects before saying a task is done.
- If a domain rule is unclear, ask instead of guessing.

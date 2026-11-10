# Architecture

One Nx monorepo holds two apps and a few shared libs; the API resolves the tenant on every request and runs all queries inside a transaction that carries that tenant to Postgres.

Requests enter through the web app or the inbound email webhook, pass the tenant layer in the API, and reach Postgres through one Prisma extension; the worker takes the same path from a queued job.

## Nx workspace layout

```
apps/
  web/                 Next.js: agent app + customer portal (route groups)
  api/                 NestJS HTTP API
  worker/              NestJS standalone app: BullMQ processors (email, SLA, notifications)
libs/
  shared/contracts/    DTOs, zod schemas, enums shared by web and api
  shared/ui/           React components
  api/tenancy/         TenantContext, guards, Prisma tenant extension
  api/auth/            Auth, sessions, memberships, RBAC
  api/tickets/         Ticket domain (module, service, controller)
  api/email/           Inbound parsing, outbound sending, threading
  api/sla/             SLA policy evaluation and business-hours math
  data-access/prisma/  schema.prisma, migrations, seed, RLS SQL
```

### Module boundaries

- Nx tags enforce direction: web may import `shared/*` only; `api/*` libs may import data-access and `shared/contracts`; domain libs must not import each other except through `api/tenancy`.
- worker reuses the same domain libs as api, so SLA and email logic exists once.

## Tenant resolution

- The tenant comes from the subdomain (`acme.app.test`) in the web app and from the `X-Tenant-Slug` header or the JWT `tid` claim in the API.
- A user may belong to several tenants, so the JWT identifies the user and the active tenant; membership is re-checked on each request.
- Platform-level tables (users, tenants) are not tenant-scoped; everything else is.

## Request flow

1. `TenantMiddleware` resolves the slug to a tenant id and verifies the caller's membership.
2. The tenant id and user id are stored in `AsyncLocalStorage` (`TenantContext`).
3. A Prisma client extension wraps each operation in `$transaction`, running `SELECT set_config('app.tenant_id', $1, true)` before the query.
4. RLS policies compare `tenant_id` to `current_setting('app.tenant_id')`, so a missing or wrong context returns zero rows.
5. Workers receive `tenantId` in every job payload and open the same context before touching data.

## Cross-cutting decisions

- IDs are UUID v7 for time-ordered inserts and index locality.
- Ticket numbers are per-tenant sequences stored in `tenant_counters`, incremented with `UPDATE ... RETURNING`.
- Soft delete only where users expect undo (tickets, canned replies); audit logs are append-only.

---

# Postgres RLS strategy

The API connects as a role that cannot bypass RLS, and each request sets `app.tenant_id` inside the same transaction as its queries, so a forgotten `where tenantId` leaks nothing.

## Database roles

| Role | Used by | Rights |
| --- | --- | --- |
| `app_owner` | Prisma Migrate only | Owns tables, creates policies; never used at runtime |
| `app_user` | API and worker at runtime | DML grants only, NOBYPASSRLS; append-only grants on AuditLog |
| `app_system` | Inbound email router, login lookup | Narrow SECURITY DEFINER functions instead of a broad bypass |

## Policy template (generated per table by a migration helper)

```sql
CREATE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tickets
  USING      (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO app_user;
```

FORCE makes the table owner subject to the policy as well. With no `app.tenant_id` set, the function returns NULL, the comparison is never true, and the query returns zero rows.

## Prisma integration

```ts
const base = new PrismaClient();

export const prisma = base.$extends({
  query: {
    $allOperations: async ({ args, query }) => {
      const { tenantId } = tenantContext.getStore() ?? {};
      if (!tenantId) throw new Error('Tenant context missing');
      const [, result] = await base.$transaction([
        base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE)`,
        query(args),
      ]);
      return result;
    },
  },
});
```

For multi-step work, services call `runInTenantTx(async (tx) => { ... })`, an interactive transaction that sets the same config first. Never use the raw `base` client in domain code; an ESLint rule and an Nx tag restrict it to `libs/data-access/prisma`.

## Special cases

- Tenant and User have no RLS. User is reachable only through auth services.
- Listing a user's workspaces before a tenant is chosen uses a SECURITY DEFINER function `auth_memberships(userId)` owned by `app_owner`.
- Inbound email resolves the tenant from `EmailChannel.address` through a SECURITY DEFINER function, then opens a normal tenant context.
- Workers carry `tenantId` in each job payload; scheduled sweeps (SLA) iterate tenants through a function that returns tenant ids, then process each inside its own context.

## Isolation tests (required for every tenant-owned table)

1. Seed two tenants with the same kind of rows.
2. In tenant A's context, a plain `findMany` returns only A's rows.
3. `update` and `delete` with a B row's id affect zero rows.
4. An insert with B's `tenantId` while in A's context fails the WITH CHECK.
5. With no context, the client throws before any query, and a direct SQL query as `app_user` returns zero rows.
6. A CI check fails if any table with a `tenant_id` column lacks an enabled and forced policy.

# Product scope

## Goals and principles

This project is a learning vehicle: a multi-tenant helpdesk SaaS built by one developer pairing with Claude Code, optimized for depth in domain and engineering rather than revenue.

### Learning goals

- Domain: ticket lifecycle, SLA timers, assignment rules, inbound email, canned replies, customer portal.
- Engineering: multi-tenancy with Postgres Row-Level Security (RLS), tenant-aware NestJS, background jobs, full-text search, audit logging, subscription billing (post-MVP).

### Tech stack

| Layer | Choice | Note |
| --- | --- | --- |
| Monorepo | Nx | Apps plus shared libs with enforced module boundaries |
| Frontend | Next.js (App Router) | Agent app and customer portal |
| Backend | NestJS + Prisma | REST API, OpenAPI generated |
| Database | PostgreSQL 16 + RLS | Shared schema, `tenant_id` on every tenant-owned row |
| Queue / cache | BullMQ + Redis | Proposed; introduced at the milestone that needs it |
| File storage | S3-compatible (SeaweedFS locally) | Proposed; attachments only |
| Auth | Email + password, JWT access + refresh | Proposed; no SSO in MVP |

### Guiding principles

1. Tenant isolation is enforced by the database, not only by application code.
2. Every tenant-owned table gets `tenant_id`, an RLS policy and an isolation test in the same change.
3. Ship vertical slices: each milestone is usable end to end and tested.
4. Boring tech first: add Redis, S3 or search engines only when a milestone requires them.
5. Record non-obvious decisions as short ADRs in `docs/adr/`.

## MVP scope

The MVP lets a team sign up, receive customer requests by email or portal, work tickets with SLA timers, and reply, with strict isolation between workspaces.

### Roles

| Role | Who | Can do |
| --- | --- | --- |
| Owner | Creator of the workspace | Everything, including workspace settings and (later) billing |
| Admin | Team lead | Manage members, groups, SLA policies, email settings, canned replies |
| Agent | Support staff | Work tickets in their groups, add internal notes, use canned replies |
| Requester | End customer | Create tickets and reply via portal or email; sees only their own tickets |

### In scope

| Module | MVP features |
| --- | --- |
| Tenancy and accounts | Sign-up creates a workspace with a unique slug (`acme.localhost`); invite members by email; one user can belong to several workspaces; workspace switcher |
| Tickets | Per-tenant ticket numbers; statuses New, Open, Pending, Solved, Closed; priority Low to Urgent; assignee and group; tags; public replies and internal notes; attachments; activity timeline |
| Lists and search | Filterable ticket list; saved views; full-text search over subject and messages (Postgres tsvector) |
| Email channel | One support address per workspace; inbound email creates or replies to a ticket (threading by Message-ID and References); agent replies go out by email |
| SLA | Policy per priority with first-response and resolution targets; business hours; background job marks at-risk and breached tickets |
| Productivity | Canned replies with variables (`{{requester.name}}`); bulk assign and bulk status change |
| Customer portal | Submit a ticket, list own tickets, reply, with magic-link login |
| Notifications | Email and in-app notice on assignment, new reply, SLA at risk |
| Admin and audit | Manage members, groups, tags, SLA, business hours; audit log of sensitive actions |

### Explicit non-goals for the MVP

- Billing, plans and usage metering (planned as a post-MVP module).
- Live chat, phone, social channels, a knowledge base and AI suggestions.
- Automation rules and triggers, ticket merge and split, custom fields.
- SSO/SAML, custom domains, per-tenant branding, data residency options.
- Mobile apps and advanced reporting (a basic counts dashboard is enough).

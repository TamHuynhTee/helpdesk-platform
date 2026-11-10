# Milestone roadmap

Nine milestones, each a vertical slice that must pass its "done when" check, including RLS isolation tests for any new table, before the next one starts.

| # | Milestone | Deliverable | Done when |
| --- | --- | --- | --- |
| M0 | Foundation | Nx workspace, Docker Compose (Postgres, Redis, MinIO, Mailpit), CI, lint and Nx boundary rules, Prisma setup, DB roles | `nx run-many -t lint test build` is green in CI; `docker compose up` gives a working local stack |
| M1 | Tenancy and auth | Tenant, User, Membership; sign-up, login, JWT; TenantContext; Prisma tenant extension; RLS migration helper; isolation test harness | Two tenants cannot see each other's rows in tests; subdomain resolves the tenant in the web app |
| M2 | Tickets core | Contact, Ticket, Message, TicketEvent, TenantCounter; REST API; agent UI with list, detail, reply and internal note | An agent creates a ticket, replies, changes status; numbers are sequential per tenant under concurrent creates |
| M3 | Team and permissions | Invitations, groups, RBAC guards, assignment, tags, audit log | Roles are enforced in API and UI; an invite flow works end to end; audit entries appear for admin actions |
| M4 | Search and productivity | Full-text search, filters, saved views, bulk actions, canned replies | Search finds by subject and message text with tenant isolation; bulk actions run in one transaction |
| M5 | Email channel | Inbound webhook, threading, outbound replies, attachments in MinIO | A mail sent to Mailpit's inbound hook creates a ticket; a reply threads correctly; redelivery creates no duplicate |
| M6 | SLA and notifications | Business hours, SLA policies, BullMQ sweeps, in-app and email notices | Due times respect business hours and timezone; breaches are flagged within one sweep interval |
| M7 | Customer portal | Magic-link login for contacts, submit ticket, list own tickets, reply | A requester sees only their own tickets and never internal notes |
| M8 | Hardening | E2E tests (Playwright), rate limiting, structured logging, load check on the ticket list, demo seed, README and ADRs | Seed script builds a demo tenant; p95 ticket list under 200 ms at 100k tickets in one tenant |

Post-MVP candidates, in suggested order: billing and plans (Stripe, usage metering), automation rules, custom fields, SSO, knowledge base.

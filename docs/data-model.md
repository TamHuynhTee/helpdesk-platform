# Data model

Two tables are platform-level (Tenant and User); every other table carries a `tenantId` protected by RLS.

## Entities

| Entity | Scope | Purpose |
| --- | --- | --- |
| Tenant | Platform | A workspace: slug, name, timezone |
| User | Platform | A login identity (agents, admins, owners); can join many tenants |
| Membership | Tenant | Links a user to a tenant with a role |
| Invitation | Tenant | Pending invite with hashed token and expiry |
| Group / GroupMember | Tenant | Support teams and their agents |
| Contact | Tenant | A requester (customer); unique per tenant by email |
| Ticket | Tenant | The case: status, priority, assignee, group, SLA timestamps |
| Message | Tenant | Public reply or internal note on a ticket, with email threading headers |
| Attachment | Tenant | File metadata attached to a message; bytes live in object storage |
| Tag / TicketTag | Tenant | Free-form labels |
| TicketEvent | Tenant | Activity timeline: status, assignee, priority changes |
| BusinessHours / SlaPolicy | Tenant | Working schedule and per-priority targets |
| CannedReply | Tenant | Reusable reply templates |
| SavedView | Tenant | Stored ticket-list filters |
| EmailChannel | Tenant | Support address that routes inbound mail to a tenant |
| Notification | Tenant | In-app notices per user |
| AuditLog | Tenant | Append-only record of sensitive actions |
| TenantCounter | Tenant | Next ticket number per tenant |

## Prisma schema (design-level)

Every tenant-scoped model also declares `tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)` with a back-relation on Tenant; those lines are omitted here for brevity and Claude Code adds them. Actor and author columns are plain UUIDs without foreign keys so audit history survives user removal.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  OWNER
  ADMIN
  AGENT
  @@map("role")
}
enum TicketStatus {
  NEW
  OPEN
  PENDING
  SOLVED
  CLOSED
  @@map("ticket_status")
}
enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
  @@map("priority")
}
enum Channel {
  EMAIL
  PORTAL
  WEB
  API
  @@map("channel")
}
enum MessageKind {
  PUBLIC_REPLY
  INTERNAL_NOTE
  @@map("message_kind")
}
enum AuthorType {
  AGENT
  REQUESTER
  SYSTEM
  @@map("author_type")
}

// ---------- Platform-level ----------
model Tenant {
  id        String   @id @default(uuid(7)) @db.Uuid
  slug      String   @unique
  name      String
  timezone  String   @default("UTC")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("tenants")
}

model User {
  id           String   @id @default(uuid(7)) @db.Uuid
  email        String   @unique
  name         String
  passwordHash String?  @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")

  memberships   Membership[]
  groups        GroupMember[]
  assigned      Ticket[]       @relation("TicketAssignee")
  notifications Notification[]

  @@map("users")
}

// ---------- Tenant-scoped ----------
model Membership {
  id        String   @id @default(uuid(7)) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  role      Role
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([userId])
  @@map("memberships")
}

model Invitation {
  id          String    @id @default(uuid(7)) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  email       String
  role        Role
  invitedById String    @map("invited_by_id") @db.Uuid
  tokenHash   String    @unique @map("token_hash")
  expiresAt   DateTime  @map("expires_at")
  acceptedAt  DateTime? @map("accepted_at")

  @@index([tenantId, email])
  @@map("invitations")
}

model Group {
  id       String @id @default(uuid(7)) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  name     String

  members GroupMember[]
  tickets Ticket[]

  @@unique([tenantId, name])
  @@map("groups")
}

model GroupMember {
  tenantId String @map("tenant_id") @db.Uuid
  groupId  String @map("group_id") @db.Uuid
  userId   String @map("user_id") @db.Uuid

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([groupId, userId])
  @@index([tenantId])
  @@map("group_members")
}

model Contact {
  id        String   @id @default(uuid(7)) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  email     String
  name      String?
  createdAt DateTime @default(now()) @map("created_at")

  tickets Ticket[]

  @@unique([tenantId, email])
  @@map("contacts")
}

model Ticket {
  id                 String       @id @default(uuid(7)) @db.Uuid
  tenantId           String       @map("tenant_id") @db.Uuid
  number             Int
  subject            String
  status             TicketStatus @default(NEW)
  priority           Priority     @default(NORMAL)
  channel            Channel
  requesterId        String       @map("requester_id") @db.Uuid
  assigneeId         String?      @map("assignee_id") @db.Uuid
  groupId            String?      @map("group_id") @db.Uuid
  firstResponseDueAt DateTime?    @map("first_response_due_at")
  resolutionDueAt    DateTime?    @map("resolution_due_at")
  firstRespondedAt   DateTime?    @map("first_responded_at")
  solvedAt           DateTime?    @map("solved_at")
  closedAt           DateTime?    @map("closed_at")
  slaBreachedAt      DateTime?    @map("sla_breached_at")
  deletedAt          DateTime?    @map("deleted_at")
  searchVector       Unsupported("tsvector")? @map("search_vector")
  createdAt          DateTime     @default(now()) @map("created_at")
  updatedAt          DateTime     @updatedAt @map("updated_at")

  requester Contact @relation(fields: [requesterId], references: [id])
  assignee  User?   @relation("TicketAssignee", fields: [assigneeId], references: [id])
  group     Group?  @relation(fields: [groupId], references: [id])
  messages  Message[]
  events    TicketEvent[]
  tags      TicketTag[]

  @@unique([tenantId, number])
  @@index([tenantId, status, assigneeId])
  @@index([tenantId, groupId, status])
  @@index([tenantId, requesterId])
  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, resolutionDueAt])
  @@map("tickets")
}

model Message {
  id              String      @id @default(uuid(7)) @db.Uuid
  tenantId        String      @map("tenant_id") @db.Uuid
  ticketId        String      @map("ticket_id") @db.Uuid
  kind            MessageKind
  authorType      AuthorType  @map("author_type")
  authorUserId    String?     @map("author_user_id") @db.Uuid
  authorContactId String?     @map("author_contact_id") @db.Uuid
  bodyText        String      @map("body_text")
  bodyHtml        String?     @map("body_html")
  emailMessageId  String?     @map("email_message_id")
  inReplyTo       String?     @map("in_reply_to")
  createdAt       DateTime    @default(now()) @map("created_at")

  ticket      Ticket       @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  attachments Attachment[]

  @@unique([tenantId, emailMessageId])
  @@index([tenantId, ticketId, createdAt])
  @@map("messages")
}

model Attachment {
  id          String @id @default(uuid(7)) @db.Uuid
  tenantId    String @map("tenant_id") @db.Uuid
  messageId   String @map("message_id") @db.Uuid
  filename    String
  contentType String @map("content_type")
  sizeBytes   Int    @map("size_bytes")
  storageKey  String @map("storage_key")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([tenantId, messageId])
  @@map("attachments")
}

model Tag {
  id       String      @id @default(uuid(7)) @db.Uuid
  tenantId String      @map("tenant_id") @db.Uuid
  name     String
  tickets  TicketTag[]

  @@unique([tenantId, name])
  @@map("tags")
}

model TicketTag {
  tenantId String @map("tenant_id") @db.Uuid
  ticketId String @map("ticket_id") @db.Uuid
  tagId    String @map("tag_id") @db.Uuid

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([ticketId, tagId])
  @@index([tenantId, tagId])
  @@map("ticket_tags")
}

model TicketEvent {
  id          String   @id @default(uuid(7)) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  ticketId    String   @map("ticket_id") @db.Uuid
  actorUserId String?  @map("actor_user_id") @db.Uuid
  type        String   // STATUS_CHANGED, ASSIGNED, PRIORITY_CHANGED, SLA_BREACHED, ...
  data        Json
  createdAt   DateTime @default(now()) @map("created_at")

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([tenantId, ticketId, createdAt])
  @@map("ticket_events")
}

model BusinessHours {
  id        String  @id @default(uuid(7)) @db.Uuid
  tenantId  String  @map("tenant_id") @db.Uuid
  name      String
  timezone  String
  schedule  Json    // { mon: [["09:00","17:00"]], ... }
  isDefault Boolean @default(false) @map("is_default")

  policies SlaPolicy[]

  @@unique([tenantId, name])
  @@map("business_hours")
}

model SlaPolicy {
  id                   String   @id @default(uuid(7)) @db.Uuid
  tenantId             String   @map("tenant_id") @db.Uuid
  priority             Priority
  firstResponseMinutes Int      @map("first_response_minutes")
  resolutionMinutes    Int      @map("resolution_minutes")
  businessHoursId      String?  @map("business_hours_id") @db.Uuid

  businessHours BusinessHours? @relation(fields: [businessHoursId], references: [id])

  @@unique([tenantId, priority])
  @@map("sla_policies")
}

model CannedReply {
  id          String    @id @default(uuid(7)) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  title       String
  body        String
  createdById String    @map("created_by_id") @db.Uuid
  deletedAt   DateTime? @map("deleted_at")

  @@index([tenantId, title])
  @@map("canned_replies")
}

model SavedView {
  id       String  @id @default(uuid(7)) @db.Uuid
  tenantId String  @map("tenant_id") @db.Uuid
  ownerId  String  @map("owner_id") @db.Uuid
  name     String
  filters  Json
  isShared Boolean @default(false) @map("is_shared")

  @@index([tenantId, ownerId])
  @@map("saved_views")
}

model EmailChannel {
  id            String @id @default(uuid(7)) @db.Uuid
  tenantId      String @map("tenant_id") @db.Uuid
  address       String @unique // global: inbound routing key
  inboundSecret String @map("inbound_secret")

  @@index([tenantId])
  @@map("email_channels")
}

model Notification {
  id        String    @id @default(uuid(7)) @db.Uuid
  tenantId  String    @map("tenant_id") @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  type      String
  ticketId  String?   @map("ticket_id") @db.Uuid
  readAt    DateTime? @map("read_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, readAt])
  @@map("notifications")
}

model AuditLog {
  id          String   @id @default(uuid(7)) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  actorUserId String?  @map("actor_user_id") @db.Uuid
  action      String
  entityType  String   @map("entity_type")
  entityId    String?  @map("entity_id")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([tenantId, createdAt(sort: Desc)])
  @@map("audit_logs")
}

model TenantCounter {
  tenantId  String @id @map("tenant_id") @db.Uuid
  ticketSeq Int    @default(0) @map("ticket_seq")

  @@map("tenant_counters")
}
```

**Naming convention:** Prisma fields stay camelCase in TypeScript; the database uses snake_case through `@map` (columns) and `@@map` (plural table names such as `tickets`, `ticket_events`). RLS SQL, raw queries and migrations use the snake_case names.

## Design notes

- `Ticket.searchVector` is filled by a database trigger from the subject and message bodies; its GIN index and the trigger live in a raw SQL migration.
- `@@unique([tenantId, emailMessageId])` makes inbound email idempotent: redelivered webhooks do not create duplicates.
- Every query path starts with `tenantId` in its composite index, so RLS filtering and application filters share the same index.
- `EmailChannel.address` is globally unique because inbound mail must be routed before a tenant is known; the lookup uses a dedicated DB role that bypasses RLS for that one table.

// Only enums are re-exported. The raw PrismaClient stays private to this lib;
// the tenant-scoped client is added in milestone M1.
export {
  Role,
  TicketStatus,
  Priority,
  Channel,
  MessageKind,
  AuthorType,
} from '@prisma/client';

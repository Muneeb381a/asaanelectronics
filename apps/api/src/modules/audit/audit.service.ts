import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditLogs, users } from '../../db/schema.js';

type LogInput = {
  sellerId:    string;
  userId:      string;
  action:      string;
  entityType:  string;
  entityId?:   string;
  description: string;
  reason?:     string;
  before?:     Record<string, unknown>;
  after?:      Record<string, unknown>;
  meta?:       Record<string, unknown>;
  ip?:         string;
  userAgent?:  string;
  sessionId?:  string;
};

type ListFilters = {
  from?: string;
  to?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  page?: number;
  limit?: number;
};

export class AuditService {
  async log(data: LogInput) {
    await db.insert(auditLogs).values({
      sellerId:    data.sellerId,
      userId:      data.userId,
      sessionId:   data.sessionId,
      action:      data.action,
      entityType:  data.entityType,
      entityId:    data.entityId,
      description: data.description,
      reason:      data.reason,
      before:      data.before ?? null,
      after:       data.after  ?? null,
      meta:        data.meta   ?? null,
      ip:          data.ip,
      userAgent:   data.userAgent,
    });
  }

  async list(sellerId: string, filters: ListFilters = {}) {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 50), 200);

    const conds = [eq(auditLogs.sellerId, sellerId)];
    if (filters.from)       conds.push(gte(auditLogs.createdAt, new Date(filters.from)));
    if (filters.to)         conds.push(lte(auditLogs.createdAt, new Date(filters.to)));
    if (filters.userId)     conds.push(eq(auditLogs.userId,     filters.userId));
    if (filters.action)     conds.push(eq(auditLogs.action,     filters.action));
    if (filters.entityType) conds.push(eq(auditLogs.entityType, filters.entityType));

    const where = and(...conds);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id:          auditLogs.id,
          action:      auditLogs.action,
          entityType:  auditLogs.entityType,
          entityId:    auditLogs.entityId,
          description: auditLogs.description,
          reason:      auditLogs.reason,
          before:      auditLogs.before,
          after:       auditLogs.after,
          meta:        auditLogs.meta,
          ip:          auditLogs.ip,
          userAgent:   auditLogs.userAgent,
          sessionId:   auditLogs.sessionId,
          createdAt:   auditLogs.createdAt,
          actorId:     auditLogs.userId,
          actorName:   users.name,
          actorEmail:  users.email,
          actorRole:   users.role,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(where),
    ]);

    return { data: rows, total: count, page, limit };
  }
}

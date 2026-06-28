import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { attendance, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export class AttendanceService {
  async clockIn(sellerId: string, userId: string) {
    const today = todayDate();

    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });
    if (existing) {
      if (!existing.clockOut) throw new AppError('Already clocked in today', 409);
      // Re-clock-in after a clock-out (second shift) — insert new record
    }

    const [record] = await db
      .insert(attendance)
      .values({ userId, sellerId, date: today })
      .returning();

    return record;
  }

  async clockOut(sellerId: string, userId: string, notes?: string) {
    const today = todayDate();

    const record = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.userId, userId),
        eq(attendance.sellerId, sellerId),
        eq(attendance.date, today),
      ),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    if (!record) throw new AppError('No clock-in found for today', 404);
    if (record.clockOut) throw new AppError('Already clocked out today', 409);

    const [updated] = await db
      .update(attendance)
      .set({ clockOut: new Date(), ...(notes !== undefined && { notes }) })
      .where(eq(attendance.id, record.id))
      .returning();

    return updated;
  }

  async getStatus(sellerId: string, userId: string) {
    const today = todayDate();
    const record = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.userId, userId),
        eq(attendance.sellerId, sellerId),
        eq(attendance.date, today),
      ),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    return {
      date: today,
      isClockedIn: !!record && !record.clockOut,
      clockIn:  record?.clockIn  ?? null,
      clockOut: record?.clockOut ?? null,
      notes:    record?.notes    ?? null,
    };
  }

  async getByMonth(sellerId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 1);

    const rows = await db.execute<{
      id: string; userId: string; userName: string;
      date: string; clock_in: string; clock_out: string | null; notes: string | null;
    }>(sql`
      SELECT
        a.id, a.user_id AS "userId", u.name AS "userName",
        a.date::text, a.clock_in, a.clock_out, a.notes
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      WHERE a.seller_id = ${sellerId}
        AND a.date >= ${from.toISOString().slice(0, 10)}
        AND a.date <  ${to.toISOString().slice(0, 10)}
      ORDER BY a.date DESC, u.name ASC
    `);

    return rows.map((r) => ({
      id:       r.id,
      userId:   r.userId,
      userName: r.userName,
      date:     r.date,
      clockIn:  r.clock_in,
      clockOut: r.clock_out,
      notes:    r.notes,
      durationMin: r.clock_out
        ? Math.round((new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60_000)
        : null,
    }));
  }

  async getStaffSummary(sellerId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 1);

    const rows = await db.execute<{
      userId: string; userName: string;
      days: number; total_minutes: string;
    }>(sql`
      SELECT
        a.user_id AS "userId", u.name AS "userName",
        COUNT(DISTINCT a.date)::int AS days,
        COALESCE(SUM(
          CASE WHEN a.clock_out IS NOT NULL
            THEN EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 60
          END
        ), 0)::text AS "total_minutes"
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      WHERE a.seller_id = ${sellerId}
        AND a.date >= ${from.toISOString().slice(0, 10)}
        AND a.date <  ${to.toISOString().slice(0, 10)}
      GROUP BY a.user_id, u.name
      ORDER BY days DESC
    `);

    const workingDays = countWorkingDays(year, month);

    return rows.map((r) => {
      const totalMin = Math.round(Number(r.total_minutes));
      return {
        userId:      r.userId,
        userName:    r.userName,
        daysPresent: r.days,
        workingDays,
        attendancePct: workingDays > 0 ? Math.round((r.days / workingDays) * 100) : 0,
        totalHours:  Math.floor(totalMin / 60),
        totalMinutes: totalMin % 60,
        avgHoursPerDay: r.days > 0 ? Math.round(totalMin / r.days / 60 * 10) / 10 : 0,
      };
    });
  }
}

function countWorkingDays(year: number, month: number) {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0) count++; // exclude Sunday (Pakistan: Sunday off)
  }
  return count;
}

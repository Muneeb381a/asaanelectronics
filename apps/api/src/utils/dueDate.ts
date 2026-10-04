import { sql, type SQL } from 'drizzle-orm';

// Single source of truth for "when is the next unpaid period due" so dashboard,
// reports, badges and portal all agree. `a` is the installments table alias
// ('' when the query reads the table unaliased).
//
// paidPeriods = floor((total - down - remaining) / periodAmount)
// monthly: due on payment_due_day of the month (paidPeriods + 1) months after start
// daily:   start + (paidPeriods + 1) days
export function nextDueDateRaw(a = 'i'): string {
  const p = a ? `${a}.` : '';
  const paidPeriods = `GREATEST(0, FLOOR((${p}total_amount::numeric - ${p}down_payment::numeric - ${p}remaining::numeric) / NULLIF(${p}monthly::numeric, 0)))`;
  return `(CASE WHEN ${p}payment_frequency = 'daily'
    THEN (${p}start_date + ((${paidPeriods} + 1) || ' days')::interval)::date
    ELSE (DATE_TRUNC('month', ${p}start_date + ((${paidPeriods} + 1) || ' months')::interval)::date + (COALESCE(${p}payment_due_day, 10) - 1))
  END)`;
}

export const PKT_TODAY_RAW = `(NOW() AT TIME ZONE 'Asia/Karachi')::date`;

/** Boolean: active and next due date is before today (Pakistan). */
export function isOverdueRaw(a = 'i'): string {
  const p = a ? `${a}.` : '';
  return `(${p}status = 'ACTIVE' AND ${nextDueDateRaw(a)} < ${PKT_TODAY_RAW})`;
}

/** Integer days past next due date; 0 when not active or not yet due. */
export function daysOverdueRaw(a = 'i'): string {
  const p = a ? `${a}.` : '';
  return `(CASE WHEN ${p}status <> 'ACTIVE' THEN 0 ELSE GREATEST(0, ${PKT_TODAY_RAW} - ${nextDueDateRaw(a)}) END)`;
}

// Rupees actually missed (elapsed-but-unpaid periods × period amount, capped
// at remaining) — NOT the account's full remaining balance. Several places
// summed `remaining` for every overdue installment and labeled the total
// "overdue amount", which overstates it hugely: a customer 1 period late on
// an 11-month plan has their ENTIRE remaining balance counted as "late",
// not just the one missed payment.
export function overdueAmountRaw(a = 'i'): string {
  const p = a ? `${a}.` : '';
  const paidPeriods = `GREATEST(0, FLOOR((${p}total_amount::numeric - ${p}down_payment::numeric - ${p}remaining::numeric) / NULLIF(${p}monthly::numeric, 0)))`;
  // Periods that SHOULD have been paid by today, independent of how many
  // actually were — the inverse of nextDueDateRaw's "given paidPeriods, what
  // date is next due".
  const periodsElapsed = `(CASE WHEN ${p}payment_frequency = 'daily'
    THEN GREATEST(0, ${PKT_TODAY_RAW} - ${p}start_date::date)
    ELSE GREATEST(0,
      (EXTRACT(YEAR FROM ${PKT_TODAY_RAW})::int - EXTRACT(YEAR FROM ${p}start_date)::int) * 12
      + (EXTRACT(MONTH FROM ${PKT_TODAY_RAW})::int - EXTRACT(MONTH FROM ${p}start_date)::int)
      - (CASE WHEN EXTRACT(DAY FROM ${PKT_TODAY_RAW})::int < COALESCE(${p}payment_due_day, 10) THEN 1 ELSE 0 END)
    )
  END)`;
  return `(CASE WHEN ${p}status <> 'ACTIVE' THEN 0
    ELSE LEAST(GREATEST(0, ${periodsElapsed} - ${paidPeriods}) * ${p}monthly::numeric, ${p}remaining::numeric)
  END)`;
}

export const pktTodaySql       = sql.raw(PKT_TODAY_RAW);
export const nextDueDateSql    = (a = 'i'): SQL => sql.raw(nextDueDateRaw(a));
export const isOverdueSql      = (a = 'i'): SQL => sql.raw(isOverdueRaw(a));
export const daysOverdueSql    = (a = 'i'): SQL => sql.raw(daysOverdueRaw(a));
export const overdueAmountSql  = (a = 'i'): SQL => sql.raw(overdueAmountRaw(a));

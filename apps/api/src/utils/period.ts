import { pktMonthStart } from './pkt.js';

// 'this_month' / 'last_month' → a [from, to) range in Pakistan time, shared by
// every "when was this created" filter (customers, installments, ...).
export function periodRange(period?: string): { from: Date; to?: Date } | null {
  if (period === 'this_month') return { from: pktMonthStart() };
  if (period === 'last_month') return { from: pktMonthStart(undefined, 1), to: pktMonthStart() };
  return null;
}

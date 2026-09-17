// Pakistan has no DST, so a fixed +05:00 offset is exact.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pktParts(now = new Date()) {
  const shifted = new Date(now.getTime() + PKT_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** UTC instant at which today started in Pakistan. */
export function pktDayStart(now = new Date()): Date {
  const { y, m, d } = pktParts(now);
  return new Date(Date.UTC(y, m, d) - PKT_OFFSET_MS);
}

/** UTC instant at which the current Pakistan month started. */
export function pktMonthStart(now = new Date()): Date {
  const { y, m } = pktParts(now);
  return new Date(Date.UTC(y, m, 1) - PKT_OFFSET_MS);
}

/** YYYY-MM-DD for today in Pakistan. */
export function pktToday(now = new Date()): string {
  const { y, m, d } = pktParts(now);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

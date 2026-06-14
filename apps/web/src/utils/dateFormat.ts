function toDate(d: Date | string | null | undefined): Date {
  if (!d) return new Date();
  return typeof d === 'string' ? new Date(d) : d;
}

/** DD/MM/YYYY  →  "05/06/2026" */
export function fmtDate(d: Date | string | null | undefined): string {
  const dt = toDate(d);
  const dd   = String(dt.getDate()).padStart(2, '0');
  const mm   = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** DD/MM/YYYY, HH:MM AM/PM  →  "05/06/2026, 02:30 PM" */
export function fmtDateTime(d: Date | string | null | undefined): string {
  const dt    = toDate(d);
  const hours = dt.getHours();
  const mins  = String(dt.getMinutes()).padStart(2, '0');
  const ampm  = hours >= 12 ? 'PM' : 'AM';
  const h12   = String(hours % 12 || 12).padStart(2, '0');
  return `${fmtDate(dt)}, ${h12}:${mins} ${ampm}`;
}

/** DD/MM  →  "05/06"  (day + month, no year) */
export function fmtDateShort(d: Date | string | null | undefined): string {
  const dt = toDate(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** MM/YYYY  →  "06/2026"  (month + year only) */
export function fmtMonthYear(d: Date | string | null | undefined): string {
  const dt   = toDate(d);
  const mm   = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}/${yyyy}`;
}

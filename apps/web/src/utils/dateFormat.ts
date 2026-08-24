let _tz = 'Asia/Karachi';

export function setTimezone(tz: string) { _tz = tz; }
export function getTimezone(): string   { return _tz; }

function toDate(d: Date | string | null | undefined): Date {
  if (!d) return new Date();
  return typeof d === 'string' ? new Date(d) : d;
}

function dateParts(d: Date): { dd: string; mm: string; yyyy: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: _tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return { dd: get('day'), mm: get('month'), yyyy: get('year') };
}

function timeParts(d: Date): { h: string; min: string; ampm: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: _tz, hour: '2-digit', minute: '2-digit', hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { h: get('hour'), min: get('minute'), ampm: get('dayPeriod').toUpperCase() };
}

/** DD/MM/YYYY  →  "05/06/2026" */
export function fmtDate(d: Date | string | null | undefined): string {
  const { dd, mm, yyyy } = dateParts(toDate(d));
  return `${dd}/${mm}/${yyyy}`;
}

/** DD/MM/YYYY, HH:MM AM/PM  →  "05/06/2026, 02:30 PM" */
export function fmtDateTime(d: Date | string | null | undefined): string {
  const dt = toDate(d);
  const { dd, mm, yyyy } = dateParts(dt);
  const { h, min, ampm } = timeParts(dt);
  return `${dd}/${mm}/${yyyy}, ${h}:${min} ${ampm}`;
}

/** DD/MM  →  "05/06"  (day + month, no year) */
export function fmtDateShort(d: Date | string | null | undefined): string {
  const { dd, mm } = dateParts(toDate(d));
  return `${dd}/${mm}`;
}

/** MM/YYYY  →  "06/2026"  (month + year only) */
export function fmtMonthYear(d: Date | string | null | undefined): string {
  const { mm, yyyy } = dateParts(toDate(d));
  return `${mm}/${yyyy}`;
}

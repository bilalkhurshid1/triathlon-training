export function isoDay(d: Date): string {
  // Returns YYYY-MM-DD in the local timezone (workouts are day-level, not UTC instants).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  const ms = dayStart(b).getTime() - dayStart(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  return daysBetween(now, target);
}

export function mondayOf(d: Date): Date {
  const day = dayStart(d);
  const dow = day.getDay(); // 0=Sun..6=Sat
  const back = (dow + 6) % 7; // distance to previous Monday
  day.setDate(day.getDate() - back);
  return day;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Parse "M/D" or "MM/DD" assuming a reference year. If the resulting date is
 * more than `futureToleranceDays` past the reference, roll back a year.
 */
export function parseShortDate(
  short: string,
  referenceYear: number,
  reference: Date = new Date(),
  futureToleranceDays = 14
): Date | null {
  const m = short.match(/^\s*(\d{1,2})\/(\d{1,2})\s*$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let d = new Date(referenceYear, month - 1, day);
  if (daysBetween(reference, d) > futureToleranceDays) {
    d = new Date(referenceYear - 1, month - 1, day);
  }
  return d;
}

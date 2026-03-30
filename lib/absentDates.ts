/** YYYY-MM-DD from an attendance_absent notification (metadata preferred). */
export function absentYmdFromNotification(n: {
  metadata?: { date?: unknown };
  createdAt?: string | Date;
}): string | null {
  const raw = n?.metadata?.date;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  try {
    const d = new Date(n?.createdAt as string | Date);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

export function buildAbsentYmdSet(notifications: unknown[]): Set<string> {
  const set = new Set<string>();
  for (const n of notifications) {
    const ymd = absentYmdFromNotification(n as { metadata?: { date?: unknown }; createdAt?: string | Date });
    if (ymd) set.add(ymd);
  }
  return set;
}

export function ymdFromParts(year: number, month0: number, day: number): string {
  const m = String(month0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** First day of month: 0 = Sunday … 6 = Saturday */
export function startWeekdaySun0(year: number, month0: number): number {
  return new Date(year, month0, 1).getDay();
}

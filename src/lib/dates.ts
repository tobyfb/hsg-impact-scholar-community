// Dates in content files are plain days (YYYY-MM-DD) and are parsed as UTC midnight,
// so they are always formatted in UTC. "Today" is the calendar day in Zurich.

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export const todayZurich = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());

const fmt = (d: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(d);

/** 30 November 2026 */
export const longDate = (d: Date) => fmt(d, { day: "numeric", month: "long", year: "numeric" });
/** Monday, 30 November 2026 */
export const fullDate = (d: Date) =>
  `${fmt(d, { weekday: "long" })}, ${longDate(d)}`;
/** 30 Nov */
export const shortDate = (d: Date) => fmt(d, { day: "numeric", month: "short" });
export const dayNumber = (d: Date) => fmt(d, { day: "numeric" });
export const monthShort = (d: Date) => fmt(d, { month: "short" });
export const year = (d: Date) => d.getUTCFullYear();

/** "14:00–16:00", "from 17:00" or "" */
export function timeRange(start?: string, end?: string) {
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  return "";
}

type Dated = { date: Date; endDate?: Date };

/** Last day of an event as YYYY-MM-DD */
export const lastDay = (e: Dated) => isoDay(e.endDate ?? e.date);

/** An event counts as upcoming until the end of its last day. */
export const isUpcoming = (e: Dated) => lastDay(e) >= todayZurich();

/** "30 November 2026" or "12–13 March 2026" */
export function dateRange(e: Dated) {
  if (!e.endDate || isoDay(e.endDate) === isoDay(e.date)) return longDate(e.date);
  const sameMonth = e.endDate.getUTCMonth() === e.date.getUTCMonth() && year(e.endDate) === year(e.date);
  return sameMonth
    ? `${dayNumber(e.date)}–${longDate(e.endDate)}`
    : `${longDate(e.date)} – ${longDate(e.endDate)}`;
}

// THE TIMEZONE THE APP'S DATES AND TIMES ARE WRITTEN IN. RENDER'S SERVER RUNS IN UTC,
// SO WE CAN'T RELY ON THE SERVER'S OWN CLOCK SETTINGS. CHANGE IT IF YOUR USERS ARE ELSEWHERE.
const APP_TIMEZONE = "Asia/Beirut";

// NOW, AS A DATE ("2026-10-16") AND A TIME ("15:30") IN THE APP'S TIMEZONE
export function getNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

// TRUE IF THE SLOT HAS ALREADY STARTED (THE DATE AND TIME STRINGS COMPARE CORRECTLY
// BECAUSE THEY ARE ZERO-PADDED)
export function isPastSlot(date: string, startTime: string): boolean {
  const now = getNow();
  return date < now.date || (date === now.date && startTime <= now.time);
}

// "2026-10-16" + 3 DAYS = "2026-10-19"
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

import { addDays, getNow, isPastSlot } from "../lib/time";

// THE FORMATS WE ACCEPT: DATE AS 2026-10-16 AND TIME AS 09:30 (24 HOURS)
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

// LIMITS (CHANGE THEM IF YOUR APP NEEDS DIFFERENT ONES)
export const MIN_SLOT_MINUTES = 15;
export const MAX_SLOT_MINUTES = 240;
export const MAX_DAYS_AHEAD = 365;

// "2026-02-31" HAS THE RIGHT SHAPE BUT IS NOT A REAL DAY.
// WE BUILD THE DATE AND CHECK THAT IT COMES BACK THE SAME
function isRealDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// RETURNS AN ERROR MESSAGE, OR null IF THE SLOT IS OK
export function validateSlotInput(body: Record<string, any>): string | null {
  const { date, startTime, endTime } = body;

  if (
    typeof date !== "string" ||
    typeof startTime !== "string" ||
    typeof endTime !== "string" ||
    !isRealDate(date) ||
    !TIME_FORMAT.test(startTime) ||
    !TIME_FORMAT.test(endTime)
  ) {
    return "Please send a valid date and valid start and end times";
  }

  if (endTime <= startTime) {
    return "The end time must be after the start time";
  }

  const minutes = toMinutes(endTime) - toMinutes(startTime);
  if (minutes < MIN_SLOT_MINUTES || minutes > MAX_SLOT_MINUTES) {
    return `A slot must last between ${MIN_SLOT_MINUTES} and ${MAX_SLOT_MINUTES} minutes`;
  }

  if (isPastSlot(date, startTime)) {
    return "Cannot create a slot in the past";
  }

  if (date > addDays(getNow().date, MAX_DAYS_AHEAD)) {
    return "Slots can be created at most one year ahead";
  }

  return null;
}

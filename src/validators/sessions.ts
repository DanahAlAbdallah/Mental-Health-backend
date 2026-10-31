// THE STATUSES A SESSION CAN BE CHANGED TO ("pending" IS ONLY SET WHEN BOOKING)
export const NEW_STATUSES = ["confirmed", "rejected", "cancelled"] as const;
export type NewStatus = (typeof NEW_STATUSES)[number];

// TYPE GUARD: CHECKS AT RUNTIME AND TELLS TYPESCRIPT THE RESULT
export function isNewStatus(value: unknown): value is NewStatus {
  return (
    typeof value === "string" &&
    (NEW_STATUSES as readonly string[]).includes(value)
  );
}

// A NON EMPTY STRING OF REASONABLE LENGTH (FOR IDS IN THE BODY)
export function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 100
  );
}

export const SESSION_TYPES = ["online", "in-person", "both"] as const;

// 19.99 * 100 IS 1998.9999999999998 IN JS, SO WE COMPARE WITH A SMALL TOLERANCE
export function isValidPrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100000 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  );
}

// ONLY REAL http(s) LINKS, MAX 2048 CHARACTERS
export function isValidAvatarUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

// DIGITS, SPACES AND + ( ) - ONLY, MAX 30 CHARACTERS
export function isValidPhone(value: string): boolean {
  return value.length <= 30 && /^[+\d\s()-]+$/.test(value);
}

// RETURNS AN ERROR MESSAGE, OR null IF EVERYTHING IS OK
export function validateProfileInput(body: Record<string, any>): string | null {
  const { bio, sessionType, yearsOfExperience, sessionPrice, location } = body;

  if (bio !== undefined && (typeof bio !== "string" || bio.length > 1000)) {
    return "Bio must be text of at most 1000 characters";
  }
  if (sessionType !== undefined && !SESSION_TYPES.includes(sessionType)) {
    return `Session type must be one of: ${SESSION_TYPES.join(", ")}`;
  }
  if (
    yearsOfExperience != null &&
    (!Number.isInteger(yearsOfExperience) ||
      yearsOfExperience < 0 ||
      yearsOfExperience > 70)
  ) {
    return "Years of experience must be a whole number between 0 and 70";
  }
  if (sessionPrice != null && !isValidPrice(sessionPrice)) {
    return "Session price must be a non-negative number with at most two decimal places";
  }
  if (
    location !== undefined &&
    (typeof location !== "string" || location.length > 200)
  ) {
    return "Location must be text of at most 200 characters";
  }
  return null;
}

// CHECKS THE PERSONAL INFO (NAME, PHONE, PHOTO) SENT TO PUT /me
export function validateMeInput(body: Record<string, any>): string | null {
  const { name, phone, avatarUrl } = body;

  if (typeof name !== "string" || !name.trim()) {
    return "Name cannot be empty";
  }
  if (name.trim().length > 100) {
    return "Name is too long";
  }
  if (phone != null) {
    if (typeof phone !== "string") return "Invalid phone number";
    if (phone.trim() && !isValidPhone(phone.trim())) {
      return "Invalid phone number";
    }
  }
  if (avatarUrl != null) {
    if (typeof avatarUrl !== "string") return "Invalid avatar URL";
    if (avatarUrl.trim() && !isValidAvatarUrl(avatarUrl.trim())) {
      return "Avatar must be a valid http or https link";
    }
  }
  return null;
}

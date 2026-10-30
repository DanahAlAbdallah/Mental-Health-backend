// THE ONLY ROLES A STRANGER IS ALLOWED TO CHOOSE. "admin" IS NOT HERE ON PURPOSE.
const SIGNUP_ROLES = ["client", "therapist"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

// TYPE GUARD: CHECKS AT RUNTIME AND TELLS TYPESCRIPT THE RESULT
export function isSignupRole(value: unknown): value is SignupRole {
  return (
    typeof value === "string" && SIGNUP_ROLES.includes(value as SignupRole)
  );
}

// SIMPLE FORMAT CHECK: SOMETHING@SOMETHING.SOMETHING, NO SPACES
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_REGEX.test(email);
}

// RETURNS AN ERROR MESSAGE, OR null IF THE PASSWORD IS OK
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  // bcrypt ONLY READS THE FIRST 72 BYTES, SO WE REFUSE LONGER ONES
  if (password.length > 72) {
    return "Password must be at most 72 characters long";
  }
  if (!/[A-Za-z]/.test(password)) {
    return "Password must contain at least one letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
}

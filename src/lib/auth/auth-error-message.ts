export type AuthErrorTranslationKey =
  | "auth.invalidCredentials"
  | "auth.invalidEmail"
  | "auth.emailAlreadyRegistered"
  | "auth.weakPassword"
  | "auth.authUnavailable";

/** Map provider-specific errors to short, user-facing messages without leaking internals. */
export function authErrorTranslationKey(error: unknown): AuthErrorTranslationKey {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message).toLowerCase()
      : String(error).toLowerCase();

  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return "auth.invalidCredentials";
  }
  if (message.includes("already registered") || message.includes("user already exists")) {
    return "auth.emailAlreadyRegistered";
  }
  if (message.includes("weak password") || message.includes("password should")) {
    return "auth.weakPassword";
  }
  if (message.includes("invalid email") || message.includes("email address is invalid")) {
    return "auth.invalidEmail";
  }
  return "auth.authUnavailable";
}

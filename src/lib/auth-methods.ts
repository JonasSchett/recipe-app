// Which sign-in methods this deployment offers. The person running the server
// decides; see AUTH_METHODS / AUTH_PASSWORD_IDENTIFIER in .env.example.
//
// Read through these helpers rather than touching process.env directly, so the
// login page and the Server Actions can never disagree about what is enabled —
// hiding a form is presentation, refusing the action is the actual control.

export type AuthMethod = "google" | "password";

/** What a password account is identified by. */
export type PasswordIdentifier = "username" | "email";

/**
 * Enabled methods, defaulting to Google alone — that is what the app did before
 * password sign-in existed, so an untouched `.env` keeps working unchanged.
 */
export function enabledAuthMethods(): AuthMethod[] {
  const raw = process.env.AUTH_METHODS?.trim();
  if (!raw) return ["google"];

  const methods = raw
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter((m): m is AuthMethod => m === "google" || m === "password");

  // An unrecognised value would otherwise lock everyone out, including the
  // admin who would have to fix it.
  return methods.length > 0 ? methods : ["google"];
}

export function isAuthMethodEnabled(method: AuthMethod): boolean {
  return enabledAuthMethods().includes(method);
}

/**
 * Whether password accounts sign in with a username or an email address.
 * Only affects what the form asks for and how the value is validated — the
 * password check is identical either way.
 */
export function passwordIdentifier(): PasswordIdentifier {
  return process.env.AUTH_PASSWORD_IDENTIFIER?.trim().toLowerCase() === "email"
    ? "email"
    : "username";
}

/** Throws unless password sign-in is turned on for this deployment. */
export function assertPasswordAuthEnabled(): void {
  if (!isAuthMethodEnabled("password")) {
    throw new Error("Password sign-in is not enabled on this server.");
  }
}

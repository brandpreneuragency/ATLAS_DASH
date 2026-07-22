/** Parse comma-separated allow-list into normalized emails. */
export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Decide whether a sign-in email is permitted.
 * - AUTH_DEV_BYPASS=true allows any email (local shell only)
 * - empty allow-list denies by default
 */
export function isEmailAllowed(
  email: string | null | undefined,
  options: {
    allowedEmails: string[];
    devBypass: boolean;
  },
): boolean {
  if (!email) return false;
  if (options.devBypass) return true;
  if (options.allowedEmails.length === 0) return false;
  return options.allowedEmails.includes(email.toLowerCase());
}

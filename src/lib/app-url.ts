/**
 * F-07: security-sensitive email redirects must use a configured canonical
 * origin. Request headers (Host / X-Forwarded-Host) are attacker-influenced and
 * are never used to build auth callbacks.
 */
export function resolveAppUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  const configured = env.APP_URL ?? env.NEXT_PUBLIC_APP_URL;
  if (configured && /^https?:\/\/[^/\s]+/.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  if (env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return null;
}

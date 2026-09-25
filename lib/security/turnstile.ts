import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

export type TurnstileOutcome = "passed" | "failed" | "unavailable" | "not_configured";

export const BOT_CHECK_FAILED_MESSAGE =
  "We couldn't confirm you're not a bot. Please wait a moment and try again.";

/** Server action input is untrusted: only a non-empty string counts as a token. */
export function readTurnstileToken(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 2048 ? value : undefined;
}

/**
 * Verifies a Cloudflare Turnstile token server side (spec 0006). Callers
 * reject on "failed" only: "unavailable" (Cloudflare unreachable or slow)
 * and "not_configured" (missing secret) fail open by design, AC-3/AC-4,
 * because a lost buyer lead costs more than a few spam rows and the per
 * phone limits still apply inside the write. Both are logged so they're
 * visible rather than silent.
 */
export async function verifyTurnstile(token: string | undefined): Promise<TurnstileOutcome> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Without the site key the forms render no widget and can never send a
  // token, so a set secret alone would reject every submission (AC-4).
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!secret || !siteKey) {
    const missing = [!secret && "TURNSTILE_SECRET_KEY", !siteKey && "NEXT_PUBLIC_TURNSTILE_SITE_KEY"].filter(Boolean);
    console.error(`[turnstile] ${missing.join(" and ")} not set; bot check skipped`);
    return "not_configured";
  }

  if (!token) return "failed";

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[turnstile] verify endpoint returned ${response.status}; allowing request`);
      return "unavailable";
    }

    const result = (await response.json()) as { success?: boolean };
    return result.success === true ? "passed" : "failed";
  } catch (error) {
    console.error("[turnstile] verify request failed; allowing request", error);
    return "unavailable";
  }
}

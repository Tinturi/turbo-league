import { createHash } from "node:crypto";

export function normalizeUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const username = value.normalize("NFKC").trim().toLowerCase();
  return /^[\p{L}\p{N}_.-]{3,32}$/u.test(username) ? username : null;
}

export function loginEmail(username: string) {
  return `${createHash("sha256").update(username).digest("hex")}@login.turbo-league.invalid`;
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && value.length <= 128;
}

export function sameOrigin(request: Request) {
  // Netlify can rewrite request.url to an internal deployment hostname.
  // Compare against the configured public origin, never untrusted forwarded headers.
  const expected = process.env.NODE_ENV === "production"
    ? (process.env.SITE_ORIGIN || "https://turbo-league-s2.netlify.app")
    : new URL(request.url).origin;
  return request.headers.get("origin") === expected;
}

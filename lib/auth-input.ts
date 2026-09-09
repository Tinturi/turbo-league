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
  return request.headers.get("origin") === new URL(request.url).origin;
}

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin";
import { sameOrigin } from "./auth-input";

export const SESSION_COOKIE = "tl-session";
export const privateHeaders = { "Cache-Control": "no-store, private" };
export const authClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

export async function currentAccount(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const result = await supabaseAdmin.from("player_accounts").select("user_id,username,player_id").eq("user_id", data.user.id).maybeSingle();
  if (result.error) throw new Error("Account lookup failed");
  return result.data;
}

export async function requireOwner(req: NextRequest, playerId: number) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Недопустимый источник запроса" }, { status: 403 });
  const account = await currentAccount(req);
  if (!account) return NextResponse.json({ ok: false, error: "Войдите в аккаунт" }, { status: 401 });
  if (Number(account.player_id) !== playerId) return NextResponse.json({ ok: false, error: "Действие доступно только владельцу профиля" }, { status: 403 });
  return null;
}

export async function allowAuthAttempt(req: NextRequest, action: string, username: string) {
  // Netlify sets this header from the connection; do not trust X-Forwarded-For.
  const ip = req.headers.get("x-nf-client-connection-ip") || "shared";
  for (const identity of [`ip:${ip}`, `username:${username}`]) {
    const key = createHash("sha256").update(`${action}:${identity}`).digest("hex");
    const { data, error } = await supabaseAdmin.rpc("consume_auth_attempt", { attempt_key: key, attempt_limit: action === "register" ? 5 : 12 });
    if (error) throw new Error(`Rate limiter unavailable (${error.code}: ${error.message})`);
    if (!data) return false;
  }
  return true;
}

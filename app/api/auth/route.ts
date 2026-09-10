import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { allowAuthAttempt, authClient, currentAccount, privateHeaders, SESSION_COOKIE } from "@/lib/auth";
import { loginEmail, normalizeUsername, sameOrigin, validPassword } from "@/lib/auth-input";

import { isLeagueAdmin } from "@/lib/admin-identity";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const account = await currentAccount(req);
    let profile = null;
    if (account) {
      const result = await supabaseAdmin.from("players").select("id,name,account_id").eq("id", account.player_id).single();
      if (result.error) throw new Error("Profile unavailable");
      profile = result.data;
    }
    const [{ data: players, error }, { data: claimed, error: claimError }] = await Promise.all([
      supabaseAdmin.from("players").select("id,name").eq("active", true).order("name"),
      supabaseAdmin.from("player_accounts").select("player_id"),
    ]);
    if (error || claimError) throw new Error("Unavailable");
    const taken = new Set((claimed ?? []).map(row => Number(row.player_id)));
    return NextResponse.json({ ok: true, release: "accounts-20260909-v4", account, profile, isAdmin: isLeagueAdmin(account), players: (players ?? []).filter(row => !taken.has(Number(row.id))) }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ ok: false, error: "Сервис аккаунтов временно недоступен" }, { status: 503, headers: privateHeaders });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Недопустимый источник запроса" }, { status: 403 });
  let body;
  try {
    const text = await req.text();
    if (text.length > 4096) throw new Error();
    body = JSON.parse(text);
  } catch { return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 }); }
  if (body?.action === "logout") {
    const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }
  const username = normalizeUsername(body?.username);
  if (!username || !validPassword(body?.password) || !["login", "register"].includes(body?.action)) {
    return NextResponse.json({ ok: false, error: "Логин: 3–32 буквы, цифры, точки, дефисы или _. Пароль: 10–128 символов." }, { status: 400 });
  }
  let stage = "rate-limit";
  try {
    if (!await allowAuthAttempt(req, body.action, username)) return NextResponse.json({ ok: false, error: "Слишком много попыток. Попробуйте через 15 минут." }, { status: 429 });
    stage = "create-user";
    if (body.action === "register") {
      const playerId = Number(body.playerId);
      if (!Number.isSafeInteger(playerId) || playerId <= 0) return NextResponse.json({ ok: false, error: "Выберите свой профиль" }, { status: 400 });
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail(username), password: body.password, email_confirm: true,
        app_metadata: { league_username: username, league_player_id: playerId },
      });
      // The database trigger rolls back the auth user if either unique claim fails.
      if (error) return NextResponse.json({ ok: false, error: "Регистрация не выполнена: логин или профиль уже занят либо профиль недоступен. Обновите список и попробуйте снова." }, { status: 409 });
    }
    stage = "sign-in";
    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({ email: loginEmail(username), password: body.password });
    if (error || !data.session) return NextResponse.json({ ok: false, error: body.action === "register" ? "Аккаунт создан. Войдите с вашим логином и паролем." : "Неверный логин или пароль" }, { status: 401 });
    stage = "account-lookup";
    const { data: account, error: accountError } = await supabaseAdmin.from("player_accounts").select("player_id").eq("user_id", data.user.id).single();
    if (accountError || !account) throw new Error("Account unavailable");
    const response = NextResponse.json({ ok: true, playerId: account.player_id }, { headers: privateHeaders });
    response.cookies.set(SESSION_COOKIE, data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: data.session.expires_in });
    return response;
  } catch (error) {
    console.error("Account service failure", { stage, message: error instanceof Error ? error.message : "Unknown failure" });
    return NextResponse.json({ ok: false, code: stage, error: "Сервис аккаунтов временно недоступен. Попробуйте позже." }, { status: 503 });
  }
}

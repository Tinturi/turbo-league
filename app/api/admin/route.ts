import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentAccount, privateHeaders } from "@/lib/auth";
import { isLeagueAdmin } from "@/lib/admin-identity";
import { sameOrigin } from "@/lib/auth-input";
import { getStatus } from "@/lib/dd-status";

export const dynamic = "force-dynamic";
function reply(body: object, status = 200) { return NextResponse.json(body, { status, headers: privateHeaders }); }

export async function GET(req: NextRequest) {
  try {
    const account = await currentAccount(req);
    if (!isLeagueAdmin(account)) return reply({ ok: false, error: "Доступ только для администратора Tinturi" }, account ? 403 : 401);
    const { data, error } = await supabaseAdmin.from("players").select("id,name,rating").eq("active", true).order("name");
    if (error) throw error;
    return reply({ ok: true, players: await Promise.all((data ?? []).map(async player => ({ ...player, remaining: (await getStatus(player.id)).remaining }))) });
  } catch { return reply({ ok: false, error: "Не удалось загрузить админку" }, 503); }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ ok: false, error: "Недопустимый источник запроса" }, 403);
  try {
    const account = await currentAccount(req);
    if (!account || !isLeagueAdmin(account)) return reply({ ok: false, error: "Доступ только для администратора Tinturi" }, account ? 403 : 401);
    let body;
    try { const text = await req.text(); if (text.length > 2048) throw new Error(); body = JSON.parse(text); }
    catch { return reply({ ok: false, error: "Некорректный запрос" }, 400); }
    if (!Number.isSafeInteger(body?.playerId) || body.playerId <= 0 || !["rating", "dd"].includes(body?.action)
      || !Number.isSafeInteger(body?.value) || !Number.isSafeInteger(body?.expected)
      || (body.action === "rating" ? body.value < 0 || body.value > 1000000 : body.value === 0 || Math.abs(body.value) > 100)) {
      return reply({ ok: false, error: "Проверьте значения: рейтинг 0–1000000, изменение DD от 1 до 100" }, 400);
    }
    const { error } = await supabaseAdmin.rpc("admin_update_player", { actor_id: account.user_id, target_player: body.playerId, operation: body.action, new_value: body.value, expected_value: body.expected });
    if (error) return reply({ ok: false, error: error.code === "P0001" ? "Данные изменились или свободных DD недостаточно. Обновите значения и повторите." : "Не удалось сохранить изменение" }, error.code === "P0001" ? 409 : 503);
    return reply({ ok: true });
  } catch { return reply({ ok: false, error: "Сервис временно недоступен" }, 503); }
}

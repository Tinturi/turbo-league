import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStatus } from "@/lib/dd-status";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parsePlayerId(value: string | null) {
  const playerId = Number(value);
  return Number.isInteger(playerId) && playerId > 0 ? playerId : null;
}

export async function GET(req: NextRequest) {
  const playerId = parsePlayerId(req.nextUrl.searchParams.get("playerId"));
  if (!playerId) return NextResponse.json({ ok: false, error: "Некорректный игрок" }, { status: 400 });
  const { data: player } = await supabaseAdmin.from("players").select("id").eq("id", playerId).eq("active", true).maybeSingle();
  if (!player) return NextResponse.json({ ok: false, error: "Игрок не найден" }, { status: 404 });
  try { return NextResponse.json({ ok: true, status: await getStatus(playerId) }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  let body: { playerId?: number };
  try { body = (await req.json()) as { playerId?: number }; }
  catch { return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 }); }

  const playerId = Number(body.playerId);
  if (!Number.isInteger(playerId) || playerId <= 0) return NextResponse.json({ ok: false, error: "Некорректный игрок" }, { status: 400 });
  try {
    const denied = await requireOwner(req, playerId);
    if (denied) return denied;
  } catch { return NextResponse.json({ ok: false, error: "Не удалось проверить права" }, { status: 503 }); }
  const { data: player } = await supabaseAdmin.from("players").select("id").eq("id", playerId).eq("active", true).maybeSingle();
  if (!player) return NextResponse.json({ ok: false, error: "Игрок не найден" }, { status: 404 });

  try {
    const status = await getStatus(playerId);
    if (status.nextActivationAt && Date.parse(status.nextActivationAt) > Date.now()) return NextResponse.json({ ok: false, error: "Повторная активация доступна через 10 минут после предыдущей", status }, { status: 409 });
    if (status.remaining <= 0) return NextResponse.json({ ok: false, error: "Double Down на этой неделе закончились", status }, { status: 409 });

    const { error } = await supabaseAdmin.rpc("activate_owned_double_down", { target_player: playerId });
    if (error?.code === "P0001") return NextResponse.json({ ok: false, error: "Ещё не прошло 10 минут после активации или заряды закончились", status: await getStatus(playerId) }, { status: 409 });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, status: await getStatus(playerId), message: "Double Down активирован. Система привяжет его к матчу, начавшемуся не более 10 минут назад." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

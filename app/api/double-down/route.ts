import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BASE_DOUBLE_DOWNS = 5;
const PENDING_TTL_MS = 3 * 60 * 60 * 1000;

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const saturday = 6;
  const utcDay = d.getUTCDay();
  let daysBack = (utcDay - saturday + 7) % 7;
  const todayBoundary = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 5, 0, 0, 0));
  if (d.getTime() < todayBoundary.getTime()) daysBack += 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 5, 0, 0, 0));
}

async function expireStalePending(playerId: number) {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
  await supabaseAdmin.from("double_down_activations").update({ status: "expired" }).eq("player_id", playerId).eq("status", "pending").lt("activated_at", cutoff);
}

async function getStatus(playerId: number) {
  const weekStart = getWeekStart();
  const weekStartIso = weekStart.toISOString();
  await expireStalePending(playerId);

  const [{ data: bonuses, error: bonusError }, { data: activations, error: activationError }, { data: latest, error: latestError }] = await Promise.all([
    supabaseAdmin.from("double_down_bonuses").select("id,source_match_id,reason").eq("player_id", playerId).eq("week_start", weekStartIso),
    supabaseAdmin.from("double_down_activations").select("id,activated_at,status,match_id").eq("player_id", playerId).eq("week_start", weekStartIso).order("activated_at", { ascending: false }),
    supabaseAdmin.from("double_down_activations").select("activated_at").eq("player_id", playerId).order("activated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (bonusError) throw new Error(bonusError.message);
  if (activationError) throw new Error(activationError.message);
  if (latestError) throw new Error(latestError.message);

  const bonusCount = bonuses?.length ?? 0;
  const activeRows = (activations ?? []).filter((row) => row.status === "pending" || row.status === "used");
  const pending = (activations ?? []).find((row) => row.status === "pending") ?? null;
  const total = BASE_DOUBLE_DOWNS + bonusCount;
  const remaining = Math.max(0, total - activeRows.length);
  const usedRows = (activations ?? []).filter((row) => row.status === "used" && row.match_id != null);
  const usedMatchIds = usedRows.map((row) => Number(row.match_id));

  let extraRating = 0;
  let extraWon = 0;
  let extraLost = 0;
  if (usedMatchIds.length) {
    const { data: ddMatches, error: matchError } = await supabaseAdmin.from("matches").select("match_id,rating_delta").eq("player_id", playerId).in("match_id", usedMatchIds);
    if (matchError) throw new Error(matchError.message);
    for (const match of ddMatches ?? []) {
      const fullDelta = Number(match.rating_delta) || 0;
      const extra = fullDelta / 2;
      extraRating += extra;
      if (extra > 0) extraWon += extra;
      if (extra < 0) extraLost += Math.abs(extra);
    }
  }

  const nextReset = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    serverNow: new Date().toISOString(),
    lastActivatedAt: latest?.activated_at ?? null,
    nextActivationAt: latest ? new Date(new Date(latest.activated_at).getTime() + 10 * 60 * 1000).toISOString() : null,
    pendingCount: activeRows.filter(row => row.status === "pending").length,
    weekStart: weekStartIso,
    nextReset: nextReset.toISOString(),
    base: BASE_DOUBLE_DOWNS,
    bonuses: bonusCount,
    total,
    used: usedRows.length,
    pending: pending ? { id: pending.id, activatedAt: pending.activated_at } : null,
    remaining,
    extraRating,
    extraWon,
    extraLost,
  };
}

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

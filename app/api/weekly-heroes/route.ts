import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentAccount, privateHeaders, requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const saturday = 6;
  let daysBack = (d.getUTCDay() - saturday + 7) % 7;
  let boundary = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 5, 0, 0, 0));
  if (d.getTime() < boundary.getTime()) {
    daysBack += 7;
    boundary = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 5, 0, 0, 0));
  }
  return boundary;
}

function parsePlayerId(value: unknown) {
  const playerId = Number(value);
  return Number.isSafeInteger(playerId) && playerId > 0 ? playerId : null;
}

async function readStatus(playerId: number, req?: NextRequest) {
  const weekStart = getWeekStart();
  const weekStartIso = weekStart.toISOString();
  const nextReset = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("weekly_hero_selections")
    .select("status,hero_ids,selected_at,skipped_at")
    .eq("player_id", playerId)
    .eq("week_start", weekStartIso)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let owner = false;
  if (req) {
    const account = await currentAccount(req);
    owner = Number(account?.player_id) === playerId;
  }

  return {
    weekStart: weekStartIso,
    nextReset,
    owner,
    status: data?.status ?? "not_started",
    heroIds: Array.isArray(data?.hero_ids) ? data.hero_ids.map(Number) : [],
    selectedAt: data?.selected_at ?? null,
    skippedAt: data?.skipped_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const playerId = parsePlayerId(req.nextUrl.searchParams.get("playerId"));
  if (!playerId) return NextResponse.json({ ok: false, error: "Некорректный игрок" }, { status: 400, headers: privateHeaders });
  try {
    return NextResponse.json({ ok: true, status: await readStatus(playerId, req) }, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(req: NextRequest) {
  let body: { playerId?: number; action?: string; heroIds?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400, headers: privateHeaders });
  }

  const playerId = parsePlayerId(body.playerId);
  if (!playerId) return NextResponse.json({ ok: false, error: "Некорректный игрок" }, { status: 400, headers: privateHeaders });
  const ownerError = await requireOwner(req, playerId);
  if (ownerError) return ownerError;

  const weekStartIso = getWeekStart().toISOString();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("weekly_hero_selections")
    .select("status")
    .eq("player_id", playerId)
    .eq("week_start", weekStartIso)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500, headers: privateHeaders });
  if (existing?.status === "selected") {
    return NextResponse.json({ ok: false, error: "Герои на эту игровую неделю уже выбраны и изменить их нельзя." }, { status: 409, headers: privateHeaders });
  }

  try {
    if (body.action === "skip") {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from("weekly_hero_selections").upsert({
        player_id: playerId,
        week_start: weekStartIso,
        status: "skipped",
        hero_ids: [],
        selected_at: null,
        skipped_at: now,
        updated_at: now,
      }, { onConflict: "player_id,week_start" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status: await readStatus(playerId, req), message: "Выбор пропущен. До выбора четырёх героев матчи не идут в зачёт." }, { headers: privateHeaders });
    }

    if (body.action === "select") {
      const heroIds = Array.isArray(body.heroIds) ? [...new Set(body.heroIds.map(Number))] : [];
      if (heroIds.length !== 4 || heroIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        return NextResponse.json({ ok: false, error: "Нужно выбрать ровно 4 разных героя." }, { status: 400, headers: privateHeaders });
      }
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from("weekly_hero_selections").upsert({
        player_id: playerId,
        week_start: weekStartIso,
        status: "selected",
        hero_ids: heroIds,
        selected_at: now,
        skipped_at: null,
        updated_at: now,
      }, { onConflict: "player_id,week_start" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status: await readStatus(playerId, req), message: "Герои игровой недели зафиксированы." }, { headers: privateHeaders });
    }

    return NextResponse.json({ ok: false, error: "Неизвестное действие" }, { status: 400, headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: privateHeaders });
  }
}

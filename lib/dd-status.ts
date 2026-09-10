import "server-only";
import { supabaseAdmin } from "./supabase-admin";
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

export async function getStatus(playerId: number) {
  const weekStart = getWeekStart();
  const weekStartIso = weekStart.toISOString();
  await expireStalePending(playerId);

  const [{ data: bonuses, error: bonusError }, { data: activations, error: activationError }, { data: latest, error: latestError }, { data: adjustments, error: adjustmentError }] = await Promise.all([
    supabaseAdmin.from("double_down_bonuses").select("id,source_match_id,reason").eq("player_id", playerId).eq("week_start", weekStartIso),
    supabaseAdmin.from("double_down_activations").select("id,activated_at,status,match_id").eq("player_id", playerId).eq("week_start", weekStartIso).order("activated_at", { ascending: false }),
    supabaseAdmin.from("double_down_activations").select("activated_at").eq("player_id", playerId).order("activated_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("dd_admin_adjustments").select("amount").eq("player_id", playerId).eq("week_start", weekStartIso),
  ]);

  if (bonusError) throw new Error(bonusError.message);
  if (activationError) throw new Error(activationError.message);
  if (adjustmentError) throw new Error(adjustmentError.message);
  if (latestError) throw new Error(latestError.message);

  const bonusCount = bonuses?.length ?? 0;
  const activeRows = (activations ?? []).filter((row) => row.status === "pending" || row.status === "used");
  const pending = (activations ?? []).find((row) => row.status === "pending") ?? null;
  const adminAdjustment = (adjustments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const total = Math.max(0, BASE_DOUBLE_DOWNS + bonusCount + adminAdjustment);
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
    adminAdjustment,
    total,
    used: usedRows.length,
    pending: pending ? { id: pending.id, activatedAt: pending.activated_at } : null,
    remaining,
    extraRating,
    extraWon,
    extraLost,
  };
}

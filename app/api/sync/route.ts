import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type OpenDotaMatch = {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  game_mode?: number;
  hero_id?: number;
  start_time?: number;
};

type Player = {
  id: number;
  name: string;
  account_id: number;
  tracking_from: string | null;
};

const PLACEMENT_MATCHES = 5;
const CONCURRENCY = 3;

function didPlayerWin(match: OpenDotaMatch) {
  const isRadiant = match.player_slot < 128;
  return isRadiant === match.radiant_win;
}

async function fetchOpenDotaMatches(accountId: number) {
  const url = `https://api.opendota.com/api/players/${accountId}/matches?game_mode=23&significant=0&limit=100`;
  let lastStatus = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      lastStatus = response.status;

      if (response.ok) {
        return { matches: (await response.json()) as OpenDotaMatch[], error: null };
      }

      if (response.status !== 429 && response.status < 500) break;
    } catch {
      lastStatus = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  return {
    matches: null,
    error: lastStatus ? `OpenDota HTTP ${lastStatus}` : "OpenDota request timed out",
  };
}

async function syncPlayer(player: Player) {
  const trackingFrom = player.tracking_from
    ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
    : 0;

  const result = await fetchOpenDotaMatches(player.account_id);
  if (!result.matches) {
    return { player: player.name, ok: false, error: result.error };
  }

  const allTurboMatches = result.matches
    .filter((match) => match.game_mode === 23)
    .filter((match) => (match.start_time ?? 0) >= trackingFrom)
    .sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));

  const leagueMatches = allTurboMatches.slice(PLACEMENT_MATCHES);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("matches")
    .select("match_id")
    .eq("player_id", player.id);

  if (existingError) {
    return {
      player: player.name,
      ok: false,
      error: `Existing matches lookup failed: ${existingError.message}`,
    };
  }

  const existingMatchIds = new Set(
    (existingRows ?? []).map((row) => Number(row.match_id)),
  );
  const newMatches = leagueMatches.filter(
    (match) => !existingMatchIds.has(match.match_id),
  );

  let added = 0;
  const errors: string[] = [];

  for (const match of newMatches) {
    const won = didPlayerWin(match);
    const { data: applied, error: rpcError } = await supabaseAdmin.rpc(
      "apply_turbo_match",
      {
        p_match_id: match.match_id,
        p_player_id: player.id,
        p_start_time: match.start_time
          ? new Date(match.start_time * 1000).toISOString()
          : null,
        p_hero_id: match.hero_id ?? null,
        p_won: won,
        p_raw: match,
      },
    );

    if (rpcError) errors.push(`${match.match_id}: ${rpcError.message}`);
    else if (applied === true) added += 1;
  }

  return {
    player: player.name,
    ok: errors.length === 0,
    turboAfterStart: allTurboMatches.length,
    placementSkipped: Math.min(PLACEMENT_MATCHES, allTurboMatches.length),
    found: leagueMatches.length,
    alreadyImported: leagueMatches.length - newMatches.length,
    newFound: newMatches.length,
    added,
    errors,
  };
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authorization = req.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id,name,account_id,tracking_from")
    .eq("active", true)
    .order("id");

  if (error) {
    return NextResponse.json(
      { ok: false, stage: "players", error: error.message },
      { status: 500 },
    );
  }

  const players = (data ?? []) as Player[];
  const summary: Awaited<ReturnType<typeof syncPlayer>>[] = [];

  for (let i = 0; i < players.length; i += CONCURRENCY) {
    const batch = players.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(syncPlayer));
    summary.push(...batchResults);
  }

  return NextResponse.json({ ok: true, summary }, { status: 200 });
}

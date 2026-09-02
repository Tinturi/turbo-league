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

function didPlayerWin(match: OpenDotaMatch) {
  const isRadiant = match.player_slot < 128;
  return isRadiant === match.radiant_win;
}

export const dynamic = "force-dynamic";

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
  const summary = [];

  for (const player of players) {
    const trackingFrom = player.tracking_from
      ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
      : 0;

    const url = `https://api.opendota.com/api/players/${player.account_id}/matches?game_mode=23&significant=0&limit=100`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      summary.push({
        player: player.name,
        ok: false,
        error: `OpenDota HTTP ${response.status}`,
      });
      continue;
    }

    const matches = (await response.json()) as OpenDotaMatch[];
    const allTurboMatches = matches
      .filter((match) => match.game_mode === 23)
      .filter((match) => (match.start_time ?? 0) >= trackingFrom)
      .sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));

    // The first five Turbo matches after tracking_from are placement matches.
    // They are intentionally excluded from league W/L and rating calculations.
    const leagueMatches = allTurboMatches.slice(PLACEMENT_MATCHES);

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const match of leagueMatches) {
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

      if (rpcError) {
        errors.push(`${match.match_id}: ${rpcError.message}`);
      } else if (applied === true) {
        added += 1;
      } else {
        skipped += 1;
      }
    }

    summary.push({
      player: player.name,
      ok: errors.length === 0,
      turboAfterStart: allTurboMatches.length,
      placementSkipped: Math.min(PLACEMENT_MATCHES, allTurboMatches.length),
      found: leagueMatches.length,
      added,
      skipped,
      errors,
    });
  }

  return NextResponse.json({ ok: true, summary }, { status: 200 });
}

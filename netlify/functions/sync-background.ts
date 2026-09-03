import { createClient } from "@supabase/supabase-js";

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

async function fetchOpenDotaMatches(accountId: number) {
  const url = `https://api.opendota.com/api/players/${accountId}/matches?game_mode=23&significant=0&limit=100`;
  let lastStatus = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      lastStatus = response.status;

      if (response.ok) {
        return { matches: (await response.json()) as OpenDotaMatch[], error: null };
      }

      if (response.status !== 429 && response.status < 500) break;
    } catch {
      lastStatus = 0;
    }

    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  return {
    matches: null,
    error: lastStatus ? `OpenDota HTTP ${lastStatus}` : "OpenDota request timed out",
  };
}

export default async (req: Request) => {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!cronSecret || !supabaseUrl || !supabaseSecretKey) {
    console.error("Background sync environment variables are not configured");
    return;
  }

  const authorization = req.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized background sync request");
    return;
  }

  const url = new URL(req.url);
  const playerId = Number(url.searchParams.get("playerId"));

  if (!Number.isInteger(playerId) || playerId <= 0) {
    console.error("Background sync missing valid playerId");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: playerRow, error: playerError } = await supabaseAdmin
      .from("players")
      .select("id,name,account_id,tracking_from")
      .eq("id", playerId)
      .eq("active", true)
      .maybeSingle();

    if (playerError) {
      console.error(`Player ${playerId} lookup failed: ${playerError.message}`);
      return;
    }

    if (!playerRow) {
      console.log(`Player ${playerId} is missing or inactive`);
      return;
    }

    const player = playerRow as Player;
    const trackingFrom = player.tracking_from
      ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
      : 0;

    console.log(`Sync start: ${player.name} (${player.account_id})`);

    const result = await fetchOpenDotaMatches(player.account_id);
    if (!result.matches) {
      console.error(`Sync failed: ${player.name}: ${result.error}`);
      return;
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
      console.error(`Sync failed: ${player.name}: ${existingError.message}`);
      return;
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
      const { data: applied, error: rpcError } = await supabaseAdmin.rpc(
        "apply_turbo_match",
        {
          p_match_id: match.match_id,
          p_player_id: player.id,
          p_start_time: match.start_time
            ? new Date(match.start_time * 1000).toISOString()
            : null,
          p_hero_id: match.hero_id ?? null,
          p_won: didPlayerWin(match),
          p_raw: match,
        },
      );

      if (rpcError) errors.push(`${match.match_id}: ${rpcError.message}`);
      else if (applied === true) added += 1;
    }

    console.log(
      `Sync completed: ${player.name}; turbo=${allTurboMatches.length}; rated=${leagueMatches.length}; new=${newMatches.length}; added=${added}; errors=${errors.length}${errors.length ? `; ${errors.join(" | ")}` : ""}`,
    );
  } catch (error) {
    console.error(`Player ${playerId} background sync crashed`, error);
  }
};

export const config = {
  background: true,
  path: "/api/background-sync",
};

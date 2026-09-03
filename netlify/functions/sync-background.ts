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
const CONCURRENCY = 5;
const OPENDOTA_TIMEOUT_MS = 8000;
const OPENDOTA_ATTEMPTS = 2;

function didPlayerWin(match: OpenDotaMatch) {
  const isRadiant = match.player_slot < 128;
  return isRadiant === match.radiant_win;
}

async function fetchOpenDotaMatches(accountId: number) {
  const url = `https://api.opendota.com/api/players/${accountId}/matches?game_mode=23&significant=0&limit=100`;
  let lastStatus = 0;

  for (let attempt = 0; attempt < OPENDOTA_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "Turbo-League-S2/1.0",
        },
        signal: AbortSignal.timeout(OPENDOTA_TIMEOUT_MS),
      });
      lastStatus = response.status;

      if (response.ok) {
        return { matches: (await response.json()) as OpenDotaMatch[], error: null };
      }

      if (response.status !== 429 && response.status < 500) break;
    } catch {
      lastStatus = 0;
    }

    if (attempt + 1 < OPENDOTA_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 750));
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

  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function syncPlayer(player: Player) {
    const trackingFrom = player.tracking_from
      ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
      : 0;

    const result = await fetchOpenDotaMatches(player.account_id);
    if (!result.matches) {
      console.warn(`${player.name}: ${result.error}`);
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

    const playerSummary = {
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

    console.log(`Player sync: ${JSON.stringify(playerSummary)}`);
    return playerSummary;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("id,name,account_id,tracking_from")
      .eq("active", true)
      .order("id");

    if (error) {
      console.error(`Background sync players lookup failed: ${error.message}`);
      return;
    }

    const players = (data ?? []) as Player[];
    const summary: Awaited<ReturnType<typeof syncPlayer>>[] = [];

    for (let i = 0; i < players.length; i += CONCURRENCY) {
      const batch = players.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(syncPlayer));
      summary.push(...batchResults);
    }

    const addedTotal = summary.reduce(
      (total, item) => total + ("added" in item ? Number(item.added ?? 0) : 0),
      0,
    );
    const failedTotal = summary.filter((item) => item.ok === false).length;

    console.log(
      `Turbo League background sync completed: players=${players.length}, added=${addedTotal}, failed=${failedTotal}; ${JSON.stringify(summary)}`,
    );
  } catch (error) {
    console.error("Turbo League background sync failed", error);
  }
};

export const config = {
  background: true,
  path: "/api/background-sync",
};

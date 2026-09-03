import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseSecretKey) throw new Error("Missing SUPABASE_SECRET_KEY");

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PLACEMENT_MATCHES = 5;
const CONCURRENCY = 3;
const OPENDOTA_TIMEOUT_MS = 20000;
const OPENDOTA_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function didPlayerWin(match) {
  const isRadiant = Number(match.player_slot) < 128;
  return isRadiant === Boolean(match.radiant_win);
}

async function fetchOpenDotaMatches(accountId) {
  const url = `https://api.opendota.com/api/players/${accountId}/matches?game_mode=23&significant=0&limit=100`;
  let lastError = "Unknown OpenDota error";

  for (let attempt = 1; attempt <= OPENDOTA_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "turbo-league-github-sync/1.0",
        },
        signal: AbortSignal.timeout(OPENDOTA_TIMEOUT_MS),
      });

      if (response.ok) {
        const matches = await response.json();
        return matches;
      }

      lastError = `OpenDota HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < OPENDOTA_ATTEMPTS) {
      await sleep(1500 * attempt);
    }
  }

  throw new Error(lastError);
}

async function syncPlayer(player) {
  console.log(`\n▶ ${player.name} (${player.account_id})`);

  const trackingFrom = player.tracking_from
    ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
    : 0;

  const rawMatches = await fetchOpenDotaMatches(player.account_id);

  const allTurboMatches = rawMatches
    .filter((match) => Number(match.game_mode) === 23)
    .filter((match) => Number(match.start_time ?? 0) >= trackingFrom)
    .sort((a, b) => Number(a.start_time ?? 0) - Number(b.start_time ?? 0));

  const leagueMatches = allTurboMatches.slice(PLACEMENT_MATCHES);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("matches")
    .select("match_id")
    .eq("player_id", player.id);

  if (existingError) {
    throw new Error(`Supabase existing matches: ${existingError.message}`);
  }

  const existingMatchIds = new Set(
    (existingRows ?? []).map((row) => Number(row.match_id)),
  );

  const newMatches = leagueMatches.filter(
    (match) => !existingMatchIds.has(Number(match.match_id)),
  );

  let added = 0;

  for (const match of newMatches) {
    const { data: applied, error: rpcError } = await supabaseAdmin.rpc(
      "apply_turbo_match",
      {
        p_match_id: Number(match.match_id),
        p_player_id: player.id,
        p_start_time: match.start_time
          ? new Date(Number(match.start_time) * 1000).toISOString()
          : null,
        p_hero_id: match.hero_id == null ? null : Number(match.hero_id),
        p_won: didPlayerWin(match),
        p_raw: match,
      },
    );

    if (rpcError) {
      throw new Error(`Match ${match.match_id}: ${rpcError.message}`);
    }

    if (applied === true) added += 1;
  }

  const result = {
    player: player.name,
    turboAfterStart: allTurboMatches.length,
    placementSkipped: Math.min(PLACEMENT_MATCHES, allTurboMatches.length),
    ratedMatchesFound: leagueMatches.length,
    alreadyImported: leagueMatches.length - newMatches.length,
    newFound: newMatches.length,
    added,
  };

  console.log(`✓ ${JSON.stringify(result)}`);
  return result;
}

async function main() {
  console.log(`Turbo League sync started: ${new Date().toISOString()}`);

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id,name,account_id,tracking_from")
    .eq("active", true)
    .order("id");

  if (error) throw new Error(`Players lookup failed: ${error.message}`);

  const players = data ?? [];
  console.log(`Active players: ${players.length}`);

  const results = [];
  const failures = [];

  for (let i = 0; i < players.length; i += CONCURRENCY) {
    const batch = players.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(syncPlayer));

    settled.forEach((entry, index) => {
      const player = batch[index];
      if (entry.status === "fulfilled") {
        results.push(entry.value);
      } else {
        const message = entry.reason instanceof Error
          ? entry.reason.message
          : String(entry.reason);
        failures.push({ player: player.name, error: message });
        console.error(`✗ ${player.name}: ${message}`);
      }
    });
  }

  const addedTotal = results.reduce((sum, item) => sum + item.added, 0);
  console.log(`\nTurbo League sync finished: added=${addedTotal}, success=${results.length}, failed=${failures.length}`);

  if (failures.length > 0) {
    console.error(`Failures: ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  }
}

await main();

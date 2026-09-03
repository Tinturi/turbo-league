import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseSecretKey) throw new Error("Missing SUPABASE_SECRET_KEY");

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEASON_START_ISO = "2026-09-03T20:18:00.000Z";
const SEASON_START_UNIX = Math.floor(new Date(SEASON_START_ISO).getTime() / 1000);
const START_RATING = 0;
const CALIBRATION_MATCHES = 5;
const CALIBRATION_DELTA = 50;
const REGULAR_DELTA = 25;
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

function deltaForMatch(won, seasonMatchIndex) {
  const magnitude = seasonMatchIndex < CALIBRATION_MATCHES ? CALIBRATION_DELTA : REGULAR_DELTA;
  return won ? magnitude : -magnitude;
}

async function fetchOpenDotaMatches(accountId) {
  const url = `https://api.opendota.com/api/players/${accountId}/matches?game_mode=23&significant=0&limit=100`;
  let lastError = "Unknown OpenDota error";

  for (let attempt = 1; attempt <= OPENDOTA_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "turbo-league-github-sync/1.0" },
        signal: AbortSignal.timeout(OPENDOTA_TIMEOUT_MS),
      });

      if (response.ok) return await response.json();
      lastError = `OpenDota HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < OPENDOTA_ATTEMPTS) await sleep(1500 * attempt);
  }

  throw new Error(lastError);
}

async function syncPlayer(player) {
  console.log(`\n▶ ${player.name} (${player.account_id})`);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("matches")
    .select("match_id,start_time,won,rating_delta,rating_after")
    .eq("player_id", player.id)
    .gte("start_time", SEASON_START_ISO)
    .order("start_time", { ascending: true });

  if (existingError) throw new Error(`Supabase existing matches: ${existingError.message}`);

  const existingSeasonMatches = existingRows ?? [];
  let currentRating = START_RATING;
  let wins = 0;
  let losses = 0;

  for (let index = 0; index < existingSeasonMatches.length; index += 1) {
    const row = existingSeasonMatches[index];
    const won = Boolean(row.won);
    const expectedDelta = deltaForMatch(won, index);
    currentRating += expectedDelta;
    if (won) wins += 1; else losses += 1;

    if (Number(row.rating_delta) !== expectedDelta || Number(row.rating_after) !== currentRating) {
      const { error: repairError } = await supabaseAdmin
        .from("matches")
        .update({ rating_delta: expectedDelta, rating_after: currentRating })
        .eq("match_id", row.match_id)
        .eq("player_id", player.id);
      if (repairError) throw new Error(`Repair match ${row.match_id}: ${repairError.message}`);
    }
  }

  const rawMatches = await fetchOpenDotaMatches(player.account_id);
  const allTurboMatches = rawMatches
    .filter((match) => Number(match.game_mode) === 23)
    .filter((match) => Number(match.start_time ?? 0) >= SEASON_START_UNIX)
    .sort((a, b) => Number(a.start_time ?? 0) - Number(b.start_time ?? 0));

  const existingMatchIds = new Set(existingSeasonMatches.map((row) => Number(row.match_id)));
  const newMatches = allTurboMatches.filter((match) => !existingMatchIds.has(Number(match.match_id)));

  let added = 0;
  for (const match of newMatches) {
    const won = didPlayerWin(match);
    const seasonMatchIndex = existingSeasonMatches.length + added;
    const ratingDelta = deltaForMatch(won, seasonMatchIndex);
    currentRating += ratingDelta;

    const { error: insertError } = await supabaseAdmin.from("matches").insert({
      match_id: Number(match.match_id),
      player_id: player.id,
      start_time: match.start_time ? new Date(Number(match.start_time) * 1000).toISOString() : null,
      hero_id: match.hero_id == null ? null : Number(match.hero_id),
      won,
      rating_delta: ratingDelta,
      rating_after: currentRating,
      raw: match,
    });

    if (insertError) throw new Error(`Match ${match.match_id}: ${insertError.message}`);
    if (won) wins += 1; else losses += 1;
    added += 1;
  }

  const { error: playerUpdateError } = await supabaseAdmin
    .from("players")
    .update({ rating: currentRating, wins, losses, tracking_from: SEASON_START_ISO })
    .eq("id", player.id);

  if (playerUpdateError) throw new Error(`Player update: ${playerUpdateError.message}`);

  const totalSeasonMatches = existingSeasonMatches.length + added;
  const result = {
    player: player.name,
    season: 3,
    startRating: START_RATING,
    turboAfterStart: allTurboMatches.length,
    seasonMatches: totalSeasonMatches,
    calibrationPlayed: Math.min(totalSeasonMatches, CALIBRATION_MATCHES),
    regularPlayed: Math.max(0, totalSeasonMatches - CALIBRATION_MATCHES),
    newFound: newMatches.length,
    added,
    rating: currentRating,
    wins,
    losses,
  };

  console.log(`✓ ${JSON.stringify(result)}`);
  return result;
}

async function main() {
  console.log(`Turbo League Season 3 sync started: ${new Date().toISOString()}`);

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id,name,account_id,rating")
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
      if (entry.status === "fulfilled") results.push(entry.value);
      else {
        const message = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
        failures.push({ player: player.name, error: message });
        console.error(`✗ ${player.name}: ${message}`);
      }
    });
  }

  const addedTotal = results.reduce((sum, item) => sum + item.added, 0);
  console.log(`\nTurbo League Season 3 sync finished: added=${addedTotal}, success=${results.length}, failed=${failures.length}`);

  if (failures.length > 0) {
    console.error(`Failures: ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  }
}

await main();

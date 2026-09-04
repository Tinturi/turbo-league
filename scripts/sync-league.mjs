import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseSecretKey) throw new Error("Missing SUPABASE_SECRET_KEY");
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const SEASON_START_ISO = "2026-09-03T20:18:00.000Z";
const SEASON_START_UNIX = Math.floor(new Date(SEASON_START_ISO).getTime() / 1000);
const START_RATING = 0;
const CALIBRATION_MATCHES = 5;
const CALIBRATION_DELTA = 50;
const REGULAR_DELTA = 25;
const DOUBLE_DOWN_WINDOW_MS = 10 * 60 * 1000;
const DOUBLE_DOWN_PENDING_TTL_MS = 3 * 60 * 60 * 1000;
const CONCURRENCY = 3;
const OPENDOTA_TIMEOUT_MS = 20000;
const OPENDOTA_ATTEMPTS = 3;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function didPlayerWin(match) { return (Number(match.player_slot) < 128) === Boolean(match.radiant_win); }
function deltaForMatch(won, seasonMatchIndex, doubleDown = false) {
  const magnitude = seasonMatchIndex < CALIBRATION_MATCHES ? CALIBRATION_DELTA : REGULAR_DELTA;
  return won ? magnitude * (doubleDown ? 2 : 1) : -magnitude * (doubleDown ? 2 : 1);
}
function getWeekStart(date = new Date()) {
  const d = new Date(date); const saturday = 6;
  let daysBack = (d.getUTCDay() - saturday + 7) % 7;
  let boundary = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 5, 0, 0, 0));
  if (d.getTime() < boundary.getTime()) { daysBack += 7; boundary = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 5, 0, 0, 0)); }
  return boundary;
}
function filterFirstHeroMatchPerWeek(matches) {
  const seen = new Set(); const eligible = []; const ignored = [];
  for (const match of matches) {
    const heroId = match.hero_id == null ? null : Number(match.hero_id); const startTime = Number(match.start_time ?? 0);
    if (!heroId || !startTime) { eligible.push(match); continue; }
    const key = `${getWeekStart(new Date(startTime * 1000)).toISOString()}:${heroId}`;
    if (seen.has(key)) ignored.push(match); else { seen.add(key); eligible.push(match); }
  }
  return { eligible, ignored };
}
async function fetchOpenDotaMatches(accountId) {
  const url = `https://api.opendota.com/api/players/${accountId}/matches?game_mode=23&significant=0&limit=100`;
  let lastError = "Unknown OpenDota error";
  for (let attempt = 1; attempt <= OPENDOTA_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "turbo-league-github-sync/1.0" }, signal: AbortSignal.timeout(OPENDOTA_TIMEOUT_MS) });
      if (response.ok) return await response.json();
      lastError = `OpenDota HTTP ${response.status}`; if (response.status !== 429 && response.status < 500) break;
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    if (attempt < OPENDOTA_ATTEMPTS) await sleep(1500 * attempt);
  }
  throw new Error(lastError);
}
async function refundIgnoredDoubleDowns(playerId, ignoredMatchIds) {
  if (!ignoredMatchIds.length) return;
  const { error } = await supabaseAdmin.from("double_down_activations").update({ status: "expired" }).eq("player_id", playerId).eq("status", "used").in("match_id", ignoredMatchIds);
  if (error) throw new Error(`Refund ignored Double Down: ${error.message}`);
}
async function removeIgnoredBonuses(playerId, ignoredMatchIds) {
  if (!ignoredMatchIds.length) return;
  const { error } = await supabaseAdmin.from("double_down_bonuses").delete().eq("player_id", playerId).in("source_match_id", ignoredMatchIds);
  if (error) throw new Error(`Remove ignored DD bonuses: ${error.message}`);
}
async function removeIgnoredStoredMatches(playerId, ignoredMatchIds) {
  if (!ignoredMatchIds.length) return 0;
  const { data, error } = await supabaseAdmin.from("matches").delete().eq("player_id", playerId).in("match_id", ignoredMatchIds).select("match_id");
  if (error) throw new Error(`Remove repeated hero matches: ${error.message}`);
  return data?.length ?? 0;
}

async function attachDoubleDowns(playerId, allTurboMatches, eligibleMatches) {
  const { data: activationRows, error } = await supabaseAdmin.from("double_down_activations").select("id,activated_at,status,match_id,week_start").eq("player_id", playerId).order("activated_at", { ascending: true });
  if (error) throw new Error(`Double Down lookup: ${error.message}`);
  const eligibleIds = new Set(eligibleMatches.map((match) => Number(match.match_id)));
  const activations = activationRows ?? [];
  const usedMatchIds = new Set(activations.filter((row) => row.status === "used" && row.match_id != null && eligibleIds.has(Number(row.match_id))).map((row) => Number(row.match_id)));

  for (const activation of activations.filter((row) => row.status === "pending")) {
    const activatedMs = new Date(activation.activated_at).getTime();
    const playedMatch = allTurboMatches.find((match) => {
      const startMs = Number(match.start_time ?? 0) * 1000;
      const durationMs = Math.max(0, Number(match.duration ?? 0)) * 1000;
      return startMs <= activatedMs && activatedMs <= startMs + durationMs;
    });

    if (playedMatch) {
      const matchId = Number(playedMatch.match_id);
      const startMs = Number(playedMatch.start_time ?? 0) * 1000;
      const inTime = activatedMs <= startMs + DOUBLE_DOWN_WINDOW_MS;
      const eligible = eligibleIds.has(matchId);
      const available = !usedMatchIds.has(matchId);

      if (inTime && eligible && available) {
        const { error: updateError } = await supabaseAdmin.from("double_down_activations").update({ status: "used", match_id: matchId }).eq("id", activation.id).eq("status", "pending");
        if (updateError) throw new Error(`Double Down attach ${activation.id}: ${updateError.message}`);
        usedMatchIds.add(matchId);
        console.log(`  🔥 Double Down -> match ${matchId}`);
      } else {
        const reason = !inTime ? "нажат позже 10 минут" : !eligible ? "матч не идёт в зачёт" : "матч уже использован для DD";
        const { error: expireError } = await supabaseAdmin.from("double_down_activations").update({ status: "expired" }).eq("id", activation.id).eq("status", "pending");
        if (expireError) throw new Error(`Double Down refund ${activation.id}: ${expireError.message}`);
        console.log(`  ↩ Double Down ${activation.id} refunded: ${reason}, match ${matchId}`);
      }
      continue;
    }

    if (Date.now() - activatedMs > DOUBLE_DOWN_PENDING_TTL_MS) {
      const { error: expireError } = await supabaseAdmin.from("double_down_activations").update({ status: "expired" }).eq("id", activation.id).eq("status", "pending");
      if (expireError) throw new Error(`Double Down expire ${activation.id}: ${expireError.message}`);
      console.log(`  ↩ Double Down ${activation.id} expired by fallback TTL and refunded`);
    }
  }
  return usedMatchIds;
}

async function grantLossStreakBonuses(playerId, eligibleMatches) {
  const weekStart = getWeekStart(); const weekStartUnix = Math.floor(weekStart.getTime() / 1000);
  const weeklyMatches = eligibleMatches.filter((match) => Number(match.start_time ?? 0) >= weekStartUnix);
  let consecutiveLosses = 0; let granted = 0;
  for (const match of weeklyMatches) {
    if (didPlayerWin(match)) { consecutiveLosses = 0; continue; }
    consecutiveLosses += 1; if (consecutiveLosses % 3 !== 0) continue;
    const { error } = await supabaseAdmin.from("double_down_bonuses").upsert({ player_id: playerId, week_start: weekStart.toISOString(), source_match_id: Number(match.match_id), reason: "three_losses" }, { onConflict: "player_id,source_match_id", ignoreDuplicates: true });
    if (error) throw new Error(`Double Down bonus ${match.match_id}: ${error.message}`); granted += 1;
  }
  return { weeklyMatches, bonusMilestones: granted };
}

async function syncPlayer(player) {
  console.log(`\n▶ ${player.name} (${player.account_id})`);
  const rawMatches = await fetchOpenDotaMatches(player.account_id);
  const allTurboMatches = rawMatches.filter((match) => Number(match.game_mode) === 23).filter((match) => Number(match.start_time ?? 0) >= SEASON_START_UNIX).sort((a, b) => Number(a.start_time ?? 0) - Number(b.start_time ?? 0));
  const { eligible: eligibleMatches, ignored: ignoredMatches } = filterFirstHeroMatchPerWeek(allTurboMatches);
  const ignoredMatchIds = ignoredMatches.map((match) => Number(match.match_id));
  if (ignoredMatchIds.length) { await refundIgnoredDoubleDowns(player.id, ignoredMatchIds); await removeIgnoredBonuses(player.id, ignoredMatchIds); }
  const removedStored = await removeIgnoredStoredMatches(player.id, ignoredMatchIds);
  if (ignoredMatches.length) console.log(`  🚫 Повторы героев проигнорированы: ${ignoredMatches.map((m) => `${m.match_id}(hero ${m.hero_id})`).join(", ")}`);

  const doubleDownMatchIds = await attachDoubleDowns(player.id, allTurboMatches, eligibleMatches);
  let currentRating = START_RATING; let wins = 0; let losses = 0; let added = 0; let repaired = 0;
  const { data: existingRows, error: existingError } = await supabaseAdmin.from("matches").select("match_id,start_time,hero_id,won,rating_delta,rating_after").eq("player_id", player.id).gte("start_time", SEASON_START_ISO);
  if (existingError) throw new Error(`Supabase existing matches: ${existingError.message}`);
  const existingById = new Map((existingRows ?? []).map((row) => [Number(row.match_id), row]));

  for (let index = 0; index < eligibleMatches.length; index += 1) {
    const match = eligibleMatches[index]; const matchId = Number(match.match_id); const won = didPlayerWin(match);
    const ratingDelta = deltaForMatch(won, index, doubleDownMatchIds.has(matchId)); currentRating += ratingDelta; if (won) wins += 1; else losses += 1;
    const expected = { match_id: matchId, player_id: player.id, start_time: match.start_time ? new Date(Number(match.start_time) * 1000).toISOString() : null, hero_id: match.hero_id == null ? null : Number(match.hero_id), won, rating_delta: ratingDelta, rating_after: currentRating, raw: match };
    const existing = existingById.get(matchId);
    if (!existing) { const { error: insertError } = await supabaseAdmin.from("matches").insert(expected); if (insertError) throw new Error(`Match ${matchId}: ${insertError.message}`); added += 1; }
    else if (Number(existing.rating_delta) !== ratingDelta || Number(existing.rating_after) !== currentRating || Boolean(existing.won) !== won || Number(existing.hero_id ?? 0) !== Number(expected.hero_id ?? 0)) {
      const { error: repairError } = await supabaseAdmin.from("matches").update({ hero_id: expected.hero_id, won, rating_delta: ratingDelta, rating_after: currentRating, raw: match }).eq("match_id", matchId).eq("player_id", player.id);
      if (repairError) throw new Error(`Repair match ${matchId}: ${repairError.message}`); repaired += 1;
    }
  }

  const { bonusMilestones } = await grantLossStreakBonuses(player.id, eligibleMatches);
  const { error: playerUpdateError } = await supabaseAdmin.from("players").update({ rating: currentRating, wins, losses, tracking_from: SEASON_START_ISO }).eq("id", player.id);
  if (playerUpdateError) throw new Error(`Player update: ${playerUpdateError.message}`);
  const totalSeasonMatches = eligibleMatches.length;
  const result = { player: player.name, season: 3, startRating: START_RATING, turboAfterStart: allTurboMatches.length, ignoredRepeatedHeroMatches: ignoredMatches.length, removedStored, seasonMatches: totalSeasonMatches, calibrationPlayed: Math.min(totalSeasonMatches, CALIBRATION_MATCHES), regularPlayed: Math.max(0, totalSeasonMatches - CALIBRATION_MATCHES), added, repaired, doubleDownMatches: doubleDownMatchIds.size, bonusMilestones, rating: currentRating, wins, losses };
  console.log(`✓ ${JSON.stringify(result)}`); return result;
}

async function main() {
  console.log(`Turbo League Season 3 sync started: ${new Date().toISOString()}`);
  const { data, error } = await supabaseAdmin.from("players").select("id,name,account_id,rating").eq("active", true).order("id");
  if (error) throw new Error(`Players lookup failed: ${error.message}`);
  const players = data ?? []; console.log(`Active players: ${players.length}`); const results = []; const failures = [];
  for (let i = 0; i < players.length; i += CONCURRENCY) {
    const batch = players.slice(i, i + CONCURRENCY); const settled = await Promise.allSettled(batch.map(syncPlayer));
    settled.forEach((entry, index) => { const player = batch[index]; if (entry.status === "fulfilled") results.push(entry.value); else { const message = entry.reason instanceof Error ? entry.reason.message : String(entry.reason); failures.push({ player: player.name, error: message }); console.error(`✗ ${player.name}: ${message}`); } });
  }
  const addedTotal = results.reduce((sum, item) => sum + item.added, 0); console.log(`\nTurbo League Season 3 sync finished: added=${addedTotal}, success=${results.length}, failed=${failures.length}`);
  if (failures.length > 0) { console.error(`Failures: ${JSON.stringify(failures)}`); process.exitCode = 1; }
}
await main();

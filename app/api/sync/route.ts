import { NextRequest, NextResponse } from "next/server";

/**
 * MVP sync endpoint.
 *
 * Next step:
 * 1. Read active players from Supabase.
 * 2. GET https://api.opendota.com/api/players/{account_id}/matches
 * 3. Keep Turbo matches only.
 * 4. Ignore (match_id, player_id) already stored.
 * 5. Determine win/loss from player_slot + radiant_win.
 * 6. Insert ledger row and update player's rating/wins/losses in a DB transaction.
 *
 * Protect this endpoint with CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    status: "sync scaffold ready",
    next: "connect Supabase + OpenDota"
  });
}

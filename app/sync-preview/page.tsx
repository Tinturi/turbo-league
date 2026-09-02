import { supabase } from "@/lib/supabase";
import { ratingDelta } from "@/lib/rating";

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
  rating: number;
  wins: number;
  losses: number;
  tracking_from: string | null;
};

function didPlayerWin(match: OpenDotaMatch) {
  const isRadiant = match.player_slot < 128;
  return isRadiant === match.radiant_win;
}

export const dynamic = "force-dynamic";

export default async function SyncPreviewPage() {
  const { data, error } = await supabase
    .from("players")
    .select("id,name,account_id,rating,wins,losses,tracking_from")
    .eq("active", true)
    .order("id");

  if (error) {
    return <main className="mx-auto max-w-5xl px-6 py-12">Supabase: {error.message}</main>;
  }

  const players = (data ?? []) as Player[];

  const results = await Promise.all(
    players.map(async (player) => {
      const url = `https://api.opendota.com/api/players/${player.account_id}/matches?game_mode=23&significant=0&limit=100`;
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        return { player, error: `OpenDota HTTP ${response.status}`, matches: [], wins: 0, losses: 0, delta: 0 };
      }

      const matches = (await response.json()) as OpenDotaMatch[];
      const trackingFrom = player.tracking_from
        ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
        : 0;

      const leagueMatches = matches
        .filter((match) => match.game_mode === 23)
        .filter((match) => (match.start_time ?? 0) >= trackingFrom)
        .sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));

      const wins = leagueMatches.filter(didPlayerWin).length;
      const losses = leagueMatches.length - wins;
      const delta = leagueMatches.reduce(
        (sum, match) => sum + ratingDelta(didPlayerWin(match)),
        0,
      );

      return {
        player,
        error: null,
        matches: leagueMatches,
        wins,
        losses,
        delta,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-4xl font-bold">Sync Preview</h1>
      <p className="mt-3 text-slate-400">
        Только проверка. Эта страница ничего не записывает в Supabase.
      </p>

      <div className="mt-8 space-y-8">
        {results.map((result) => (
          <section key={result.player.id} className="rounded-2xl border border-slate-800 p-5">
            <h2 className="text-2xl font-bold">{result.player.name}</h2>
            {result.error ? (
              <p className="mt-3 text-rose-400">{result.error}</p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-5">
                  <div>Матчей: <b>{result.matches.length}</b></div>
                  <div className="text-emerald-400">W: <b>{result.wins}</b></div>
                  <div className="text-rose-400">L: <b>{result.losses}</b></div>
                  <div>Изменение: <b>{result.delta >= 0 ? "+" : ""}{result.delta}</b></div>
                  <div>Будет рейтинг: <b>{result.player.rating + result.delta}</b></div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-2 pr-4">Match ID</th>
                        <th className="py-2 pr-4">Дата UTC</th>
                        <th className="py-2 pr-4">Hero</th>
                        <th className="py-2 pr-4">Результат</th>
                        <th className="py-2">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.matches.map((match) => {
                        const won = didPlayerWin(match);
                        return (
                          <tr key={match.match_id} className="border-t border-slate-800">
                            <td className="py-2 pr-4">{match.match_id}</td>
                            <td className="py-2 pr-4">{match.start_time ? new Date(match.start_time * 1000).toISOString() : "—"}</td>
                            <td className="py-2 pr-4">{match.hero_id ?? "—"}</td>
                            <td className={won ? "py-2 pr-4 font-bold text-emerald-400" : "py-2 pr-4 font-bold text-rose-400"}>{won ? "WIN" : "LOSS"}</td>
                            <td className="py-2">{ratingDelta(won) > 0 ? "+" : ""}{ratingDelta(won)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

import { supabase } from "@/lib/supabase";

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
export const revalidate = 0;

export default async function OpenDotaTestPage() {
  const { data: playerData, error: playersError } = await supabase
    .from("players")
    .select("id,name,account_id,tracking_from")
    .eq("active", true)
    .order("id");

  if (playersError) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-bold">OpenDota Turbo Test</h1>
        <p className="mt-4 text-rose-400">{playersError.message}</p>
      </main>
    );
  }

  const players = (playerData ?? []) as Player[];

  const results = await Promise.all(
    players.map(async (player) => {
      const trackingFromUnix = player.tracking_from
        ? Math.floor(new Date(player.tracking_from).getTime() / 1000)
        : 0;
      const url = `https://api.opendota.com/api/players/${player.account_id}/matches?game_mode=23&significant=0&limit=100`;

      try {
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          return {
            ...player,
            status: response.status,
            error: `OpenDota HTTP ${response.status}`,
            allTurboMatches: [] as OpenDotaMatch[],
            leagueMatches: [] as OpenDotaMatch[],
          };
        }

        const allMatches = (await response.json()) as OpenDotaMatch[];
        const allTurboMatches = allMatches
          .filter((match) => match.game_mode === 23)
          .filter((match) => (match.start_time ?? 0) >= trackingFromUnix)
          .sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));

        const leagueMatches = allTurboMatches.slice(PLACEMENT_MATCHES);

        return {
          ...player,
          status: response.status,
          error: null,
          allTurboMatches,
          leagueMatches,
        };
      } catch (error) {
        return {
          ...player,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
          allTurboMatches: [] as OpenDotaMatch[],
          leagueMatches: [] as OpenDotaMatch[],
        };
      }
    }),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-4xl font-bold">OpenDota Turbo Test</h1>
      <p className="mt-3 text-slate-400">
        Диагностика всех активных игроков. Первые 5 Turbo-игр после даты старта не учитываются в рейтинге.
      </p>

      <div className="mt-8 space-y-8">
        {results.map((result) => (
          <section
            key={result.account_id}
            className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
          >
            <h2 className="text-2xl font-bold">{result.name}</h2>
            <p className="mt-1 text-sm text-slate-400">
              account_id: {result.account_id} · OpenDota status: {result.status}
            </p>

            {result.error ? (
              <p className="mt-4 text-rose-400">{result.error}</p>
            ) : (
              <>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <div>Turbo после старта: <b>{result.allTurboMatches.length}</b></div>
                  <div>Первые 5 пропущены: <b>{Math.min(PLACEMENT_MATCHES, result.allTurboMatches.length)}</b></div>
                  <div>Должно учитываться: <b>{result.leagueMatches.length}</b></div>
                </div>

                {result.allTurboMatches.length === 0 ? (
                  <p className="mt-4 text-slate-300">Turbo-матчей после старта лиги пока не найдено.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="py-2 pr-4">#</th>
                          <th className="py-2 pr-4">Match ID</th>
                          <th className="py-2 pr-4">Дата UTC</th>
                          <th className="py-2 pr-4">Hero</th>
                          <th className="py-2 pr-4">Статус</th>
                          <th className="py-2">Результат</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.allTurboMatches.map((match, index) => {
                          const placement = index < PLACEMENT_MATCHES;
                          const won = didPlayerWin(match);
                          return (
                            <tr key={match.match_id} className="border-t border-slate-800">
                              <td className="py-2 pr-4">{index + 1}</td>
                              <td className="py-2 pr-4">{match.match_id}</td>
                              <td className="py-2 pr-4">
                                {match.start_time ? new Date(match.start_time * 1000).toISOString() : "—"}
                              </td>
                              <td className="py-2 pr-4">{match.hero_id ?? "—"}</td>
                              <td className="py-2 pr-4 font-bold">
                                {placement ? "ПРОПУСК" : "В РЕЙТИНГ"}
                              </td>
                              <td className={won ? "py-2 font-bold text-emerald-400" : "py-2 font-bold text-rose-400"}>
                                {won ? "WIN" : "LOSS"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

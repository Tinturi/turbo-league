type OpenDotaMatch = {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  game_mode?: number;
  hero_id?: number;
  start_time?: number;
};

const players = [
  { name: "Артём", accountId: 261238708 },
  { name: "Денчик", accountId: 152657599 },
];

const TRACKING_FROM_UNIX = Math.floor(
  new Date("2026-08-31T23:00:00Z").getTime() / 1000,
);

function didPlayerWin(match: OpenDotaMatch) {
  const isRadiant = match.player_slot < 128;
  return isRadiant === match.radiant_win;
}

export const dynamic = "force-dynamic";

export default async function OpenDotaTestPage() {
  const results = await Promise.all(
    players.map(async (player) => {
      const url = `https://api.opendota.com/api/players/${player.accountId}/matches?game_mode=23&significant=0&limit=100`;

      try {
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          return {
            ...player,
            status: response.status,
            error: `OpenDota HTTP ${response.status}`,
            matches: [],
          };
        }

        const allMatches = (await response.json()) as OpenDotaMatch[];
        const turboMatches = allMatches.filter(
          (match) => match.game_mode === 23,
        );
        const leagueMatches = turboMatches.filter(
          (match) => (match.start_time ?? 0) >= TRACKING_FROM_UNIX,
        );

        return {
          ...player,
          status: response.status,
          error: null,
          matches: leagueMatches.slice(0, 20).map((match) => ({
            match_id: match.match_id,
            start_time: match.start_time
              ? new Date(match.start_time * 1000).toISOString()
              : null,
            hero_id: match.hero_id ?? null,
            game_mode: match.game_mode ?? null,
            player_slot: match.player_slot,
            radiant_win: match.radiant_win,
            won: didPlayerWin(match),
          })),
        };
      } catch (error) {
        return {
          ...player,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
          matches: [],
        };
      }
    }),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-4xl font-bold">OpenDota Turbo Test</h1>
      <p className="mt-3 text-slate-400">
        Проверка Turbo-матчей с 1 сентября 2026, 06:00 по Новосибирску.
      </p>

      <div className="mt-8 space-y-8">
        {results.map((result) => (
          <section
            key={result.accountId}
            className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
          >
            <h2 className="text-2xl font-bold">{result.name}</h2>
            <p className="mt-1 text-sm text-slate-400">
              account_id: {result.accountId} · OpenDota status: {result.status}
            </p>

            {result.error ? (
              <p className="mt-4 text-rose-400">{result.error}</p>
            ) : result.matches.length === 0 ? (
              <p className="mt-4 text-slate-300">
                Turbo-матчей после старта лиги пока не найдено.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Match ID</th>
                      <th className="py-2 pr-4">Дата UTC</th>
                      <th className="py-2 pr-4">Hero</th>
                      <th className="py-2 pr-4">Mode</th>
                      <th className="py-2">Результат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((match) => (
                      <tr key={match.match_id} className="border-t border-slate-800">
                        <td className="py-2 pr-4">{match.match_id}</td>
                        <td className="py-2 pr-4">{match.start_time}</td>
                        <td className="py-2 pr-4">{match.hero_id}</td>
                        <td className="py-2 pr-4">{match.game_mode}</td>
                        <td
                          className={`py-2 font-bold ${
                            match.won ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {match.won ? "WIN" : "LOSS"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

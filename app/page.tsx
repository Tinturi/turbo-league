import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "@/lib/supabase";
import RefreshCountdown from "@/app/components/RefreshCountdown";
import LeaderboardTable from "@/app/components/LeaderboardTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Player = {
  id: number;
  name: string;
  account_id: number;
  rating: number;
  wins: number;
  losses: number;
};

export default async function Home() {
  noStore();

  const { data, error } = await supabase
    .from("players")
    .select("id, name, account_id, rating, wins, losses")
    .eq("active", true)
    .order("rating", { ascending: false });

  if (error) {
    return (
      <section className="hero">
        <h1>Turbo League</h1>
        <p>Не удалось загрузить рейтинг.</p>
        <p className="muted">{error.message}</p>
      </section>
    );
  }

  const players = (data ?? []) as Player[];
  const leaderboardPlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
    account_id: player.account_id,
    rating: player.rating,
    wins: player.wins,
    losses: player.losses,
  }));

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Turbo League</h1>
          <p>Рейтинг игроков по матчам Dota 2 Turbo.</p>
          <RefreshCountdown />

          <div
            role="status"
            style={{
              width: "min(680px, calc(100vw - 36px))",
              marginTop: 18,
              padding: "14px 16px",
              border: "1px solid rgba(233,184,75,.48)",
              borderRadius: 14,
              background: "rgba(10,13,19,.86)",
              boxShadow: "0 14px 38px rgba(0,0,0,.34)",
              backdropFilter: "blur(12px)",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#e9b84b",
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: ".04em",
              }}
            >
              <span aria-hidden="true">⚠</span>
              ВРЕМЕННЫЕ ПРОБЛЕМЫ OPENDOTA
            </div>
            <div
              style={{
                marginTop: 7,
                color: "#e4e8ef",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              OpenDota сейчас работает нестабильно и может не находить игроков или их матчи.
              Из-за этого часть сыгранных Turbo-игр может появляться в рейтинге с задержкой.
              Как только OpenDota снова начнёт отдавать матчи, они подтянутся автоматически.
            </div>
          </div>
        </div>
      </section>

      <LeaderboardTable players={leaderboardPlayers} />
    </>
  );
}

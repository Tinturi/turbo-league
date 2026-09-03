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
          <p>Season 3 · первые 5 игр ±50, далее ±25.</p>
          <RefreshCountdown />
        </div>
      </section>

      <LeaderboardTable players={leaderboardPlayers} />
    </>
  );
}

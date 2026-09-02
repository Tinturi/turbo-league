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

type OpenDotaPlayer = {
  profile?: {
    avatar?: string | null;
    avatarmedium?: string | null;
    avatarfull?: string | null;
  };
};

async function getAvatar(accountId: number) {
  try {
    const response = await fetch(
      `https://api.opendota.com/api/players/${accountId}`,
      { cache: "no-store" },
    );

    if (!response.ok) return null;

    const player = (await response.json()) as OpenDotaPlayer;
    return (
      player.profile?.avatarfull ??
      player.profile?.avatarmedium ??
      player.profile?.avatar ??
      null
    );
  } catch {
    return null;
  }
}

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
  const avatars = await Promise.all(
    players.map((player) => getAvatar(player.account_id)),
  );

  const leaderboardPlayers = players.map((player, index) => ({
    id: player.id,
    name: player.name,
    rating: player.rating,
    wins: player.wins,
    losses: player.losses,
    avatar: avatars[index],
  }));

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Turbo League</h1>
          <p>Рейтинг игроков по матчам Dota 2 Turbo.</p>
          <RefreshCountdown />
        </div>
      </section>

      <LeaderboardTable players={leaderboardPlayers} />
    </>
  );
}

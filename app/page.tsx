import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "@/lib/supabase";
import RefreshCountdown from "@/app/components/RefreshCountdown";

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

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Turbo League</h1>
          <p>Рейтинг игроков по матчам Dota 2 Turbo.</p>
          <RefreshCountdown />
        </div>
      </section>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Место</th>
              <th>Игрок</th>
              <th>Рейтинг</th>
              <th>W / L</th>
              <th>Winrate</th>
            </tr>
          </thead>

          <tbody>
            {players.map((p, i) => {
              const total = p.wins + p.losses;
              const winrate = total
                ? ((p.wins / total) * 100).toFixed(1)
                : "0.0";
              const avatar = avatars[i];

              return (
                <tr key={p.id}>
                  <td className="rank">#{i + 1}</td>

                  <td>
                    <a className="player-link" href={`/player/${p.id}`}>
                      {avatar ? (
                        <img
                          className="player-avatar"
                          src={avatar}
                          alt=""
                          width={40}
                          height={40}
                        />
                      ) : (
                        <span className="player-avatar player-avatar-fallback">
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="player-name">{p.name}</span>
                    </a>
                  </td>

                  <td className="rating">{p.rating}</td>

                  <td>
                    <span className="win">{p.wins}W</span>
                    {" / "}
                    <span className="loss">{p.losses}L</span>
                  </td>

                  <td>{winrate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

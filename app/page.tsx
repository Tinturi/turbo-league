import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "@/lib/supabase";

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

  return (
    <>
      <section className="hero">
        <h1>Turbo League</h1>
        <p>Рейтинг игроков по матчам Dota 2 Turbo.</p>
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

              return (
                <tr key={p.id}>
                  <td className="rank">#{i + 1}</td>

                  <td>
                    <a className="player-name" href={`/player/${p.id}`}>
                      {p.name}
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

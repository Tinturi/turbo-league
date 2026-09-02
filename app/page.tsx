import { players } from "@/lib/mock";

export default function Home() {
  const sorted = [...players].sort((a,b) => b.rating - a.rating);
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
              <th>Место</th><th>Игрок</th><th>Рейтинг</th><th>W / L</th><th>Winrate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const total = p.wins + p.losses;
              const wr = total ? (p.wins / total * 100).toFixed(1) : "0.0";
              return (
                <tr key={p.id}>
                  <td className="rank">#{i+1}</td>
                  <td><a className="player-name" href={`/player/${p.id}`}>{p.name}</a></td>
                  <td className="rating">{p.rating}</td>
                  <td><span className="win">{p.wins}W</span> / <span className="loss">{p.losses}L</span></td>
                  <td>{wr}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { matches, players } from "@/lib/mock";
import { notFound } from "next/navigation";

export default async function PlayerPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const p = players.find(x => x.id === id);
  if (!p) notFound();
  const history = matches.filter(m => m.playerId === id);
  const total = p.wins + p.losses;
  return (
    <>
      <a className="back" href="/">← Назад к рейтингу</a>
      <h1>{p.name}</h1>
      <div className="muted">Dota ID: {p.dotaId}</div>
      <div className="grid">
        <div className="stat">Рейтинг<b>{p.rating}</b></div>
        <div className="stat">Победы<b className="win">{p.wins}</b></div>
        <div className="stat">Поражения<b className="loss">{p.losses}</b></div>
        <div className="stat">Winrate<b>{total ? (p.wins/total*100).toFixed(1) : 0}%</b></div>
      </div>
      <h2>Последние матчи</h2>
      <div className="card">
        <table>
          <thead><tr><th>Матч</th><th>Дата</th><th>Герой</th><th>Результат</th><th>Δ рейтинг</th><th>После</th></tr></thead>
          <tbody>
          {history.map(m => (
            <tr key={m.id}>
              <td>{m.id}</td><td>{m.date}</td><td>{m.hero}</td>
              <td className={m.result === "win" ? "win" : "loss"}>{m.result === "win" ? "Победа" : "Поражение"}</td>
              <td className={m.delta > 0 ? "win" : "loss"}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
              <td>{m.ratingAfter}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

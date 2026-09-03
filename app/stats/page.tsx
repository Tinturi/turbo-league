import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "@/lib/supabase";
import { SEASON_START_ISO } from "@/lib/season";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Player = { id: number; name: string; rating: number; wins: number; losses: number; };
type Match = { match_id: number; player_id: number; start_time: string | null; won: boolean; rating_delta: number; rating_after: number; };
type PlayerStats = Player & { total: number; winrate: number; currentStreak: number; currentStreakType: "W" | "L" | null; bestWinStreak: number; worstLossStreak: number; peakRating: number; };

function buildStats(player: Player, matches: Match[]): PlayerStats {
  const ordered = matches.filter((match) => match.player_id === player.id).sort((a, b) => new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime());
  let bestWinStreak = 0, worstLossStreak = 0, winStreak = 0, lossStreak = 0;
  for (const match of ordered) {
    if (match.won) { winStreak += 1; lossStreak = 0; bestWinStreak = Math.max(bestWinStreak, winStreak); }
    else { lossStreak += 1; winStreak = 0; worstLossStreak = Math.max(worstLossStreak, lossStreak); }
  }

  const wins = ordered.filter((match) => match.won).length;
  const losses = ordered.length - wins;
  const total = ordered.length;
  const last = ordered.at(-1);
  let currentStreak = 0;
  let currentStreakType: "W" | "L" | null = null;
  if (last) {
    currentStreakType = last.won ? "W" : "L";
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      if ((ordered[index].won ? "W" : "L") !== currentStreakType) break;
      currentStreak += 1;
    }
  }

  const baseline = ordered.length ? ordered[0].rating_after - ordered[0].rating_delta : player.rating;
  const peakRating = ordered.reduce((peak, match) => Math.max(peak, match.rating_after), baseline);

  return { ...player, wins, losses, total, winrate: total ? (wins / total) * 100 : 0, currentStreak, currentStreakType, bestWinStreak, worstLossStreak, peakRating };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Novosibirsk" }).format(new Date(value));
}

export default async function StatsPage() {
  noStore();
  const [{ data: playerData }, { data: matchData }] = await Promise.all([
    supabase.from("players").select("id,name,rating,wins,losses").eq("active", true),
    supabase.from("matches").select("match_id,player_id,start_time,won,rating_delta,rating_after").gte("start_time", SEASON_START_ISO).order("start_time", { ascending: false }),
  ]);

  const players = (playerData ?? []) as Player[];
  const matches = (matchData ?? []) as Match[];
  const stats = players.map((player) => buildStats(player, matches));
  const leader = [...stats].sort((a, b) => b.rating - a.rating)[0];
  const mostGames = [...stats].sort((a, b) => b.total - a.total || b.rating - a.rating)[0];
  const bestWinrate = [...stats].filter((player) => player.total > 0).sort((a, b) => b.winrate - a.winrate || b.total - a.total)[0];
  const bestStreak = [...stats].sort((a, b) => b.bestWinStreak - a.bestWinStreak)[0];
  const worstStreak = [...stats].sort((a, b) => b.worstLossStreak - a.worstLossStreak)[0];
  const peak = [...stats].sort((a, b) => b.peakRating - a.peakRating)[0];
  const names = new Map(players.map((player) => [player.id, player.name]));
  const latestEvents = matches.slice(0, 12);

  const cards = [
    ["👑 Лидер сезона", leader?.name ?? "—", leader ? `${leader.rating} рейтинга` : "Нет данных"],
    ["🎯 Лучший Winrate", bestWinrate?.name ?? "—", bestWinrate ? `${bestWinrate.winrate.toFixed(1)}%` : "Нет матчей"],
    ["⚔️ Больше всего матчей", mostGames?.name ?? "—", mostGames ? `${mostGames.total} матчей` : "Нет матчей"],
    ["🔥 Лучший винстрик", bestStreak?.name ?? "—", bestStreak ? `${bestStreak.bestWinStreak} побед подряд` : "Нет матчей"],
    ["💀 Самый большой лузстрик", worstStreak?.name ?? "—", worstStreak ? `${worstStreak.worstLossStreak} поражений подряд` : "Нет матчей"],
    ["📈 Пиковый рейтинг", peak?.name ?? "—", peak ? `${peak.peakRating} рейтинга` : "Нет данных"],
  ];

  return (
    <div style={{ margin: "0 calc(50% - 50vw)", minHeight: "calc(100vh - 68px)", background: "linear-gradient(rgba(7,9,13,.78), rgba(7,9,13,.95)), url('/turbo-bg.svg') center/cover fixed", padding: "54px max(20px, calc((100vw - 1100px)/2)) 70px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: "#e9b84b", fontSize: 12, fontWeight: 900, letterSpacing: ".15em", textTransform: "uppercase" }}>Turbo League · Season 3</div>
          <h1 style={{ margin: "8px 0 8px", fontSize: "clamp(36px,6vw,64px)", fontFamily: "Georgia, 'Times New Roman', serif" }}>Статистика сезона</h1>
          <p className="muted" style={{ margin: 0 }}>Только матчи третьего сезона — с 04.09.2026 03:18 по Новосибирску.</p>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 28 }}>
          {cards.map(([title, name, value]) => <div key={title} className="stat" style={{ minHeight: 132, background: "rgba(14,19,28,.92)", borderColor: "#303848" }}><div style={{ color: "#aeb7c7", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em" }}>{title}</div><b style={{ fontSize: 21, marginTop: 12 }}>{name}</b><div style={{ color: "#e9b84b", marginTop: 6, fontWeight: 800 }}>{value}</div></div>)}
        </section>

        <section className="card" style={{ marginBottom: 28 }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #232836" }}><h2 style={{ margin: 0, fontSize: 22 }}>Серии игроков</h2><p className="muted" style={{ margin: "5px 0 0" }}>Текущая форма и рекорды каждого участника в Season 3.</p></div>
          <div style={{ overflowX: "auto" }}><table><thead><tr><th>Игрок</th><th>Текущая серия</th><th>Лучший W-стрик</th><th>Худший L-стрик</th><th>Пиковый рейтинг</th></tr></thead><tbody>
            {[...stats].sort((a, b) => b.rating - a.rating).map((player) => <tr key={player.id}><td><a className="player-link" href={`/player/${player.id}`}><span className="player-name">{player.name}</span></a></td><td>{player.currentStreakType ? <strong className={player.currentStreakType === "W" ? "win" : "loss"}>{player.currentStreakType === "W" ? "🔥" : "💀"} {player.currentStreakType}{player.currentStreak}</strong> : <span className="muted">—</span>}</td><td className="win">{player.bestWinStreak}</td><td className="loss">{player.worstLossStreak}</td><td style={{ fontWeight: 800 }}>{player.peakRating}</td></tr>)}
          </tbody></table></div>
        </section>

        <section className="card">
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #232836" }}><h2 style={{ margin: 0, fontSize: 22 }}>Последние события</h2><p className="muted" style={{ margin: "5px 0 0" }}>Живая хроника учтённых матчей Season 3.</p></div>
          <div style={{ display: "grid" }}>{latestEvents.length === 0 ? <div className="empty-matches">Событий пока нет.</div> : latestEvents.map((match) => <a key={`${match.match_id}-${match.player_id}`} href={`/match/${match.match_id}`} style={{ display: "flex", justifyContent: "space-between", gap: 18, padding: "15px 20px", borderBottom: "1px solid #232836" }}><div><strong>{names.get(match.player_id) ?? "Игрок"}</strong><div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{formatDate(match.start_time)} · матч #{match.match_id}</div></div><div style={{ textAlign: "right" }}><strong className={match.won ? "win" : "loss"}>{match.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</strong><div className={match.rating_delta > 0 ? "win" : "loss"} style={{ marginTop: 4, fontWeight: 900 }}>{match.rating_delta > 0 ? "+" : ""}{match.rating_delta} → {match.rating_after}</div></div></a>)}</div>
        </section>
      </div>
    </div>
  );
}

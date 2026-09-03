import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SEASON_START_ISO } from "@/lib/season";
import DoubleDownCard from "@/app/components/DoubleDownCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Player = { id: number; name: string; account_id: number; rating: number; wins: number; losses: number; };
type LeagueMatch = { match_id: number; start_time: string | null; hero_id: number | null; won: boolean; rating_delta: number; rating_after: number; };
type OpenDotaProfile = { profile?: { avatarfull?: string | null; avatarmedium?: string | null; avatar?: string | null; }; };
type MatchPlayer = { account_id?: number | null; hero_id?: number | null; player_slot?: number | null; };
type MatchDetails = { players?: MatchPlayer[]; };
type Hero = { id: number; localized_name?: string; img?: string; };
type HeroInfo = { name: string; image: string | null; };

async function getAvatar(accountId: number) {
  try {
    const response = await fetch(`https://api.opendota.com/api/players/${accountId}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as OpenDotaProfile;
    return data.profile?.avatarfull ?? data.profile?.avatarmedium ?? data.profile?.avatar ?? null;
  } catch { return null; }
}

async function getHeroes() {
  try {
    const response = await fetch("https://api.opendota.com/api/constants/heroes", { next: { revalidate: 86400 } });
    if (!response.ok) return new Map<number, HeroInfo>();
    const data = (await response.json()) as Record<string, Hero>;
    return new Map(Object.values(data).map((hero) => [hero.id, { name: hero.localized_name ?? `Hero ${hero.id}`, image: hero.img ? `https://cdn.cloudflare.steamstatic.com${hero.img}` : null }]));
  } catch { return new Map<number, HeroInfo>(); }
}

async function getOpponents(matchId: number, accountId: number, heroes: Map<number, HeroInfo>) {
  try {
    const response = await fetch(`https://api.opendota.com/api/matches/${matchId}`, { next: { revalidate: 86400 } });
    if (!response.ok) return [];
    const details = (await response.json()) as MatchDetails;
    const players = details.players ?? [];
    const current = players.find((player) => player.account_id === accountId);
    if (current?.player_slot == null) return [];
    const playerIsRadiant = current.player_slot < 128;
    return players.filter((player) => player.player_slot != null).filter((player) => (Number(player.player_slot) < 128) !== playerIsRadiant).slice(0, 5).map((player) => {
      const heroId = player.hero_id ?? 0;
      const hero = heroes.get(heroId);
      return { heroId, name: hero?.name ?? `Hero ${player.hero_id ?? "?"}` };
    });
  } catch { return []; }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Novosibirsk" }).format(new Date(value));
}

function currentStreak(matches: LeagueMatch[]) {
  if (!matches.length) return { type: null as "W" | "L" | null, count: 0 };
  const newest = [...matches].sort((a, b) => new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime());
  const type: "W" | "L" = newest[0].won ? "W" : "L";
  let count = 0;
  for (const match of newest) {
    if ((match.won ? "W" : "L") !== type) break;
    count += 1;
  }
  return { type, count };
}

function bestWinStreak(matches: LeagueMatch[]) {
  const ordered = [...matches].sort((a, b) => new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime());
  let best = 0;
  let current = 0;
  for (const match of ordered) {
    current = match.won ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function RatingChart({ matches }: { matches: LeagueMatch[] }) {
  const ordered = [...matches].sort((a, b) => new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime());
  if (!ordered.length) return <div className="muted">График появится после первого зачётного матча Season 3.</div>;
  const values = ordered.map((match) => match.rating_after);
  const min = Math.min(...values) - 50;
  const max = Math.max(...values) + 50;
  const range = Math.max(100, max - min);
  const width = 900;
  const height = 220;
  const padding = 24;
  const points = values.map((value, index) => {
    const x = ordered.length === 1 ? width / 2 : padding + (index / (ordered.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 560, display: "block" }} role="img" aria-label="График изменения рейтинга">
        {[0.25,0.5,0.75].map((part) => <line key={part} x1={padding} x2={width-padding} y1={height*part} y2={height*part} stroke="rgba(255,255,255,.08)" strokeWidth="1" />)}
        <polyline points={points} fill="none" stroke="#e9b84b" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((value, index) => {
          const [x,y] = points.split(" ")[index].split(",");
          return <circle key={ordered[index].match_id} cx={x} cy={y} r="5" fill={ordered[index].won ? "#72e0a6" : "#ff8585"}><title>{`${value} · ${ordered[index].won ? "Победа" : "Поражение"} · ${formatDate(ordered[index].start_time)}`}</title></circle>;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#8f98aa", fontSize: 12 }}><span>Старт Season 3</span><strong style={{ color: "#e9b84b" }}>Сейчас: {values.at(-1)}</strong></div>
    </div>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();

  const [{ data: playerData }, { data: matchData }, heroes] = await Promise.all([
    supabase.from("players").select("id,name,account_id,rating,wins,losses").eq("id", playerId).eq("active", true).single(),
    supabase.from("matches").select("match_id,start_time,hero_id,won,rating_delta,rating_after").eq("player_id", playerId).gte("start_time", SEASON_START_ISO).order("start_time", { ascending: false }),
    getHeroes(),
  ]);

  if (!playerData) notFound();
  const player = playerData as Player;
  const allMatches = (matchData ?? []) as LeagueMatch[];
  const matches = allMatches.slice(0, 12);
  const avatar = await getAvatar(player.account_id);

  const matchRows = await Promise.all(matches.map(async (match) => {
    const hero = heroes.get(match.hero_id ?? 0);
    return { ...match, heroName: hero?.name ?? `Hero ${match.hero_id ?? "?"}`, heroImage: hero?.image ?? null, opponents: await getOpponents(match.match_id, player.account_id, heroes) };
  }));

  const wins = allMatches.filter((match) => match.won).length;
  const losses = allMatches.length - wins;
  const total = allMatches.length;
  const winrateValue = total ? (wins / total) * 100 : 0;
  const winrate = winrateValue.toFixed(1);
  const recent = [...matches].reverse();
  const streak = currentStreak(allMatches);
  const bestStreak = bestWinStreak(allMatches);
  const orderedForPeak = [...allMatches].sort((a, b) => new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime());
  const baselineRating = orderedForPeak.length ? orderedForPeak[0].rating_after - orderedForPeak[0].rating_delta : player.rating;
  const peakRating = orderedForPeak.reduce((peak, match) => Math.max(peak, match.rating_after), baselineRating);

  const achievements = [
    total >= 10 ? ["⚔️", "Ветеран", "10+ матчей в сезоне"] : null,
    total >= 25 ? ["🛡️", "Железная воля", "25+ матчей в сезоне"] : null,
    bestStreak >= 3 ? ["🔥", "На огне", `${bestStreak} побед подряд`] : null,
    winrateValue >= 60 && total >= 5 ? ["🎯", "Снайпер", `${winrate}% побед`] : null,
    peakRating >= 300 ? ["👑", "Высокий ранг", `Пик рейтинга ${peakRating}`] : null,
  ].filter(Boolean) as string[][];

  return (
    <main className="player-profile-page">
      <a className="back" href="/">← Назад к рейтингу</a>
      <section className="profile-head">
        {avatar ? <img className="profile-avatar" src={avatar} alt="" /> : <div className="profile-avatar profile-avatar-fallback">{player.name.slice(0, 1)}</div>}
        <div><div className="muted">Профиль игрока · Season 3</div><h1>{player.name}</h1><div className="muted">OpenDota ID: {player.account_id}</div></div>
      </section>

      <section className="profile-stats">
        <div className="stat">Рейтинг<b>{player.rating}</b></div>
        <div className="stat">Победы<b className="win">{wins}</b></div>
        <div className="stat">Поражения<b className="loss">{losses}</b></div>
        <div className="stat">Winrate<b>{winrate}%</b></div>
      </section>

      <DoubleDownCard playerId={player.id} />

      <section className="form-card">
        <div><div className="form-title">Последние игры Season 3</div><div className="muted">{streak.type ? <>Текущая серия: <strong className={streak.type === "W" ? "win" : "loss"}>{streak.type === "W" ? "🔥" : "💀"} {streak.type}{streak.count}</strong></> : "Форма игрока в матчах третьего сезона"}</div></div>
        <div className="form-strip" aria-label="Последние результаты">{recent.length === 0 ? <span className="muted">Матчей пока нет</span> : recent.map((match) => <span key={match.match_id} className={`form-result ${match.won ? "form-win" : "form-loss"}`} title={`${match.won ? "Победа" : "Поражение"} · ${formatDate(match.start_time)}`}>{match.won ? "W" : "L"}</span>)}</div>
      </section>

      <section className="card" style={{ padding: 20, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", marginBottom: 14 }}><div><h2 style={{ margin: 0, fontSize: 22 }}>📈 История рейтинга</h2><p className="muted" style={{ margin: "5px 0 0" }}>Каждая точка — матч третьего сезона.</p></div><div style={{ color: "#e9b84b", fontWeight: 900 }}>Пик: {peakRating}</div></div>
        <RatingChart matches={allMatches} />
      </section>

      <section className="card" style={{ padding: 20, marginBottom: 26 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 22 }}>🏅 Достижения</h2>
        {achievements.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>{achievements.map(([icon,title,description]) => <div key={title} style={{ padding: 14, border: "1px solid #30394a", borderRadius: 13, background: "#111722" }}><div style={{ fontSize: 24 }}>{icon}</div><strong style={{ display: "block", marginTop: 7 }}>{title}</strong><span className="muted" style={{ fontSize: 12 }}>{description}</span></div>)}</div> : <div className="muted">Первые достижения Season 3 откроются по ходу сезона.</div>}
      </section>

      <section className="match-history-section">
        <div className="match-history-heading"><div><h2>История матчей Season 3</h2><p className="muted">Нажми на матч, чтобы открыть полный состав и статистику.</p></div></div>
        <div className="match-list">{matchRows.length === 0 ? <div className="empty-matches">Учтённых матчей Season 3 пока нет.</div> : matchRows.map((match) => (
          <a href={`/match/${match.match_id}`} key={match.match_id} style={{ display: "block", color: "inherit", textDecoration: "none" }} title="Открыть подробности матча">
            <article className={`match-row ${match.won ? "match-win" : "match-loss"}`}>
              <div className="match-result-block"><strong>{match.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</strong><span>{formatDate(match.start_time)}</span></div>
              <div className="match-hero-block"><span className="match-label">Играл на</span><div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, minWidth: 0 }}>{match.heroImage ? <img src={match.heroImage} alt={match.heroName} width={72} height={41} style={{ width: 72, height: 41, objectFit: "cover", borderRadius: 8, border: "1px solid #3a4353", boxShadow: "0 5px 14px rgba(0,0,0,.28)", flex: "0 0 auto" }} /> : null}<strong style={{ lineHeight: 1.2 }}>{match.heroName}</strong></div></div>
              <div className="opponents-block"><span className="match-label">Против него</span><div className="opponent-list">{match.opponents.length > 0 ? match.opponents.map((opponent, index) => <span className="opponent-chip" key={`${match.match_id}-${opponent.heroId}-${index}`}>{opponent.name}</span>) : <span className="muted">Состав пока недоступен</span>}</div></div>
              <div className="rating-change-block"><span className="match-label">Рейтинг</span><strong className={match.rating_delta > 0 ? "win" : "loss"}>{match.rating_delta > 0 ? "+" : ""}{match.rating_delta}</strong><span className="muted">→ {match.rating_after}</span></div>
            </article>
          </a>
        ))}</div>
      </section>
    </main>
  );
}

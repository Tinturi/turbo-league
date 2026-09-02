import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./match.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Hero = {
  id: number;
  localized_name?: string;
  img?: string;
};

type HeroInfo = {
  name: string;
  image: string | null;
};

type MatchPlayer = {
  account_id?: number | null;
  personaname?: string | null;
  name?: string | null;
  hero_id?: number | null;
  player_slot?: number | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  level?: number | null;
  gold_per_min?: number | null;
  xp_per_min?: number | null;
};

type MatchDetails = {
  match_id?: number;
  start_time?: number | null;
  duration?: number | null;
  radiant_win?: boolean;
  radiant_score?: number | null;
  dire_score?: number | null;
  players?: MatchPlayer[];
};

type LeaguePlayer = {
  id: number;
  name: string;
  account_id: number;
};

async function getHeroes() {
  try {
    const response = await fetch("https://api.opendota.com/api/constants/heroes", {
      next: { revalidate: 86400 },
    });
    if (!response.ok) return new Map<number, HeroInfo>();
    const data = (await response.json()) as Record<string, Hero>;
    return new Map(
      Object.values(data).map((hero) => [
        hero.id,
        {
          name: hero.localized_name ?? `Hero ${hero.id}`,
          image: hero.img ? `https://cdn.cloudflare.steamstatic.com${hero.img}` : null,
        },
      ]),
    );
  } catch {
    return new Map<number, HeroInfo>();
  }
}

function formatDate(startTime?: number | null) {
  if (!startTime) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Novosibirsk",
  }).format(new Date(startTime * 1000));
}

function formatDuration(duration?: number | null) {
  if (!duration) return "—";
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

  const [matchResponse, heroes, leaguePlayersResult] = await Promise.all([
    fetch(`https://api.opendota.com/api/matches/${matchId}`, {
      next: { revalidate: 86400 },
    }),
    getHeroes(),
    supabase.from("players").select("id,name,account_id").eq("active", true),
  ]);

  if (!matchResponse.ok) notFound();
  const match = (await matchResponse.json()) as MatchDetails;
  const leaguePlayers = (leaguePlayersResult.data ?? []) as LeaguePlayer[];
  const leagueByAccount = new Map(leaguePlayers.map((player) => [player.account_id, player]));

  const players = (match.players ?? []).filter((player) => player.player_slot != null);
  const radiant = players.filter((player) => Number(player.player_slot) < 128).slice(0, 5);
  const dire = players.filter((player) => Number(player.player_slot) >= 128).slice(0, 5);

  const renderTeam = (team: MatchPlayer[], radiantSide: boolean) => (
    <section className={styles.teamCard}>
      <div className={styles.teamHead}>
        <div className={styles.teamName}>
          <span className={`${styles.dot} ${radiantSide ? styles.radiantDot : styles.direDot}`} />
          {radiantSide ? "Radiant" : "Dire"}
        </div>
        {Boolean(match.radiant_win) === radiantSide ? <span className={styles.winner}>ПОБЕДИТЕЛИ</span> : null}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Игрок / герой</th>
              <th>K / D / A</th>
              <th>Уровень</th>
              <th>GPM</th>
              <th>XPM</th>
            </tr>
          </thead>
          <tbody>
            {team.map((player, index) => {
              const heroId = player.hero_id ?? 0;
              const hero = heroes.get(heroId);
              const leaguePlayer = player.account_id ? leagueByAccount.get(player.account_id) : undefined;
              const nickname = leaguePlayer?.name ?? player.personaname ?? player.name ?? "Анонимный игрок";

              return (
                <tr key={`${radiantSide ? "r" : "d"}-${player.account_id ?? index}-${heroId}`}>
                  <td>
                    <div className={styles.playerCell}>
                      {hero?.image ? <img className={styles.heroImg} src={hero.image} alt={hero.name} /> : null}
                      <div className={styles.playerText}>
                        <span className={styles.playerName}>
                          {nickname}
                          {leaguePlayer ? <span className={styles.leagueBadge}>TURBO LEAGUE</span> : null}
                        </span>
                        <span className={styles.heroName}>{hero?.name ?? `Hero ${heroId || "?"}`}</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.kda}>{player.kills ?? 0} / {player.deaths ?? 0} / {player.assists ?? 0}</td>
                  <td className={styles.secondary}>{player.level ?? "—"}</td>
                  <td className={styles.secondary}>{player.gold_per_min ?? "—"}</td>
                  <td className={styles.secondary}>{player.xp_per_min ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <main className={styles.page}>
      <a className={styles.back} href="/">← Назад к рейтингу</a>

      <section className={styles.header}>
        <div>
          <div className={styles.kicker}>Turbo League · матч</div>
          <h1 className={styles.title}>Матч #{matchId}</h1>
          <div className={styles.meta}>{formatDate(match.start_time)} · {formatDuration(match.duration)}</div>
        </div>

        <div className={styles.score} aria-label="Счёт матча">
          <span className={styles.radiantColor}>{match.radiant_score ?? "—"}</span>
          <span className={styles.scoreSep}>:</span>
          <span className={styles.direColor}>{match.dire_score ?? "—"}</span>
        </div>
      </section>

      <section className={styles.summary}>
        <div className={styles.summaryCard}>Победитель<strong>{match.radiant_win ? "Radiant" : "Dire"}</strong></div>
        <div className={styles.summaryCard}>Длительность<strong>{formatDuration(match.duration)}</strong></div>
        <div className={styles.summaryCard}>Режим<strong>Turbo</strong></div>
      </section>

      <div className={styles.teams}>
        {renderTeam(radiant, true)}
        {renderTeam(dire, false)}
      </div>
    </main>
  );
}

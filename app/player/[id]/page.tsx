import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
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

type LeagueMatch = {
  match_id: number;
  start_time: string | null;
  hero_id: number | null;
  won: boolean;
  rating_delta: number;
  rating_after: number;
};

type OpenDotaProfile = {
  profile?: {
    avatarfull?: string | null;
    avatarmedium?: string | null;
    avatar?: string | null;
  };
};

type MatchPlayer = {
  account_id?: number | null;
  hero_id?: number | null;
  player_slot?: number | null;
};

type MatchDetails = {
  players?: MatchPlayer[];
};

type Hero = {
  id: number;
  localized_name?: string;
  img?: string;
};

type HeroInfo = {
  name: string;
  image: string | null;
};

async function getAvatar(accountId: number) {
  try {
    const response = await fetch(`https://api.opendota.com/api/players/${accountId}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OpenDotaProfile;
    return data.profile?.avatarfull ?? data.profile?.avatarmedium ?? data.profile?.avatar ?? null;
  } catch {
    return null;
  }
}

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

async function getOpponents(matchId: number, accountId: number, heroes: Map<number, HeroInfo>) {
  try {
    const response = await fetch(`https://api.opendota.com/api/matches/${matchId}`, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) return [];

    const details = (await response.json()) as MatchDetails;
    const players = details.players ?? [];
    const current = players.find((player) => player.account_id === accountId);
    if (current?.player_slot == null) return [];

    const playerIsRadiant = current.player_slot < 128;
    return players
      .filter((player) => player.player_slot != null)
      .filter((player) => (Number(player.player_slot) < 128) !== playerIsRadiant)
      .slice(0, 5)
      .map((player) => {
        const heroId = player.hero_id ?? 0;
        const hero = heroes.get(heroId);
        return {
          heroId,
          name: hero?.name ?? `Hero ${player.hero_id ?? "?"}`,
        };
      });
  } catch {
    return [];
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Novosibirsk",
  }).format(new Date(value));
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();

  const [{ data: playerData }, { data: matchData }, heroes] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,account_id,rating,wins,losses")
      .eq("id", playerId)
      .eq("active", true)
      .single(),
    supabase
      .from("matches")
      .select("match_id,start_time,hero_id,won,rating_delta,rating_after")
      .eq("player_id", playerId)
      .order("start_time", { ascending: false })
      .limit(12),
    getHeroes(),
  ]);

  if (!playerData) notFound();

  const player = playerData as Player;
  const matches = (matchData ?? []) as LeagueMatch[];
  const avatar = await getAvatar(player.account_id);

  const matchRows = await Promise.all(
    matches.map(async (match) => {
      const hero = heroes.get(match.hero_id ?? 0);
      return {
        ...match,
        heroName: hero?.name ?? `Hero ${match.hero_id ?? "?"}`,
        heroImage: hero?.image ?? null,
        opponents: await getOpponents(match.match_id, player.account_id, heroes),
      };
    }),
  );

  const total = player.wins + player.losses;
  const winrate = total ? ((player.wins / total) * 100).toFixed(1) : "0.0";
  const recent = [...matches].reverse();

  return (
    <main className="player-profile-page">
      <a className="back" href="/">← Назад к рейтингу</a>

      <section className="profile-head">
        {avatar ? (
          <img className="profile-avatar" src={avatar} alt="" />
        ) : (
          <div className="profile-avatar profile-avatar-fallback">{player.name.slice(0, 1)}</div>
        )}
        <div>
          <div className="muted">Профиль игрока</div>
          <h1>{player.name}</h1>
          <div className="muted">OpenDota ID: {player.account_id}</div>
        </div>
      </section>

      <section className="profile-stats">
        <div className="stat">Рейтинг<b>{player.rating}</b></div>
        <div className="stat">Победы<b className="win">{player.wins}</b></div>
        <div className="stat">Поражения<b className="loss">{player.losses}</b></div>
        <div className="stat">Winrate<b>{winrate}%</b></div>
      </section>

      <section className="form-card">
        <div>
          <div className="form-title">Последние игры</div>
          <div className="muted">Форма игрока в матчах лиги</div>
        </div>
        <div className="form-strip" aria-label="Последние результаты">
          {recent.length === 0 ? (
            <span className="muted">Матчей пока нет</span>
          ) : (
            recent.map((match) => (
              <span
                key={match.match_id}
                className={`form-result ${match.won ? "form-win" : "form-loss"}`}
                title={`${match.won ? "Победа" : "Поражение"} · ${formatDate(match.start_time)}`}
              >
                {match.won ? "W" : "L"}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="match-history-section">
        <div className="match-history-heading">
          <div>
            <h2>История матчей</h2>
            <p className="muted">Последние матчи, которые учитываются в рейтинге Turbo League.</p>
          </div>
        </div>

        <div className="match-list">
          {matchRows.length === 0 ? (
            <div className="empty-matches">Учтённых матчей пока нет.</div>
          ) : (
            matchRows.map((match) => (
              <article className={`match-row ${match.won ? "match-win" : "match-loss"}`} key={match.match_id}>
                <div className="match-result-block">
                  <strong>{match.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</strong>
                  <span>{formatDate(match.start_time)}</span>
                </div>

                <div className="match-hero-block">
                  <span className="match-label">Играл на</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 3,
                      minWidth: 0,
                    }}
                  >
                    {match.heroImage ? (
                      <img
                        src={match.heroImage}
                        alt={match.heroName}
                        width={72}
                        height={41}
                        style={{
                          width: 72,
                          height: 41,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #3a4353",
                          boxShadow: "0 5px 14px rgba(0,0,0,.28)",
                          flex: "0 0 auto",
                        }}
                      />
                    ) : null}
                    <strong style={{ lineHeight: 1.2 }}>{match.heroName}</strong>
                  </div>
                </div>

                <div className="opponents-block">
                  <span className="match-label">Против него</span>
                  <div className="opponent-list">
                    {match.opponents.length > 0 ? (
                      match.opponents.map((opponent, index) => (
                        <span className="opponent-chip" key={`${match.match_id}-${opponent.heroId}-${index}`}>
                          {opponent.name}
                        </span>
                      ))
                    ) : (
                      <span className="muted">Состав пока недоступен</span>
                    )}
                  </div>
                </div>

                <div className="rating-change-block">
                  <span className="match-label">Рейтинг</span>
                  <strong className={match.rating_delta > 0 ? "win" : "loss"}>
                    {match.rating_delta > 0 ? "+" : ""}{match.rating_delta}
                  </strong>
                  <span className="muted">→ {match.rating_after}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type PlayerRow = {
  id: number;
  name: string;
  account_id: number;
  rating: number;
  wins: number;
  losses: number;
};

type SortKey = "rating" | "matches" | "winrate";
type SortDirection = "desc" | "asc";

function getTotal(player: PlayerRow) {
  return player.wins + player.losses;
}

function getWinrate(player: PlayerRow) {
  const total = getTotal(player);
  return total ? (player.wins / total) * 100 : 0;
}

function PlayerAvatar({ player }: { player: PlayerRow }) {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAvatar() {
      try {
        const response = await fetch(`/api/avatar/${player.account_id}`);
        if (!response.ok) return;
        const data = (await response.json()) as { avatar?: string | null };
        if (!cancelled) setAvatar(data.avatar ?? null);
      } catch {
        // Keep the fallback avatar if OpenDota is temporarily unavailable.
      }
    }

    void loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [player.account_id]);

  if (avatar) {
    return <img className="player-avatar" src={avatar} alt="" width={40} height={40} />;
  }

  return (
    <span className="player-avatar player-avatar-fallback">
      {player.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const sortButtonStyle = {
  appearance: "none" as const,
  border: 0,
  padding: 0,
  margin: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  fontWeight: 800,
  letterSpacing: "inherit",
  textTransform: "inherit" as const,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

export default function LeaderboardTable({ players }: { players: PlayerRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const ratingRanks = useMemo(() => {
    const ordered = [...players].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, "ru"));
    return new Map(ordered.map((player, index) => [player.id, index + 1]));
  }, [players]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      let aValue = 0;
      let bValue = 0;

      if (sortKey === "rating") {
        aValue = a.rating;
        bValue = b.rating;
      } else if (sortKey === "matches") {
        aValue = getTotal(a);
        bValue = getTotal(b);
      } else {
        aValue = getWinrate(a);
        bValue = getWinrate(b);
      }

      const difference = sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      if (difference !== 0) return difference;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [players, sortKey, sortDirection]);

  function changeSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "↕";
    return sortDirection === "desc" ? "↓" : "↑";
  }

  function sortStyle(key: SortKey) {
    return { ...sortButtonStyle, color: sortKey === key ? "#e9b84b" : "inherit" };
  }

  function medal(rank: number | undefined) {
    if (rank === 1) return "👑";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  }

  return (
    <div className="card leaderboard-card">
      <table>
        <thead>
          <tr>
            <th>Место</th>
            <th>Игрок</th>
            <th><button type="button" style={sortStyle("rating")} onClick={() => changeSort("rating")} title="Сортировать по рейтингу">Рейтинг <span>{sortArrow("rating")}</span></button></th>
            <th><button type="button" style={sortStyle("matches")} onClick={() => changeSort("matches")} title="Сортировать по количеству матчей">Матчи <span>{sortArrow("matches")}</span></button></th>
            <th>W / L</th>
            <th><button type="button" style={sortStyle("winrate")} onClick={() => changeSort("winrate")} title="Сортировать по винрейту">Winrate <span>{sortArrow("winrate")}</span></button></th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player, index) => {
            const total = getTotal(player);
            const winrate = getWinrate(player).toFixed(1);
            const leagueRank = ratingRanks.get(player.id);
            const rankMedal = medal(leagueRank);

            return (
              <tr key={player.id} style={leagueRank === 1 ? { background: "linear-gradient(90deg, rgba(233,184,75,.09), transparent 55%)" } : undefined}>
                <td className="rank">#{index + 1}</td>
                <td>
                  <a className="player-link" href={`/player/${player.id}`}>
                    <span style={{ position: "relative", display: "inline-flex" }}>
                      <PlayerAvatar player={player} />
                      {rankMedal ? <span title={`Место по рейтингу: ${leagueRank}`} style={{ position: "absolute", right: -8, top: -10, fontSize: leagueRank === 1 ? 18 : 15, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.8))" }}>{rankMedal}</span> : null}
                    </span>
                    <span className="player-name">{player.name}</span>
                  </a>
                </td>
                <td className="rating">{player.rating}</td>
                <td style={{ fontWeight: 800 }}>{total}</td>
                <td><span className="win">{player.wins}W</span>{" / "}<span className="loss">{player.losses}L</span></td>
                <td>{winrate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

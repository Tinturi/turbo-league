"use client";

import { useMemo, useState } from "react";

type PlayerRow = {
  id: number;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  avatar: string | null;
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
    return {
      ...sortButtonStyle,
      color: sortKey === key ? "#e9b84b" : "inherit",
    };
  }

  return (
    <div className="card leaderboard-card">
      <table>
        <thead>
          <tr>
            <th>Место</th>
            <th>Игрок</th>
            <th>
              <button
                type="button"
                style={sortStyle("rating")}
                onClick={() => changeSort("rating")}
                title="Сортировать по рейтингу"
              >
                Рейтинг <span>{sortArrow("rating")}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                style={sortStyle("matches")}
                onClick={() => changeSort("matches")}
                title="Сортировать по количеству матчей"
              >
                Матчи <span>{sortArrow("matches")}</span>
              </button>
            </th>
            <th>W / L</th>
            <th>
              <button
                type="button"
                style={sortStyle("winrate")}
                onClick={() => changeSort("winrate")}
                title="Сортировать по винрейту"
              >
                Winrate <span>{sortArrow("winrate")}</span>
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedPlayers.map((player, index) => {
            const total = getTotal(player);
            const winrate = getWinrate(player).toFixed(1);

            return (
              <tr key={player.id}>
                <td className="rank">#{index + 1}</td>

                <td>
                  <a className="player-link" href={`/player/${player.id}`}>
                    {player.avatar ? (
                      <img
                        className="player-avatar"
                        src={player.avatar}
                        alt=""
                        width={40}
                        height={40}
                      />
                    ) : (
                      <span className="player-avatar player-avatar-fallback">
                        {player.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="player-name">{player.name}</span>
                  </a>
                </td>

                <td className="rating">{player.rating}</td>
                <td style={{ fontWeight: 800 }}>{total}</td>

                <td>
                  <span className="win">{player.wins}W</span>
                  {" / "}
                  <span className="loss">{player.losses}L</span>
                </td>

                <td>{winrate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

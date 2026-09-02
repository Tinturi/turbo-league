"use client";

import { FormEvent, useState } from "react";

type Player = {
  id: number;
  name: string;
  account_id: number;
  rating: number;
  wins: number;
  losses: number;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [ratings, setRatings] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, action: "list" }),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.ok) {
      setPlayers([]);
      setMessage(result.error ?? "Не удалось войти");
      return;
    }

    const loadedPlayers = result.players as Player[];
    setPlayers(loadedPlayers);
    setRatings(
      Object.fromEntries(loadedPlayers.map((player) => [player.id, String(player.rating)])),
    );
    setMessage("Доступ разрешён");
  }

  async function saveRating(player: Player) {
    const rating = Number(ratings[player.id]);

    if (!Number.isInteger(rating)) {
      setMessage("Рейтинг должен быть целым числом");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        password,
        action: "update",
        playerId: player.id,
        rating,
      }),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.ok) {
      setMessage(result.error ?? "Не удалось изменить рейтинг");
      return;
    }

    setPlayers((current) =>
      current.map((item) =>
        item.id === player.id ? { ...item, rating: result.player.rating } : item,
      ),
    );
    setMessage(`${player.name}: рейтинг изменён на ${result.player.rating}`);
  }

  return (
    <main className="admin-page">
      <section className="admin-panel">
        <div className="admin-heading">
          <p className="admin-kicker">Turbo League Season 2</p>
          <h1>Админ-панель</h1>
          <p>Здесь можно вручную изменить только текущий рейтинг игрока.</p>
        </div>

        {players.length === 0 ? (
          <form className="admin-login" onSubmit={login}>
            <label htmlFor="admin-password">Пароль администратора</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Введите пароль"
            />
            <button type="submit" disabled={loading || !password}>
              {loading ? "Проверяю..." : "Войти"}
            </button>
          </form>
        ) : (
          <div className="admin-player-list">
            {players.map((player) => (
              <div className="admin-player-row" key={player.id}>
                <div className="admin-player-info">
                  <strong>{player.name}</strong>
                  <span>
                    Сейчас: {player.rating} · {player.wins}W / {player.losses}L
                  </span>
                </div>
                <input
                  aria-label={`Рейтинг ${player.name}`}
                  type="number"
                  step="1"
                  value={ratings[player.id] ?? ""}
                  onChange={(event) =>
                    setRatings((current) => ({
                      ...current,
                      [player.id]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => saveRating(player)}
                >
                  Сохранить
                </button>
              </div>
            ))}
          </div>
        )}

        {message ? <p className="admin-message">{message}</p> : null}
        <a className="admin-back" href="/">← Вернуться к таблице</a>
      </section>
    </main>
  );
}

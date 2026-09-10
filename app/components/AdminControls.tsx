"use client";
import { useEffect, useState } from "react";

type Player = { id: number; name: string; rating: number; remaining: number };

function PlayerControls({ player, refresh }: { player: Player; refresh: () => Promise<void> }) {
  const [rating, setRating] = useState(String(player.rating));
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setRating(String(player.rating)); }, [player.rating]);
  async function save(action: "rating" | "dd", value: number) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, playerId: player.id, value, expected: action === "rating" ? player.rating : player.remaining }) });
      const data = await response.json();
      if (!response.ok) { await refresh(); throw new Error(data.error); }
      window.location.reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Не удалось сохранить"); setBusy(false); }
  }
  const quantity = Number(amount);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
  return <div className="admin-player-controls">
    <a href={"/player/" + player.id}><strong>{player.name}</strong></a>
    <p className="muted">Рейтинг: {player.rating} · Свободных DD: {player.remaining}</p>
    <form onSubmit={event => { event.preventDefault(); void save("rating", Number(rating)); }}>
      <label>Новый рейтинг<input type="number" min="0" max="1000000" step="1" required value={rating} onChange={event => setRating(event.target.value)} /></label>
      <button className="account-button" disabled={busy || rating.trim() === "" || Number(rating) === player.rating}>Сохранить рейтинг</button>
    </form>
    <div className="admin-dd-controls">
      <label>Количество DD<input type="number" min="1" max="100" step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <button className="account-button" disabled={busy || !validQuantity} onClick={() => void save("dd", quantity)}>Выдать DD</button>
      <button className="account-secondary" disabled={busy || !validQuantity || quantity > player.remaining} onClick={() => void save("dd", -quantity)}>Забрать DD</button>
    </div>
    <p className="muted">Заряды меняются на текущую неделю. Ручная правка рейтинга сохраняется при обновлении статистики.</p>
    {message && <p role="alert" className="loss">{message}</p>}
    {busy && <p role="status">Сохраняем…</p>}
  </div>;
}

export default function AdminControls({ playerId, standalone = false }: { playerId?: number; standalone?: boolean }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(false);
  async function load() {
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPlayers(data.players); setAdmin(true); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить"); }
  }
  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (data.isAdmin) { setAdmin(true); void load(); }
      else setError("Войдите в аккаунт администратора Tinturi.");
    }).catch(() => setError("Не удалось проверить доступ"));
  }, []);
  if (!admin && !standalone) return null;
  return <section className="profile-admin-controls">
    <h2>Режим администратора</h2>
    {error && <p role="alert">{error} <a href="/account">Вход</a></p>}
    {admin && !players && <p role="status">Загружаем участников…</p>}
    {(players ?? []).filter(player => !playerId || player.id === playerId).map(player => <PlayerControls key={player.id} player={player} refresh={load} />)}
    {admin && <button className="account-secondary" onClick={() => void load()}>Обновить значения</button>}
  </section>;
}

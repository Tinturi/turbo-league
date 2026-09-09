"use client";
import { useEffect, useState, FormEvent } from "react";

type Account = { username: string; player_id: number };
type Player = { id: number; name: string };

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/auth", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccount(data.account); setPlayers(data.players);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить аккаунт"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, username: form.get("username"), password: form.get("password"), playerId: Number(form.get("playerId")) }) });
      const data = await response.json();
      if (!response.ok) { void load(); throw new Error(data.error); }
      window.location.assign(`/player/${data.playerId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось выполнить запрос"); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      if (!response.ok) throw new Error();
      window.location.assign("/");
    } catch { setError("Не удалось выйти. Попробуйте снова."); setBusy(false); }
  }
  return <section className="account-card card">
    <a className="back" href="/">← К рейтингу</a>
    <h1>{account ? "Личный кабинет" : "Вход и регистрация"}</h1>
    {loading ? <p role="status">Загрузка…</p> : account ? <>
      <p>Вы вошли как <strong>{account.username}</strong>.</p>
      <a className="account-button" href={`/player/${account.player_id}`}>Мой профиль</a>
      <button className="account-secondary" onClick={logout} disabled={busy}>Выйти</button>
    </> : <>
      <div className="account-tabs"><button aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>Вход / Login</button><button aria-pressed={mode === "register"} onClick={() => { setMode("register"); setError(""); }}>Регистрация</button></div>
      <form onSubmit={submit} className="account-form">
        <label>Логин<input name="username" autoComplete="username" required minLength={3} maxLength={32} /></label>
        <span className="muted">3–32 буквы или цифры, также можно использовать . _ −. Регистр не важен.</span>
        <label>Пароль<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={10} maxLength={128} /></label>
        <span className="muted">От 10 символов. Сохраните пароль: восстановление через email не предусмотрено.</span>
        {mode === "register" && <><label>Ваш профиль<select name="playerId" required defaultValue=""><option value="" disabled>Выберите участника</option>{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p className="muted">Выбирайте только свой профиль. Занятые профили скрыты. Привязка постоянная.</p>{!players.length && <p>Свободных профилей нет.</p>}</>}
        <button className="account-button" disabled={busy || (mode === "register" && !players.length)}>{busy ? "Подождите…" : mode === "register" ? "Зарегистрироваться" : "Войти"}</button>
      </form>
    </>}
    {error && <p role="alert" className="loss">{error}</p>}
  </section>;
}

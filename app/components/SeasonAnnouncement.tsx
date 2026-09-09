import { supabase } from "@/lib/supabase";

export default async function SeasonAnnouncement() {
  const { data } = await supabase.from("league_announcements").select("starts_at,ends_at").eq("id", "season3-complete").maybeSingle();
  const now = Date.now();
  if (!data || now < Date.parse(data.starts_at) || now >= Date.parse(data.ends_at)) return null;
  return <section className="season-announcement" aria-label="Итоги Season 3">
    <img src="/season3-winner.png" alt="Победитель Turbo League Season 3" />
    <div><span className="season-kicker">TURBO LEAGUE · SEASON 3</span><h2>Третий сезон завершён!</h2><p>Все призы отправлены. Поздравляем победителя и спасибо каждому участнику за игры!</p><p className="muted">Готовимся к Season 4. Зарегистрируйтесь и привяжите свой профиль игрока.</p><a className="account-button" href="/account">Вход / Регистрация</a></div>
  </section>;
}

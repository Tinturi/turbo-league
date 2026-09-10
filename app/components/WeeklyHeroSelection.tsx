"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./WeeklyHeroSelection.module.css";

type Hero = { id: number; localized_name?: string; img?: string };
type HeroView = { id: number; name: string; image: string | null };
type Status = {
  weekStart: string;
  nextReset: string;
  owner: boolean;
  status: "not_started" | "skipped" | "selected";
  heroIds: number[];
  selectedAt: string | null;
  skippedAt: string | null;
  rerollBase: number;
  rerollBonuses: number;
  rerollUsed: number;
  rerollRemaining: number;
};

type Modal = "intro" | "picker" | "warning" | null;

function heroImage(hero: Hero) {
  return hero.img ? `https://cdn.cloudflare.steamstatic.com${hero.img}` : null;
}

export default function WeeklyHeroSelection({ playerId }: { playerId: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [heroes, setHeroes] = useState<HeroView[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadStatus() {
    const response = await fetch(`/api/weekly-heroes?playerId=${playerId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить героев недели");
    const next = data.status as Status;
    setStatus(next);
    setSelected(next.heroIds ?? []);
    if (next.owner && next.status === "not_started") setModal("intro");
    return next;
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [statusResponse, heroResponse] = await Promise.all([
          fetch(`/api/weekly-heroes?playerId=${playerId}`, { cache: "no-store", signal: controller.signal }),
          fetch("https://api.opendota.com/api/constants/heroes", { cache: "force-cache", signal: controller.signal }),
        ]);
        const statusData = await statusResponse.json();
        if (!statusResponse.ok || !statusData.ok) throw new Error(statusData.error || "Не удалось загрузить героев недели");
        const next = statusData.status as Status;
        setStatus(next);
        setSelected(next.heroIds ?? []);
        if (next.owner && next.status === "not_started") setModal("intro");

        if (heroResponse.ok) {
          const raw = await heroResponse.json() as Record<string, Hero>;
          const list = Object.values(raw)
            .map((hero) => ({ id: hero.id, name: hero.localized_name ?? `Hero ${hero.id}`, image: heroImage(hero) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setHeroes(list);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [playerId]);

  const heroMap = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);
  const selectedHeroes = selected.map((id) => heroMap.get(id) ?? { id, name: `Hero ${id}`, image: null });

  function toggleHero(id: number) {
    setError("");
    setSelected((current) => {
      if (current.includes(id)) return current.filter((heroId) => heroId !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }

  async function post(action: "skip" | "select" | "reroll") {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/weekly-heroes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action, heroIds: selected }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось сохранить выбор");
      setStatus(data.status as Status);
      setSelected(data.status.heroIds ?? []);
      if (action === "skip") setModal("warning");
      else setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className={styles.card}><div className={styles.note}>Загружаем героев игровой недели…</div></section>;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>SEASON 4 · ИГРОВАЯ НЕДЕЛЯ</div>
            <h2 className={styles.title}>Герои этой игровой недели</h2>
          </div>
          <span className={styles.note}>Новый выбор каждую субботу в 12:00 по Новосибирску</span>
        </div>

        {status?.status === "selected" ? (
          <div>
            <div className={styles.heroRow}>
              {selectedHeroes.map((hero) => (
                <div className={styles.heroCard} key={hero.id} title={hero.name}>
                  {hero.image ? <img className={styles.heroPortrait} src={hero.image} alt={hero.name} /> : <div className={styles.heroPortrait} />}
                  <div className={styles.heroName}>{hero.name}</div>
                </div>
              ))}
            </div>
            {status.owner ? <div className={styles.rerollBar}>
              <div><strong>Изменение четвёрки: {status.rerollRemaining}</strong><span className={styles.note}>1 заряд каждую неделю{status.rerollBonuses ? ` · +${status.rerollBonuses} за серии из 5 поражений` : " · дополнительные за 5 поражений подряд"}</span></div>
              <button className={styles.buttonSecondary} disabled={status.rerollRemaining <= 0} type="button" onClick={() => { setSelected([]); setError(""); setModal("picker"); }}>Изменить героев</button>
            </div> : null}
          </div>
        ) : (
          <div className={styles.warning}>
            <span>⚠️ Герои недели ещё не выбраны. Пока выбор не сделан, новые матчи игрока не учитываются в Turbo League Season 4.</span>
            {status?.owner ? <button className={styles.button} type="button" onClick={() => { setSelected([]); setModal("picker"); }}>Выбрать 4 героев</button> : null}
          </div>
        )}
        {error && !modal ? <div style={{ color: "#ff9292", marginTop: 10 }}>{error}</div> : null}
      </section>

      {modal === "intro" ? (
        <div className={styles.backdrop}>
          <section className={`${styles.modal} ${styles.intro}`} role="dialog" aria-modal="true" aria-label="Выбор героев недели">
            <div className={styles.introIcon}>⚔️</div>
            <div className={styles.kicker}>TURBO LEAGUE · SEASON 4</div>
            <h2>Готовы ли вы выбрать героев на эту неделю?</h2>
            <p>Выберите четыре героя. Только матчи на этих героях, сыгранные после момента выбора, будут идти в зачёт этой игровой недели.</p>
            <div className={styles.introActions}>
              <button className={styles.button} type="button" onClick={() => { setSelected([]); setModal("picker"); }}>Готов</button>
              <button className={styles.buttonSecondary} type="button" disabled={saving} onClick={() => void post("skip")}>Пропустить</button>
            </div>
            {error ? <div style={{ color: "#ff9292", marginTop: 14 }}>{error}</div> : null}
          </section>
        </div>
      ) : null}

      {modal === "warning" ? (
        <div className={styles.backdrop}>
          <section className={`${styles.modal} ${styles.warningModal}`} role="dialog" aria-modal="true" aria-label="Выбор героев пропущен">
            <div style={{ fontSize: 44 }}>⚠️</div>
            <h2>Выбор героев пропущен</h2>
            <p>Пока вы не выберете 4 героев этой игровой недели, ваши игры не будут учитываться в Turbo League Season 4.</p>
            <button className={styles.button} type="button" onClick={() => setModal(null)}>Понятно</button>
          </section>
        </div>
      ) : null}

      {modal === "picker" ? (
        <div className={styles.backdrop}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Список героев Dota 2">
            <div className={styles.pickerHeader}>
              <div>
                <div className={styles.kicker}>ВЫБОР ГЕРОЕВ НЕДЕЛИ</div>
                <h2>Выберите ровно 4 героев</h2>
                <div className={styles.note}>{status?.status === "selected" ? "Новая четвёрка начнёт действовать с момента подтверждения. Уже сыгранные матчи сохранятся." : "На выбранных героях можно играть сколько угодно зачётных матчей до следующего недельного обновления."}</div>
              </div>
              <div className={styles.counter}>{selected.length} / 4</div>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.heroGrid}>
              {heroes.map((hero) => {
                const active = selected.includes(hero.id);
                return (
                  <button key={hero.id} className={`${styles.heroButton} ${active ? styles.heroButtonSelected : ""}`} type="button" onClick={() => toggleHero(hero.id)}>
                    {hero.image ? <img className={styles.gridImage} src={hero.image} alt={hero.name} /> : <div className={styles.gridImage} />}
                    <span className={styles.gridName}>{hero.name}</span>
                    {active ? <span className={styles.check}>✓</span> : null}
                  </button>
                );
              })}
            </div>

            <div className={styles.selectionBar}>
              <div className={styles.slots}>
                {[0,1,2,3].map((index) => {
                  const hero = selectedHeroes[index];
                  return (
                    <div className={`${styles.slot} ${hero ? styles.slotFilled : ""}`} key={index}>
                      {hero ? <>{hero.image ? <img src={hero.image} alt="" /> : null}<strong>{hero.name}</strong></> : <span>Слот {index + 1}</span>}
                    </div>
                  );
                })}
              </div>
              <div className={styles.actions}>
                <button className={styles.buttonSecondary} type="button" disabled={saving} onClick={() => setModal(status?.status === "not_started" ? "intro" : null)}>Назад</button>
                <button className={styles.button} type="button" disabled={saving || selected.length !== 4} onClick={() => void post(status?.status === "selected" ? "reroll" : "select")}>{saving ? "Сохраняем…" : status?.status === "selected" ? "Изменить четвёрку" : "Подтвердить 4 героев"}</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

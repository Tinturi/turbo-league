"use client";

import { useState } from "react";
import styles from "./SeasonAnnouncementModal.module.css";

export default function SeasonAnnouncementModal() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Итоги Season 3">
        <button className={styles.close} type="button" aria-label="Закрыть поздравление" onClick={() => setOpen(false)}>×</button>
        <div className={styles.imageWrap}>
          <img className={styles.image} src="/season3-winner.png" alt="Победитель Turbo League Season 3" />
        </div>
        <div className={styles.content}>
          <span className={styles.kicker}>TURBO LEAGUE · SEASON 3</span>
          <h2 className={styles.title}>Третий сезон завершён!</h2>
          <p className={styles.copy}>Все призы отправлены. Поздравляем победителя и спасибо каждому участнику за игры!</p>
          <p className={styles.subcopy}>Готовимся к Season 4. Зарегистрируйтесь и привяжите свой профиль игрока.</p>
          <a className={styles.accountButton} href="/account">Вход / Регистрация</a>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

function getSecondsUntilNextHalfHour() {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  if (now.getMinutes() < 30) {
    next.setMinutes(30);
  } else {
    next.setHours(now.getHours() + 1);
    next.setMinutes(0);
  }

  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function RefreshCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilNextHalfHour());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft(getSecondsUntilNextHalfHour());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="refresh-clock" title="Следующее автоматическое обновление статистики">
      <span className="refresh-clock-icon" aria-hidden="true">◷</span>
      <span className="refresh-clock-copy">
        <span className="refresh-clock-label">Обновление через</span>
        <strong className="refresh-clock-time">{formatTime(secondsLeft)}</strong>
      </span>
    </div>
  );
}

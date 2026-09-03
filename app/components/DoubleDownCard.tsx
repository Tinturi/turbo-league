"use client";

import { useEffect, useState } from "react";

type Status = {
  weekStart: string; nextReset: string; base: number; bonuses: number; total: number; used: number;
  pending: { id: number; activatedAt: string } | null; remaining: number;
  extraRating: number; extraWon: number; extraLost: number;
};
type ApiResponse = { ok: boolean; error?: string; message?: string; status?: Status };

function formatReset(value?: string) {
  if (!value) return "суббота, 12:00";
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Novosibirsk" }).format(new Date(value));
}
function signed(value: number) { return value > 0 ? `+${value}` : `${value}`; }

export default function DoubleDownCard({ playerId }: { playerId: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/double-down?playerId=${playerId}`, { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok || !data.status) throw new Error(data.error || "Не удалось загрузить Double Down");
      setStatus(data.status);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [playerId]);

  async function activate() {
    if (!status || activating || status.pending || status.remaining <= 0) return;
    setActivating(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/double-down", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId }) });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok || !data.status) throw new Error(data.error || "Не удалось активировать Double Down");
      setStatus(data.status); setMessage(data.message || "Double Down активирован");
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActivating(false); }
  }

  const net = status?.extraRating ?? 0;
  return (
    <section style={{ marginBottom: 24, padding: 22, border: "1px solid rgba(233,184,75,.36)", borderRadius: 18, background: "linear-gradient(135deg, rgba(62,31,6,.78), rgba(16,20,29,.96) 52%, rgba(10,14,21,.96))", boxShadow: "0 18px 45px rgba(0,0,0,.24)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 240, flex: "1 1 380px" }}>
          <div style={{ color: "#e9b84b", fontSize: 12, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>🔥 Double Down</div>
          <h2 style={{ margin: "7px 0 7px", fontSize: 26 }}>Удвоить рейтинг текущего матча</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5, maxWidth: 690 }}>Нажимай после начала Turbo-матча и оценки пиков. Система привяжет DD к игре, которая началась не более 10 минут назад. Победа и поражение обе считаются x2.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(82px, 1fr))", gap: 8, minWidth: 280 }}>
          <div style={{ padding: "12px 14px", borderRadius: 13, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}><span className="muted" style={{ fontSize: 11 }}>ОСТАЛОСЬ</span><strong style={{ display: "block", fontSize: 25, marginTop: 3, color: "#e9b84b" }}>{loading ? "…" : status?.remaining ?? "—"}</strong></div>
          <div style={{ padding: "12px 14px", borderRadius: 13, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}><span className="muted" style={{ fontSize: 11 }}>БОНУС</span><strong style={{ display: "block", fontSize: 25, marginTop: 3, color: "#72e0a6" }}>{loading ? "…" : `+${status?.bonuses ?? 0}`}</strong></div>
          <div style={{ padding: "12px 14px", borderRadius: 13, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}><span className="muted" style={{ fontSize: 11 }}>ВСЕГО</span><strong style={{ display: "block", fontSize: 25, marginTop: 3 }}>{loading ? "…" : status?.total ?? "—"}</strong></div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 15, borderRadius: 14, background: "rgba(0,0,0,.18)", border: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".1em", color: "#aeb7c7", marginBottom: 10 }}>РЕЗУЛЬТАТ DOUBLE DOWN · ЭТА НЕДЕЛЯ</div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "baseline" }}>
          <div><span className="muted" style={{ fontSize: 12 }}>Доп. рейтинг </span><strong style={{ fontSize: 24, color: net > 0 ? "#72e0a6" : net < 0 ? "#ff8585" : "#e9b84b" }}>{loading ? "…" : signed(net)}</strong></div>
          <div><span className="muted" style={{ fontSize: 12 }}>Заработано </span><strong className="win">{loading ? "…" : `+${status?.extraWon ?? 0}`}</strong></div>
          <div><span className="muted" style={{ fontSize: 12 }}>Потеряно </span><strong className="loss">{loading ? "…" : `-${status?.extraLost ?? 0}`}</strong></div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={activate} disabled={loading || activating || Boolean(status?.pending) || (status?.remaining ?? 0) <= 0} style={{ border: "1px solid rgba(255,190,73,.62)", borderRadius: 13, padding: "13px 18px", background: status?.pending ? "rgba(255,156,45,.15)" : "#e9b84b", color: status?.pending ? "#f4bf66" : "#17120a", fontWeight: 900, fontSize: 14, cursor: loading || activating || status?.pending || (status?.remaining ?? 0) <= 0 ? "default" : "pointer", opacity: loading || activating || (status?.remaining ?? 0) <= 0 ? .66 : 1 }}>
          {activating ? "АКТИВИРУЮ…" : status?.pending ? "🔥 DOUBLE DOWN АКТИВЕН" : "🔥 АКТИВИРОВАТЬ DOUBLE DOWN"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>Новая неделя: {formatReset(status?.nextReset)} по Новосибирску</span>
      </div>
      {status?.pending ? <div style={{ marginTop: 13, padding: "11px 13px", borderRadius: 11, color: "#f2c36e", background: "rgba(233,184,75,.08)", border: "1px solid rgba(233,184,75,.22)" }}>DD зарезервирован. После следующего обновления таблицы он будет привязан к подходящему матчу.</div> : null}
      {message ? <div style={{ marginTop: 13, color: "#72e0a6", fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ marginTop: 13, color: "#ff8585", fontSize: 13 }}>{error}</div> : null}
      <div className="muted" style={{ marginTop: 13, fontSize: 12 }}>База: 5 DD в неделю. За каждые 3 поражения подряд без победы между ними система автоматически добавляет ещё +1 DD после синхронизации.</div>
    </section>
  );
}

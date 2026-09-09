"use client";
import { useEffect, useRef, useState } from "react";

export default function AvatarEditor({ playerId, accountId }: { playerId: number; accountId: number }) {
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/auth", { cache: "no-store" }).then(r => r.json()).then(d => setOwner(Number(d.account?.player_id) === playerId)).catch(() => {}); }, [playerId]);
  if (!owner) return null;
  return <>
    <button type="button" aria-label={busy ? "Сохраняем аватар" : "Изменить аватар"} title="Изменить аватар · PNG, JPEG или WebP, до 512 КБ" disabled={busy} onClick={() => inputRef.current?.click()} style={{ position: "absolute", right: -3, bottom: -3, width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "50%", border: "2px solid #07090d", background: "#e9b84b", color: "#17120a", cursor: busy ? "wait" : "pointer", opacity: busy ? .6 : 1, boxShadow: "0 2px 8px #0006" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 15 16 3a3.54 3.54 0 0 1 5 5L9 20l-6 1 1-6Z" /></svg>
    </button>
    <input ref={inputRef} hidden aria-label="Файл аватара" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > 512 * 1024) { setError("Максимальный размер — 512 КБ."); return; }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const response = await fetch(`/api/avatar/${accountId}`, { method: "POST", headers: { "Content-Type": file.type }, body: bytes });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить аватар"); }
    finally { setBusy(false); }
  }} />
    {busy && <span role="status" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, fontSize: 12, lineHeight: 1.4 }}>Сохраняем…</span>}
    {error && <p role="alert" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 240, padding: 10, margin: 0, borderRadius: 8, background: "#24151b", color: "#ff8585", fontSize: 13, lineHeight: 1.4, zIndex: 5 }}>{error}</p>}
  </>;
}

"use client";
import { useEffect, useState } from "react";

export default function AvatarEditor({ playerId, accountId }: { playerId: number; accountId: number }) {
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/auth", { cache: "no-store" }).then(r => r.json()).then(d => setOwner(Number(d.account?.player_id) === playerId)).catch(() => {}); }, [playerId]);
  if (!owner) return null;
  return <div className="avatar-editor"><label>Изменить аватар<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async event => {
    const file = event.target.files?.[0];
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
  }} /></label><p className="muted">PNG, JPEG или WebP, до 512 КБ.{busy ? " Сохраняем…" : ""}</p>{error && <p role="alert" className="loss">{error}</p>}</div>;
}

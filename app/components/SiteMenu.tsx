"use client";

import { useEffect, useRef, useState } from "react";

export default function SiteMenu() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ id: number; name: string; account_id: number } | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadProfile() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        setIsAdmin(Boolean(data.isAdmin));
        setProfile(data.account ? data.profile : null);
        setAvatar(null);
        if (data.account && data.profile?.account_id) {
          const image = await fetch(`/api/avatar/${data.profile.account_id}`, { cache: "no-store", signal: controller.signal });
          if (image.ok) {
            const result = await image.json();
            if (!controller.signal.aborted) setAvatar(result.avatar ?? null);
          }
        }
      } catch { /* Keep the menu usable if the connection is unavailable. */ }
    }
    void loadProfile();
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Открыть меню"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid rgba(233,184,75,.35)",
          borderRadius: 12,
          background: "rgba(14,19,28,.86)",
          color: "#f5f7fb",
          padding: "9px 12px",
          font: "inherit",
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 8px 22px rgba(0,0,0,.2)",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
        <span>{isAdmin ? "Админ · Меню" : "Меню"}</span>
      </button>

      {open ? (
        <nav
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 220,
            padding: 8,
            border: "1px solid #2d3545",
            borderRadius: 14,
            background: "rgba(10,14,21,.98)",
            boxShadow: "0 18px 45px rgba(0,0,0,.45)",
            zIndex: 50,
          }}
        >
          <a
            href={profile ? `/player/${profile.id}` : "/account"}
            onClick={() => setOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 10, color: "#e9edf5", fontWeight: 700 }}
          >
            {profile ? <>
              {avatar ? <img src={avatar} alt="" width={40} height={40} onError={() => setAvatar(null)} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} /> : <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: "#2d3545", display: "grid", placeItems: "center", flexShrink: 0 }}>{profile.name.slice(0, 1).toUpperCase()}</span>}
              <span style={{ minWidth: 0 }}><span style={{ display: "block", color: "#e9b84b" }}>Мой профиль</span><span style={{ display: "block", overflowWrap: "anywhere", fontSize: 14, marginTop: 4 }}>{profile.name}</span></span>
            </> : "👤 Login / Регистрация"}
          </a>
          {isAdmin && <a href="/admin" style={{ display: "block", padding: 13, color: "#e9b84b" }}>Управление участниками</a>}
          {[
            ["🏆 Лидерборд", "/"],
            ["📊 Статистика сезона", "/stats"],
            ["📜 Регламент", "/rules"],
            ["✉️ Контакты", "/contacts"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "12px 13px",
                borderRadius: 10,
                color: "#e9edf5",
                fontWeight: 700,
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

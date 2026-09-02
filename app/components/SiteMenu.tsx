"use client";

import { useEffect, useRef, useState } from "react";

export default function SiteMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        <span>Меню</span>
      </button>

      {open ? (
        <nav
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 210,
            padding: 8,
            border: "1px solid #2d3545",
            borderRadius: 14,
            background: "rgba(10,14,21,.98)",
            boxShadow: "0 18px 45px rgba(0,0,0,.45)",
            zIndex: 50,
          }}
        >
          {[
            ["Лидерборд", "/"],
            ["Регламент", "/rules"],
            ["Контакты", "/contacts"],
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

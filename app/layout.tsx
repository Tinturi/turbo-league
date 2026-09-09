import "./globals.css";
import "./season3.css";
import "./season4.css";
import "./accounts.css";
import SiteMenu from "@/app/components/SiteMenu";
import Season4ProfileEnhancer from "@/app/components/Season4ProfileEnhancer";

export const metadata = {
  title: "Turbo League",
  description: "Dota 2 Turbo rating league",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="header">
          <a href="/" className="brand">⚡ Turbo League</a>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href="/account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 40,
                padding: "9px 14px",
                border: "1px solid rgba(233,184,75,.45)",
                borderRadius: 12,
                background: "#e9b84b",
                color: "#17120a",
                fontWeight: 800,
                boxShadow: "0 8px 22px rgba(0,0,0,.2)",
                whiteSpace: "nowrap",
              }}
            >
              Вход / Регистрация
            </a>
            <SiteMenu />
          </div>
        </header>
        <main className="container">{children}</main>
        <Season4ProfileEnhancer />
      </body>
    </html>
  );
}

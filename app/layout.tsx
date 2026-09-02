import "./globals.css";

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
          <span className="muted">Dota 2 Turbo Rating</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

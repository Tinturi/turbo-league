import "./globals.css";
import SiteMenu from "@/app/components/SiteMenu";

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
          <SiteMenu />
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

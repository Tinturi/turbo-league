export default function ContactsPage() {
  return (
    <section
      style={{
        minHeight: "calc(100vh - 68px)",
        margin: "0 calc(50% - 50vw)",
        padding: "72px max(20px, calc((100vw - 1000px)/2)) 90px",
        backgroundImage:
          "linear-gradient(rgba(7,9,13,.76), rgba(7,9,13,.92)), url('/turbo-bg.svg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "32px",
          border: "1px solid #2a3140",
          borderRadius: 20,
          background: "rgba(10,14,21,.92)",
          boxShadow: "0 24px 80px rgba(0,0,0,.45)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ color: "#e9b84b", fontWeight: 800, letterSpacing: ".15em", textTransform: "uppercase", fontSize: 12 }}>
          Turbo League · Season 2
        </div>
        <h1 style={{ margin: "8px 0 10px", fontSize: "clamp(34px, 6vw, 54px)" }}>Контакты</h1>
        <p style={{ margin: "0 0 28px", color: "#aeb7c7", fontSize: 16 }}>
          Связь с создателем лиги.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <a
            href="https://t.me/Tinturis"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
              padding: "22px",
              border: "1px solid #293142",
              borderRadius: 16,
              background: "rgba(17,22,32,.88)",
            }}
          >
            <div>
              <div style={{ color: "#8f98aa", fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                Telegram
              </div>
              <strong style={{ fontSize: 22 }}>@Tinturis</strong>
            </div>
            <span style={{ color: "#e9b84b", fontSize: 24 }}>↗</span>
          </a>

          <a
            href="https://steamcommunity.com/profiles/76561198221504436"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
              padding: "22px",
              border: "1px solid #293142",
              borderRadius: 16,
              background: "rgba(17,22,32,.88)",
            }}
          >
            <div>
              <div style={{ color: "#8f98aa", fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                Steam
              </div>
              <strong style={{ fontSize: 22 }}>Профиль создателя</strong>
            </div>
            <span style={{ color: "#e9b84b", fontSize: 24 }}>↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}

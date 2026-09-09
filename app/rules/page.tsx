export default function RulesPage() {
  const rules = [
    "В зачёт Season 4 идут только игры, сыгранные в режиме Turbo после 09.09.2026 18:00 по новосибирскому времени.",
    "Первые 5 зачётных игр участника являются калибровочными: победа даёт +50 рейтинга, поражение — -50. Начиная с 6-й зачётной игры изменение рейтинга составляет +25 за победу и -25 за поражение.",
    "Рейтинг участника не может опуститься ниже 0. Если поражение должно увести рейтинг в минус, рейтинг останавливается на отметке 0.",
    "Каждую игровую неделю участник выбирает ровно 4 героев. Новая игровая неделя начинается каждую субботу в 12:00 по новосибирскому времени.",
    "После недельного обновления при первом входе в свой профиль участнику предлагается выбрать героев недели. Можно нажать «Готов» и выбрать 4 героев или нажать «Пропустить».",
    "Пока участник не выбрал 4 героев недели, его новые игры не учитываются в Turbo League Season 4. После подтверждения в зачёт идут только Turbo-игры на выбранных 4 героях и только те матчи, которые начались после момента подтверждения выбора.",
    "На каждом из четырёх выбранных героев можно играть сколько угодно зачётных матчей до следующего недельного обновления. После субботнего сброса необходимо выбрать новую четвёрку героев.",
    "Double Down остаётся без изменений: каждому участнику доступно 5 DD на игровую неделю. DD можно активировать после начала матча; если активация попадает в разрешённое окно, победный или проигрышный рейтинг этого матча удваивается.",
    "За каждые 3 поражения подряд без победы между ними участник автоматически получает +1 дополнительный Double Down после обновления таблицы. За серию из 6 поражений подряд — +2, из 9 — +3 и так далее.",
  ];

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
          maxWidth: 900,
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
          Turbo League · Season 4
        </div>
        <h1 style={{ margin: "8px 0 10px", fontSize: "clamp(34px, 6vw, 54px)" }}>Регламент</h1>
        <p style={{ margin: "0 0 28px", color: "#aeb7c7", fontSize: 16 }}>
          Основные правила участия в четвёртом сезоне Turbo League. Старт сезона: 09.09.2026 18:00 по Новосибирску.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          {rules.map((rule, index) => (
            <div
              key={rule}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr",
                gap: 16,
                alignItems: "start",
                padding: "20px",
                border: "1px solid #293142",
                borderRadius: 16,
                background: "rgba(17,22,32,.88)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 13,
                  color: "#17120a",
                  background: "#e9b84b",
                  fontWeight: 900,
                  fontSize: 20,
                }}
              >
                {index + 1}
              </div>
              <div style={{ fontSize: 18, lineHeight: 1.55 }}>{rule}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

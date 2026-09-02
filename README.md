# Turbo League — MVP starter

Публичный сайт рейтингов Dota 2 Turbo.

## Стек
- Next.js
- Supabase/Postgres
- OpenDota API
- Vercel

## Уже есть
- лидерборд;
- страница игрока;
- история рейтинга/матчей;
- SQL-схема;
- защищённая заготовка `/api/sync`;
- рейтинг 1000, +20 / -20.

## Запуск локально
```bash
npm install
npm run dev
```

Открой http://localhost:3000

## Подключение Supabase
1. Создай проект Supabase.
2. Выполни `supabase/schema.sql` в SQL Editor.
3. Скопируй `.env.example` в `.env.local`.
4. Заполни Supabase URL/key.
5. Замени mock-данные на запросы к таблицам `players` и `matches`.

## Синхронизация OpenDota
В `/app/api/sync/route.ts` находится точка входа для фонового обновления.
Ключевой принцип: `(match_id, player_id)` — primary key, поэтому одна игра
никогда не начислит рейтинг дважды.

Для определения победы:
- `player_slot < 128` => Radiant;
- иначе Dire;
- результат сравнивается с `radiant_win`.

Перед продом нужно проверить актуальный numeric `game_mode` Turbo
по реальному ответу OpenDota и только после этого включать автоматический фильтр.


## Первые участники
- Артём — Dota ID `261238708`
- Денчик — Dota ID `152657599`

После `schema.sql` можно выполнить `supabase/seed.sql`, чтобы добавить их в базу.

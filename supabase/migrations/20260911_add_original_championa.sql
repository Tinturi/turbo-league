-- Add the new Season 4 participant without changing existing player statistics.
insert into public.players (
  name,
  account_id,
  rating,
  wins,
  losses,
  active,
  tracking_from
)
values (
  'ОРИГИНАЛ ЧЕМПИОНА',
  211535438,
  0,
  0,
  0,
  true,
  now()
)
on conflict (account_id) do update
set name = excluded.name,
    active = true;

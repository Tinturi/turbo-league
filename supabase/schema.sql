create table if not exists players (
  id bigint generated always as identity primary key,
  name text not null,
  account_id bigint not null unique,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  match_id bigint not null,
  player_id bigint not null references players(id) on delete cascade,
  start_time timestamptz,
  hero_id integer,
  won boolean not null,
  rating_delta integer not null,
  rating_after integer not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists matches_player_time_idx
on matches(player_id, start_time desc);

alter table players enable row level security;
alter table matches enable row level security;

create policy "Public can read players"
on players for select using (true);

create policy "Public can read matches"
on matches for select using (true);

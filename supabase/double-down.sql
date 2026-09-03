-- Turbo League Season 3: Double Down system
-- Run this file once in Supabase SQL Editor.

create table if not exists double_down_activations (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  activated_at timestamptz not null default now(),
  week_start timestamptz not null,
  status text not null default 'pending' check (status in ('pending','used','expired')),
  match_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists double_down_activations_player_week_idx
on double_down_activations(player_id, week_start, activated_at desc);

create unique index if not exists double_down_one_used_match_idx
on double_down_activations(player_id, match_id)
where match_id is not null and status = 'used';

create table if not exists double_down_bonuses (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  week_start timestamptz not null,
  source_match_id bigint not null,
  reason text not null default 'three_losses',
  created_at timestamptz not null default now(),
  unique(player_id, source_match_id)
);

create index if not exists double_down_bonuses_player_week_idx
on double_down_bonuses(player_id, week_start);

alter table double_down_activations enable row level security;
alter table double_down_bonuses enable row level security;

-- Writes are intentionally server-only through SUPABASE_SECRET_KEY.
-- Public status is returned by /api/double-down, so no anon table policies are required.

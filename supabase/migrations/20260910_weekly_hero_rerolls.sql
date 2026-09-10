begin;

create table if not exists public.weekly_hero_selection_history (
  id bigint generated always as identity primary key,
  player_id bigint not null references public.players(id) on delete cascade,
  week_start timestamptz not null,
  hero_ids integer[] not null,
  selected_at timestamptz not null,
  constraint weekly_hero_history_count check (cardinality(hero_ids) = 4),
  unique (player_id, selected_at)
);

create index if not exists weekly_hero_history_player_week_idx
  on public.weekly_hero_selection_history(player_id, week_start, selected_at);

create table if not exists public.weekly_hero_reroll_bonuses (
  player_id bigint not null references public.players(id) on delete cascade,
  week_start timestamptz not null,
  source_match_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (player_id, source_match_id)
);

alter table public.weekly_hero_selection_history enable row level security;
alter table public.weekly_hero_reroll_bonuses enable row level security;
revoke all on public.weekly_hero_selection_history, public.weekly_hero_reroll_bonuses from public, anon, authenticated;
grant all on public.weekly_hero_selection_history, public.weekly_hero_reroll_bonuses to service_role;
grant usage, select on sequence public.weekly_hero_selection_history_id_seq to service_role;

insert into public.weekly_hero_selection_history(player_id, week_start, hero_ids, selected_at)
select player_id, week_start, hero_ids, selected_at
from public.weekly_hero_selections
where status = 'selected' and selected_at is not null
on conflict (player_id, selected_at) do nothing;

create or replace function public.reroll_owned_weekly_heroes(target_player bigint, new_heroes integer[])
returns void language plpgsql security definer set search_path = '' as $$
declare boundary timestamptz; current_heroes integer[]; initial_at timestamptz; bonus_count integer; selection_count integer; chosen_at timestamptz;
begin
  perform 1 from public.players where id = target_player and active for update;
  if not found then raise exception 'Player unavailable'; end if;
  if cardinality(new_heroes) <> 4 or (select count(distinct value) from unnest(new_heroes) value) <> 4
    or exists(select 1 from unnest(new_heroes) value where value <= 0) then raise exception 'Invalid heroes'; end if;
  boundary := public.league_week_start();
  select hero_ids, selected_at into current_heroes, initial_at from public.weekly_hero_selections
    where player_id = target_player and week_start = boundary and status = 'selected' for update;
  if not found then raise exception 'Initial heroes unavailable'; end if;
  if current_heroes <@ new_heroes and new_heroes <@ current_heroes then raise exception 'Choose a different quartet'; end if;
  insert into public.weekly_hero_selection_history(player_id, week_start, hero_ids, selected_at)
    values(target_player, boundary, current_heroes, initial_at) on conflict(player_id, selected_at) do nothing;
  select count(*) into bonus_count from public.weekly_hero_reroll_bonuses where player_id = target_player and week_start = boundary;
  select count(*) into selection_count from public.weekly_hero_selection_history where player_id = target_player and week_start = boundary;
  if greatest(0, selection_count - 1) >= 1 + bonus_count then raise exception 'Reroll allowance exhausted'; end if;
  select greatest(clock_timestamp(), coalesce(max(selected_at) + interval '1 microsecond', clock_timestamp())) into chosen_at
    from public.weekly_hero_selection_history where player_id = target_player;
  update public.weekly_hero_selections set hero_ids = new_heroes, selected_at = chosen_at, updated_at = chosen_at
    where player_id = target_player and week_start = boundary;
  insert into public.weekly_hero_selection_history(player_id, week_start, hero_ids, selected_at)
    values(target_player, boundary, new_heroes, chosen_at);
end;
$$;

revoke all on function public.reroll_owned_weekly_heroes(bigint, integer[]) from public, anon, authenticated;
grant execute on function public.reroll_owned_weekly_heroes(bigint, integer[]) to service_role;
commit;

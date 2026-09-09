-- Additive migration. Does not reset players, ratings, matches or Season 3.
begin;

create table if not exists public.player_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  player_id bigint not null unique references public.players(id),
  created_at timestamptz not null default now()
);
alter table public.player_accounts enable row level security;
revoke all on public.player_accounts from anon, authenticated;
grant all on public.player_accounts to service_role;

-- Only the server can set app_metadata. User-editable metadata is never trusted.
create or replace function public.bind_league_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'league_username' is null then return new; end if;
  if not exists (select 1 from public.players where id = (new.raw_app_meta_data->>'league_player_id')::bigint and active) then
    raise exception 'Player is unavailable';
  end if;
  insert into public.player_accounts(user_id, username, player_id)
  values (new.id, new.raw_app_meta_data->>'league_username', (new.raw_app_meta_data->>'league_player_id')::bigint);
  return new;
end;
$$;
revoke all on function public.bind_league_account() from public, anon, authenticated;
create trigger league_account_created after insert on auth.users
for each row execute function public.bind_league_account();

create table if not exists public.player_avatars (
  player_id bigint primary key references public.players(id),
  image text not null check (length(image) <= 700000),
  updated_at timestamptz not null default now()
);
alter table public.player_avatars enable row level security;
revoke all on public.player_avatars from anon, authenticated;
grant select on public.player_avatars to anon, authenticated;
grant all on public.player_avatars to service_role;
create policy "Public avatar read" on public.player_avatars for select using (true);

create table if not exists public.auth_attempts (
  key text primary key,
  started_at timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;
grant all on public.auth_attempts to service_role;
create or replace function public.consume_auth_attempt(attempt_key text, attempt_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_used integer;
begin
  insert into public.auth_attempts as a(key) values (attempt_key)
  on conflict(key) do update set
    attempts = case when a.started_at < now() - interval '15 minutes' then 1 else a.attempts + 1 end,
    started_at = case when a.started_at < now() - interval '15 minutes' then now() else a.started_at end
  returning attempts into count_used;
  return count_used <= attempt_limit;
end;
$$;
revoke all on function public.consume_auth_attempt(text,integer) from public, anon, authenticated;
grant execute on function public.consume_auth_attempt(text,integer) to service_role;

-- Also close direct table writes even if an older deployment added broad policies.
revoke insert, update, delete on public.players, public.matches, public.double_down_activations, public.double_down_bonuses from anon, authenticated;

create table if not exists public.league_announcements (
  id text primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);
alter table public.league_announcements enable row level security;
revoke all on public.league_announcements from anon, authenticated;
grant select on public.league_announcements to anon, authenticated;
grant all on public.league_announcements to service_role;
create policy "Public announcement read" on public.league_announcements for select using (true);
-- Activate separately at deployment, so the five-day clock does not start during preparation.
create or replace function public.activate_owned_double_down(target_player bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare boundary timestamptz; pending_count integer; used_count integer; bonus_count integer;
begin
  -- Lock the player so concurrent requests cannot spend the same allowance.
  perform 1 from public.players where id = target_player and active for update;
  if not found then raise exception 'Player unavailable'; end if;
  boundary := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    - ((extract(dow from now() at time zone 'UTC')::integer + 1) % 7) * interval '1 day' + interval '5 hours';
  if now() < boundary then boundary := boundary - interval '7 days'; end if;
  update public.double_down_activations set status = 'expired'
    where player_id = target_player and status = 'pending' and activated_at < now() - interval '3 hours';
  select count(*) filter (where status = 'pending'), count(*) filter (where status in ('pending','used'))
    into pending_count, used_count from public.double_down_activations where player_id = target_player and week_start = boundary;
  select count(*) into bonus_count from public.double_down_bonuses where player_id = target_player and week_start = boundary;
  if pending_count > 0 or used_count >= 5 + bonus_count then raise exception 'Double Down unavailable'; end if;
  insert into public.double_down_activations(player_id, week_start, status) values (target_player, boundary, 'pending');
end;
$$;
revoke all on function public.activate_owned_double_down(bigint) from public, anon, authenticated;
grant execute on function public.activate_owned_double_down(bigint) to service_role;
commit;

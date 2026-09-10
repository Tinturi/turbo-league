begin;
alter table public.players add column if not exists admin_rating_offset integer not null default 0;
create table if not exists public.dd_admin_adjustments (
  player_id bigint not null references public.players(id), week_start timestamptz not null,
  amount integer not null default 0, primary key(player_id, week_start)
);
create table if not exists public.league_admin_audit (
  id bigint generated always as identity primary key, actor uuid not null,
  player_id bigint not null references public.players(id), action text not null,
  previous_value integer not null, next_value integer not null, created_at timestamptz not null default now()
);
alter table public.dd_admin_adjustments enable row level security;
alter table public.league_admin_audit enable row level security;
revoke all on public.dd_admin_adjustments, public.league_admin_audit from public, anon, authenticated;
grant all on public.dd_admin_adjustments, public.league_admin_audit to service_role;
grant usage, select on sequence public.league_admin_audit_id_seq to service_role;

create or replace function public.league_week_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('week', (now() at time zone 'UTC') - interval '5 days 5 hours') at time zone 'UTC' + interval '5 days 5 hours';
$$;

create or replace function public.admin_update_player(actor_id uuid, target_player bigint, operation text, new_value integer, expected_value integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_rating integer; balance integer; bonus_count integer; used_count integer; adjustment integer; boundary timestamptz;
begin
  if actor_id is distinct from '3d8f7c0d-82f9-458c-af0a-a296d66948a6'::uuid
    or not exists(select 1 from public.player_accounts where user_id=actor_id and username='tinturi' and player_id=1)
    then raise exception 'Admin access denied'; end if;
  select rating into current_rating from public.players where id=target_player and active for update;
  if not found then raise exception 'Player unavailable'; end if;
  if new_value is null or expected_value is null then raise exception 'Invalid value'; end if;
  if operation = 'rating' then
    if new_value < 0 or new_value > 1000000 then raise exception 'Invalid rating'; end if;
    if current_rating <> expected_value then raise exception 'Value changed; refresh'; end if;
    update public.players set admin_rating_offset=admin_rating_offset+new_value-current_rating, rating=new_value where id=target_player;
    insert into public.league_admin_audit(actor,player_id,action,previous_value,next_value) values(actor_id,target_player,operation,current_rating,new_value);
  elsif operation = 'dd' then
    if new_value=0 or abs(new_value::bigint)>100 then raise exception 'Invalid DD adjustment'; end if;
    boundary := public.league_week_start();
    update public.double_down_activations set status='expired' where player_id=target_player and status='pending' and activated_at < now()-interval '3 hours';
    select count(*) into bonus_count from public.double_down_bonuses where player_id=target_player and week_start=boundary;
    select count(*) into used_count from public.double_down_activations where player_id=target_player and week_start=boundary and status in ('pending','used');
    select coalesce(sum(amount),0) into adjustment from public.dd_admin_adjustments where player_id=target_player and week_start=boundary;
    balance := greatest(0,5+bonus_count+adjustment-used_count);
    if balance <> expected_value then raise exception 'Value changed; refresh'; end if;
    if balance+new_value < 0 then raise exception 'Not enough remaining DD'; end if;
    insert into public.dd_admin_adjustments(player_id,week_start,amount) values(target_player,boundary,new_value)
      on conflict(player_id,week_start) do update set amount=public.dd_admin_adjustments.amount+excluded.amount;
    insert into public.league_admin_audit(actor,player_id,action,previous_value,next_value) values(actor_id,target_player,operation,balance,balance+new_value);
  else raise exception 'Unknown operation'; end if;
end;
$$;

create or replace function public.apply_player_sync(target_player bigint, base_rating integer, new_wins integer, new_losses integer, season_start timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.players where id=target_player for update;
  update public.players set rating=greatest(0,base_rating+admin_rating_offset), wins=new_wins, losses=new_losses, tracking_from=season_start where id=target_player;
end;
$$;

create or replace function public.activate_owned_double_down(target_player bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare boundary timestamptz; latest timestamptz; used_count integer; bonus_count integer; adjustment integer;
begin
  perform 1 from public.players where id=target_player and active for update;
  if not found then raise exception 'Player unavailable'; end if;
  select max(activated_at) into latest from public.double_down_activations where player_id=target_player;
  if latest+interval '10 minutes' > now() then raise exception 'Double Down cooldown'; end if;
  boundary := public.league_week_start();
  update public.double_down_activations set status='expired' where player_id=target_player and status='pending' and activated_at < now()-interval '3 hours';
  select count(*) into used_count from public.double_down_activations where player_id=target_player and week_start=boundary and status in ('pending','used');
  select count(*) into bonus_count from public.double_down_bonuses where player_id=target_player and week_start=boundary;
  select coalesce(sum(amount),0) into adjustment from public.dd_admin_adjustments where player_id=target_player and week_start=boundary;
  if used_count >= 5+bonus_count+adjustment then raise exception 'Double Down allowance exhausted'; end if;
  insert into public.double_down_activations(player_id,week_start,status) values(target_player,boundary,'pending');
end;
$$;
revoke all on function public.admin_update_player(uuid,bigint,text,integer,integer), public.apply_player_sync(bigint,integer,integer,integer,timestamptz), public.league_week_start() from public,anon,authenticated;
grant execute on function public.admin_update_player(uuid,bigint,text,integer,integer), public.apply_player_sync(bigint,integer,integer,integer,timestamptz), public.league_week_start() to service_role;
commit;

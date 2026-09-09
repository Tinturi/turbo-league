begin;
create or replace function public.activate_owned_double_down(target_player bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare boundary timestamptz; latest timestamptz; used_count integer; bonus_count integer;
begin
  perform 1 from public.players where id = target_player and active for update;
  if not found then raise exception 'Player unavailable'; end if;
  select max(activated_at) into latest from public.double_down_activations where player_id = target_player;
  if latest + interval '10 minutes' > now() then raise exception 'Double Down cooldown'; end if;
  boundary := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    - ((extract(dow from now() at time zone 'UTC')::integer + 1) % 7) * interval '1 day' + interval '5 hours';
  if now() < boundary then boundary := boundary - interval '7 days'; end if;
  update public.double_down_activations set status = 'expired'
    where player_id = target_player and status = 'pending' and activated_at < now() - interval '3 hours';
  select count(*) into used_count from public.double_down_activations
    where player_id = target_player and week_start = boundary and status in ('pending','used');
  select count(*) into bonus_count from public.double_down_bonuses where player_id = target_player and week_start = boundary;
  if used_count >= 5 + bonus_count then raise exception 'Double Down allowance exhausted'; end if;
  insert into public.double_down_activations(player_id, week_start, status) values (target_player, boundary, 'pending');
end;
$$;
-- CREATE OR REPLACE preserves the existing service-role-only permissions.
commit;

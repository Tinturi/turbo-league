-- Supabase Auth inserts the user, then sets app_metadata in the same transaction.
-- Handle both events so profile uniqueness also rolls back real Auth API requests.
begin;
create or replace function public.bind_league_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'league_username' is null then return new; end if;
  if exists (select 1 from public.player_accounts where user_id = new.id) then return new; end if;
  if not exists (select 1 from public.players where id = (new.raw_app_meta_data->>'league_player_id')::bigint and active) then
    raise exception 'Player is unavailable';
  end if;
  insert into public.player_accounts(user_id, username, player_id)
  values (new.id, new.raw_app_meta_data->>'league_username', (new.raw_app_meta_data->>'league_player_id')::bigint);
  return new;
end;
$$;
create or replace trigger league_account_created after insert or update of raw_app_meta_data on auth.users
for each row execute function public.bind_league_account();
commit;

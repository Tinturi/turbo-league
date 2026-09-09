-- Run after migration inside a transaction; all test rows are rolled back.
begin;
do $$
declare p bigint; p2 bigint; u uuid := gen_random_uuid(); v uuid := gen_random_uuid(); blocked boolean; n integer;
begin
  insert into public.players(name, account_id) values ('__transaction_test__', -9090901) returning id into p;
  insert into public.players(name, account_id) values ('__transaction_test_2__', -9090902) returning id into p2;
  insert into auth.users(id, raw_app_meta_data) values (u, jsonb_build_object('league_username','__transaction_test__','league_player_id',p));
  if not exists(select 1 from public.player_accounts where user_id=u and player_id=p) then raise exception 'Claim missing'; end if;
  blocked := false;
  begin
    insert into auth.users(id, raw_app_meta_data) values (v, jsonb_build_object('league_username','__transaction_test_2__','league_player_id',p));
  exception when unique_violation then blocked := true;
  end;
  if not blocked or exists(select 1 from auth.users where id=v) then raise exception 'Duplicate claim was not atomic'; end if;
  blocked := false;
  begin
    insert into auth.users(id, raw_app_meta_data) values (v, jsonb_build_object('league_username','__transaction_test__','league_player_id',p2));
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate username allowed'; end if;
  update auth.users set raw_user_meta_data=jsonb_build_object('league_player_id',p2) where id=u;
  if not exists(select 1 from public.player_accounts where user_id=u and player_id=p) then raise exception 'Mutable metadata changed owner'; end if;
  if has_table_privilege('anon','public.player_accounts','INSERT') or has_table_privilege('authenticated','public.player_accounts','UPDATE') then raise exception 'Public claim write allowed'; end if;
  if has_table_privilege('authenticated','public.player_avatars','INSERT') or has_table_privilege('anon','public.double_down_activations','INSERT') then raise exception 'Public mutation allowed'; end if;
  if has_function_privilege('authenticated','public.activate_owned_double_down(bigint)','EXECUTE') then raise exception 'Public RPC allowed'; end if;
  if not has_table_privilege('anon','public.players','SELECT') or not has_table_privilege('anon','public.matches','SELECT') then raise exception 'Public statistics broken'; end if;
  perform public.activate_owned_double_down(p);
  blocked := false;
  begin
    perform public.activate_owned_double_down(p);
  exception when raise_exception then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate DD allowed'; end if;
  select count(*) into n from public.double_down_activations where player_id=p;
  if n <> 1 then raise exception 'Wrong DD count'; end if;
  for i in 1..12 loop
    if not public.consume_auth_attempt('__transaction_test__',12) then raise exception 'Rate limit too early'; end if;
  end loop;
  if public.consume_auth_attempt('__transaction_test__',12) then raise exception 'Rate limit failed'; end if;
end;
$$;
rollback;
select 'PASS: unique claims, atomic rollback, immutable ownership, direct-write protection, statistics reads, DD double-click protection, rate limiting' as result;

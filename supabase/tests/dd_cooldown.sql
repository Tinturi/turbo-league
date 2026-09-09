begin;
do $$
declare p bigint; blocked boolean; n integer;
begin
  insert into public.players(name, account_id) values ('__dd_cooldown_transaction__', -9090920) returning id into p;
  perform public.activate_owned_double_down(p);
  blocked := false;
  begin perform public.activate_owned_double_down(p);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Immediate duplicate allowed'; end if;
  update public.double_down_activations set status = 'expired' where player_id = p;
  blocked := false;
  begin perform public.activate_owned_double_down(p);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Cooldown bypassed after resolution'; end if;
  update public.double_down_activations set status = 'pending' where player_id = p;
  for i in 2..5 loop
    update public.double_down_activations set activated_at = activated_at - interval '10 minutes' where player_id = p;
    perform public.activate_owned_double_down(p);
  end loop;
  select count(*) into n from public.double_down_activations where player_id = p and status = 'pending';
  if n <> 5 then raise exception 'Multiple pending activations not preserved'; end if;
  update public.double_down_activations set activated_at = activated_at - interval '10 minutes' where player_id = p;
  blocked := false;
  begin perform public.activate_owned_double_down(p);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Allowance exceeded'; end if;
  if has_function_privilege('authenticated','public.activate_owned_double_down(bigint)','EXECUTE') or has_function_privilege('anon','public.activate_owned_double_down(bigint)','EXECUTE') then raise exception 'Public RPC access'; end if;
end;
$$;
rollback;
select 'PASS: 10-minute cooldown, independent pending activations, charge limit, server-only access; test data rolled back' as result;

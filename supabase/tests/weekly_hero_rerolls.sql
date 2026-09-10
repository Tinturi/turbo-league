begin;
do $$
declare p bigint; boundary timestamptz := public.league_week_start(); blocked boolean; n integer;
begin
  insert into public.players(name, account_id) values('__reroll_transaction_test__', -9090960) returning id into p;
  insert into public.weekly_hero_selections(player_id,week_start,status,hero_ids,selected_at)
    values(p,boundary,'selected',array[1,2,3,4],now()-interval '1 hour');
  insert into public.weekly_hero_selection_history(player_id,week_start,hero_ids,selected_at)
    select player_id,week_start,hero_ids,selected_at from public.weekly_hero_selections where player_id=p;
  perform public.reroll_owned_weekly_heroes(p,array[5,6,7,8]);
  blocked:=false;
  begin perform public.reroll_owned_weekly_heroes(p,array[9,10,11,12]); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Second free reroll allowed'; end if;
  insert into public.weekly_hero_reroll_bonuses(player_id,week_start,source_match_id) values(p,boundary,991);
  perform public.reroll_owned_weekly_heroes(p,array[9,10,11,12]);
  select count(*) into n from public.weekly_hero_selection_history where player_id=p;
  if n<>3 then raise exception 'Selection history missing'; end if;
  blocked:=false;
  begin perform public.reroll_owned_weekly_heroes(p,array[9,10,11,12]); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Identical quartet allowed'; end if;
  if has_function_privilege('authenticated','public.reroll_owned_weekly_heroes(bigint,integer[])','EXECUTE')
    or has_table_privilege('anon','public.weekly_hero_reroll_bonuses','INSERT') then raise exception 'Public mutation allowed'; end if;
end;
$$;
rollback;
select 'PASS: weekly free reroll, five-loss bonus allowance, preserved history, distinct quartet, private mutation; test rows rolled back' as result;

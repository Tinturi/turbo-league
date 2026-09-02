insert into players (name, account_id, rating, wins, losses, active)
values
  ('Артём', 261238708, 1000, 0, 0, true),
  ('Денчик', 152657599, 1000, 0, 0, true)
on conflict (account_id) do update
set name = excluded.name,
    active = true;

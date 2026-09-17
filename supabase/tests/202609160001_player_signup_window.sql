begin;

select plan(20);

select has_table(
  'public',
  'player_signup_windows',
  'player signup window table exists'
);

select ok(
  (
    select array_agg(kcu.column_name order by kcu.ordinal_position)
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'player_signup_windows'
      and tc.constraint_type = 'PRIMARY KEY'
  ) = array['environment', 'team_id'],
  'one signup window exists per environment and team'
);

select col_not_null(
  'public', 'player_signup_windows', 'environment',
  'environment is required'
);

select col_not_null(
  'public', 'player_signup_windows', 'max_signups',
  'signup quota is required'
);

select col_not_null(
  'public', 'player_signup_windows', 'signups_used',
  'signup usage is required'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.player_signup_windows'::regclass),
  'RLS is enabled'
);

select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.player_signup_windows'::regclass),
  'RLS is forced'
);

select ok(
  not has_table_privilege('authenticated', 'public.player_signup_windows', 'SELECT'),
  'authenticated clients cannot read signup windows directly'
);

select ok(
  not has_table_privilege('anon', 'public.player_signup_windows', 'INSERT'),
  'anonymous clients cannot open signup windows'
);

select ok(
  has_table_privilege('service_role', 'public.player_signup_windows', 'SELECT'),
  'service role can inspect signup windows'
);

select ok(
  to_regprocedure('public.consume_player_signup_slot(uuid,text)') is not null,
  'atomic signup-slot function exists'
);

select ok(
  to_regprocedure('public.release_player_signup_slot(uuid,text)') is not null,
  'signup-slot recovery function exists'
);

select ok(
  not has_function_privilege(
    'anon', 'public.consume_player_signup_slot(uuid,text)', 'EXECUTE'
  ),
  'anonymous clients cannot consume signup slots'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.consume_player_signup_slot(uuid,text)', 'EXECUTE'
  ),
  'authenticated clients cannot consume signup slots directly'
);

select ok(
  has_function_privilege(
    'service_role', 'public.consume_player_signup_slot(uuid,text)', 'EXECUTE'
  ),
  'service role can consume signup slots'
);

insert into public.teams (id, name, season)
values ('10000000-0000-4000-8000-000000000001', 'Signup test team', '2026/27');

insert into public.player_signup_windows (
  environment, team_id, open_until, max_signups, signups_used
) values (
  'preview',
  '10000000-0000-4000-8000-000000000001',
  now() + interval '1 hour',
  2,
  0
);

select is(
  (
    select remaining_signups
    from public.consume_player_signup_slot(
      '10000000-0000-4000-8000-000000000001', 'preview'
    )
  ),
  1,
  'first signup atomically consumes one slot'
);

select is(
  (
    select remaining_signups
    from public.consume_player_signup_slot(
      '10000000-0000-4000-8000-000000000001', 'preview'
    )
  ),
  0,
  'second signup consumes the last slot'
);

select is(
  (
    select count(*)
    from public.consume_player_signup_slot(
      '10000000-0000-4000-8000-000000000001', 'preview'
    )
  ),
  0::bigint,
  'a full window rejects further signups'
);

select public.release_player_signup_slot(
  '10000000-0000-4000-8000-000000000001', 'preview'
);

select is(
  (
    select signups_used::integer
    from public.player_signup_windows
    where environment = 'preview'
      and team_id = '10000000-0000-4000-8000-000000000001'
  ),
  1,
  'a failed provisioning can release its reserved slot'
);

update public.player_signup_windows
set open_until = now() - interval '1 minute'
where environment = 'preview'
  and team_id = '10000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.consume_player_signup_slot(
      '10000000-0000-4000-8000-000000000001', 'preview'
    )
  ),
  0::bigint,
  'an expired window rejects signups'
);

select * from finish();

rollback;

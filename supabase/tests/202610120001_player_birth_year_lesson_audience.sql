begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(20);

select extensions.is(
  (
    select count(*)
    from private.lesson_rules
    where eligible_birth_years <> array[2014, 2015]::smallint[]
  ),
  0::bigint,
  'all existing lessons initially target both 2014 and 2015'
);

select extensions.ok(
  not has_column_privilege(
    'authenticated',
    'public.profiles',
    'birth_year',
    'UPDATE'
  ),
  'authenticated clients cannot update birth year directly'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '81000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-admin@birth-year.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-viewer@birth-year.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Viewer"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-2014@birth-year.test',
    '',
    now(),
    '{"role":"player","player_code":"YEAR2014"}'::jsonb,
    '{"display_name":"Player 2014"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-2015@birth-year.test',
    '',
    now(),
    '{"role":"player","player_code":"YEAR2015"}'::jsonb,
    '{"display_name":"Player 2015"}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-legacy@birth-year.test',
    '',
    now(),
    '{"role":"player","player_code":"YEARNULL"}'::jsonb,
    '{"display_name":"Player Legacy"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set birth_year = case id
  when '81000000-0000-4000-8000-000000000003' then 2014
  when '81000000-0000-4000-8000-000000000004' then 2015
  else null
end
where id in (
  '81000000-0000-4000-8000-000000000003',
  '81000000-0000-4000-8000-000000000004',
  '81000000-0000-4000-8000-000000000005'
);

insert into public.teams (id, name, season) values (
  '82000000-0000-4000-8000-000000000001',
  'Birth Year Team',
  '2026/27'
);

insert into public.team_members (
  team_id, profile_id, role, active, coach_access_level
) values
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'coach', true, 'admin'
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    'coach', true, 'viewer'
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000003',
    'player', true, null
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004',
    'player', true, null
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000005',
    'player', true, null
  );

update private.lesson_rules
set eligible_birth_years = array[2014]::smallint[]
where lesson_id = 'costruzione-linea-di-passaggio';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    null,
    null
  )$$,
  'Coach Admin can assign a shared lesson'
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    null,
    null
  )$$,
  'Coach Admin can assign a 2014-only lesson to the team'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_progress
    where player_id = '81000000-0000-4000-8000-000000000003'
  ),
  2::bigint,
  'Player 2014 receives shared and 2014-only progress'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_progress
    where player_id = '81000000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  'Player 2015 receives only shared progress'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_progress
    where player_id = '81000000-0000-4000-8000-000000000005'
  ),
  2::bigint,
  'legacy Player with NULL birth year remains unrestricted'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.start_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  'Player 2014 can start a shared lesson'
);

select extensions.lives_ok(
  $$select public.start_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  'Player 2014 can start a 2014-only lesson'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.start_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  'Player 2015 can start a shared lesson'
);

select extensions.throws_ok(
  $$select public.start_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  '42501',
  'active lesson assignment required',
  'Player 2015 cannot force-start a 2014-only lesson'
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    'linea-passaggio',
    0::smallint,
    0::smallint,
    0
  )$$,
  '42501',
  'active lesson assignment required',
  'Player 2015 cannot write video progress for a 2014-only lesson'
);

select extensions.throws_ok(
  $$select public.submit_quiz(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    '{}'::jsonb,
    null
  )$$,
  '42501',
  'active lesson assignment required',
  'Player 2015 cannot submit a quiz for a 2014-only lesson'
);

select extensions.throws_ok(
  $$select public.complete_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  '42501',
  'active lesson assignment required',
  'Player 2015 cannot complete a 2014-only lesson'
);

reset role;
insert into public.lesson_progress (
  team_id, player_id, lesson_id, status, progress_percent, assigned_at
) values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000004',
  'costruzione-linea-di-passaggio',
  'da_fare',
  0,
  now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select extensions.is(
  (select count(*) from public.lesson_progress),
  1::bigint,
  'RLS hides stale incompatible progress from Player 2015'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.start_lesson(
    '82000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  'legacy Player with NULL birth year can start a restricted lesson'
);

reset role;
set local role service_role;

select extensions.lives_ok(
  $$select public.set_player_birth_year(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004',
    2014::smallint,
    '81000000-0000-4000-8000-000000000001'
  )$$,
  'trusted server accepts a group update requested by Coach Admin'
);

select extensions.is(
  (
    select birth_year
    from public.profiles
    where id = '81000000-0000-4000-8000-000000000004'
  ),
  2014::smallint,
  'Coach Admin group update is persisted'
);

select extensions.throws_ok(
  $$select public.set_player_birth_year(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004',
    2015::smallint,
    '81000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'coach administrator is required for this team',
  'Coach Viewer cannot change a Player group'
);

select extensions.is(
  (
    select birth_year
    from public.profiles
    where id = '81000000-0000-4000-8000-000000000004'
  ),
  2014::smallint,
  'Coach Viewer attempt leaves the group unchanged'
);

reset role;
select * from extensions.finish();
rollback;

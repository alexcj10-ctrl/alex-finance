begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(20);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.provision_player_profile(uuid,text,text,uuid,boolean,uuid)',
    'execute'
  ),
  'authenticated cannot execute server-side player provisioning'
);

select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.provision_player_profile(uuid,text,text,uuid,boolean,uuid)',
    'execute'
  ),
  'service role can execute server-side player provisioning'
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
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-a@rls.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach A"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-a@rls.test',
    '',
    now(),
    '{"role":"player","player_code":"RLSA01"}'::jsonb,
    '{"display_name":"Player A"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-b@rls.test',
    '',
    now(),
    '{"role":"player","player_code":"RLSB01"}'::jsonb,
    '{"display_name":"Player B"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-b@rls.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach B"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-c@rls.test',
    '',
    now(),
    '{"role":"player","player_code":"RLSC01"}'::jsonb,
    '{"display_name":"Player C"}'::jsonb,
    now(),
    now()
  );

insert into public.teams (id, name, season) values
  ('30000000-0000-4000-8000-000000000001', 'Team A', '2026/27'),
  ('30000000-0000-4000-8000-000000000002', 'Team B', '2026/27');

insert into public.team_members (team_id, profile_id, role, active) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'coach', true),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'player', true),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'player', true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'coach', true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'player', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '30000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    null,
    null
  )$$,
  'coach can assign a known lesson to their own team'
);

select extensions.throws_ok(
  $$select public.assign_lesson(
    '30000000-0000-4000-8000-000000000002',
    'costruzione-creare-ampiezza',
    null,
    null
  )$$,
  '42501',
  'coach is not authorized for this team',
  'coach cannot assign a lesson to another team'
);

select extensions.is(
  (select count(*) from public.profiles),
  3::bigint,
  'coach sees self and players belonging to their team only'
);

select extensions.is(
  (select count(*) from public.lesson_progress),
  2::bigint,
  'team assignment materializes progress for both active players'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'player can read only their own profile'
);

select extensions.is(
  (select count(*) from public.lesson_progress),
  1::bigint,
  'player cannot read another player progress'
);

select extensions.ok(
  not has_column_privilege('authenticated', 'public.lesson_progress', 'points_earned', 'UPDATE'),
  'player role has no direct points write privilege'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'private.quiz_answer_keys', 'SELECT'),
  'quiz answer keys are not readable by authenticated clients'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.import_local_progress(uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  'legacy local progress cannot mint trusted server progress'
);

select extensions.lives_ok(
  $$select public.start_lesson(
    '30000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  'assigned player can start their own lesson'
);

select extensions.lives_ok(
  $$select public.record_video_checkpoint(
    '30000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    100::smallint,
    100::smallint,
    42.5
  )$$,
  'assigned player can record their own completed video checkpoint'
);

select extensions.lives_ok(
  $$select public.submit_quiz(
    '30000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    '{
      "10000000-0000-4000-8000-000000000001":"linee-pulite",
      "10000000-0000-4000-8000-000000000002":"visibile-libero"
    }'::jsonb,
    '40000000-0000-4000-8000-000000000001'
  )$$,
  'assigned player can submit the configured quiz through the trusted RPC'
);

select extensions.lives_ok(
  $$select public.complete_lesson(
    '30000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  'player can complete after satisfying the server-side video rule'
);

select extensions.is(
  (
    select points_earned
    from public.lesson_progress
    where lesson_id = 'costruzione-creare-ampiezza'
  ),
  60,
  'points come from the private server-side lesson rule'
);

select extensions.is(
  (select count(*) from public.player_trophies),
  1::bigint,
  'eligible trophy is awarded once by the completion RPC'
);

select extensions.throws_ok(
  $$select public.assign_lesson(
    '30000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    null,
    null
  )$$,
  '42501',
  'coach is not authorized for this team',
  'player cannot call the coach assignment RPC successfully'
);

reset role;
update public.profiles
set account_active = false
where id = '20000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.is(
  (select count(*) from public.lesson_progress),
  0::bigint,
  'disabled player cannot read learning data'
);

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'disabled player can still read own profile for the access-denied state'
);

reset role;
select * from extensions.finish();
rollback;

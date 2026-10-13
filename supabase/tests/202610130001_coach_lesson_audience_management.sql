begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '83000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'coach-admin@lesson-audience.test', '', now(),
    '{"role":"coach"}'::jsonb, '{"display_name":"Coach Admin"}'::jsonb, now(), now()
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'coach-viewer@lesson-audience.test', '', now(),
    '{"role":"coach"}'::jsonb, '{"display_name":"Coach Viewer"}'::jsonb, now(), now()
  ),
  (
    '83000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'player-2014@lesson-audience.test', '', now(),
    '{"role":"player","player_code":"AUDIENCE2014"}'::jsonb,
    '{"display_name":"Player 2014"}'::jsonb, now(), now()
  ),
  (
    '83000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'player-2015@lesson-audience.test', '', now(),
    '{"role":"player","player_code":"AUDIENCE2015"}'::jsonb,
    '{"display_name":"Player 2015"}'::jsonb, now(), now()
  );

update public.profiles
set birth_year = case id
  when '83000000-0000-4000-8000-000000000003' then 2014
  when '83000000-0000-4000-8000-000000000004' then 2015
end
where id in (
  '83000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000004'
);

insert into public.teams (id, name, season) values (
  '84000000-0000-4000-8000-000000000001',
  'Lesson Audience Team',
  '2026/27'
);

insert into public.team_members (
  team_id, profile_id, role, active, coach_access_level
) values
  (
    '84000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'coach', true, 'admin'
  ),
  (
    '84000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    'coach', true, 'viewer'
  ),
  (
    '84000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000003',
    'player', true, null
  ),
  (
    '84000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000004',
    'player', true, null
  );

set local role service_role;

select extensions.lives_ok(
  $$select public.set_lesson_audience(
    '84000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    array[2014]::smallint[],
    '83000000-0000-4000-8000-000000000001'
  )$$,
  'trusted server accepts a lesson audience requested by Coach Admin'
);

select extensions.is(
  (
    select eligible_birth_years
    from private.lesson_rules
    where lesson_id = 'costruzione-attira-uomo-libero'
  ),
  array[2014]::smallint[],
  '2014-only audience is persisted'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '84000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    null,
    null
  )$$,
  'Coach Admin can assign the restricted lesson'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_progress
    where team_id = '84000000-0000-4000-8000-000000000001'
      and lesson_id = 'costruzione-attira-uomo-libero'
  ),
  1::bigint,
  'only the eligible 2014 Player receives progress'
);

reset role;
set local role service_role;

select extensions.lives_ok(
  $$select public.set_lesson_audience(
    '84000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    array[2014, 2015]::smallint[],
    '83000000-0000-4000-8000-000000000001'
  )$$,
  'Coach Admin can expand the audience to both groups'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_progress
    where team_id = '84000000-0000-4000-8000-000000000001'
      and lesson_id = 'costruzione-attira-uomo-libero'
  ),
  2::bigint,
  'expanding the audience materializes missing progress'
);

select extensions.throws_ok(
  $$select public.set_lesson_audience(
    '84000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    array[2015]::smallint[],
    '83000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'coach administrator is required for this team',
  'Coach Viewer cannot change the audience'
);

select extensions.throws_ok(
  $$select public.set_lesson_audience(
    '84000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    array[2015, 2014]::smallint[],
    '83000000-0000-4000-8000-000000000001'
  )$$,
  '22023',
  'invalid lesson audience',
  'non-canonical audiences are rejected'
);

select extensions.throws_ok(
  $$select public.set_lesson_audience(
    '84000000-0000-4000-8000-000000000001',
    'lezione-inesistente',
    array[2014]::smallint[],
    '83000000-0000-4000-8000-000000000001'
  )$$,
  '22023',
  'unknown or inactive lesson',
  'unknown lessons are rejected'
);

reset role;
select * from extensions.finish();
rollback;

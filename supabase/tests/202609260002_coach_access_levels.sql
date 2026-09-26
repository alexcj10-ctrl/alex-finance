begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(22);

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
    '71000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-admin@access.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-viewer@access.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Viewer"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player@access.test',
    '',
    now(),
    '{"role":"player","player_code":"ACCESS01"}'::jsonb,
    '{"display_name":"Player Access"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'provision-admin@access.test',
    '',
    now(),
    '{"role":"player","player_code":"PROVADM1"}'::jsonb,
    '{"display_name":"Provision Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'provision-viewer@access.test',
    '',
    now(),
    '{"role":"player","player_code":"PROVVIEW"}'::jsonb,
    '{"display_name":"Provision Viewer"}'::jsonb,
    now(),
    now()
  );

insert into public.teams (id, name, season) values (
  '72000000-0000-4000-8000-000000000001',
  'Coach Access Team',
  '2026/27'
);

insert into public.team_members (
  team_id,
  profile_id,
  role,
  active,
  coach_access_level
) values
  (
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'coach',
    true,
    'admin'
  ),
  (
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002',
    'coach',
    true,
    'viewer'
  ),
  (
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000003',
    'player',
    true,
    null
  );

select extensions.ok(
  private.is_coach_admin(
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001'
  ),
  'an active administrator is recognized for their team'
);

select extensions.ok(
  not private.is_coach_admin(
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002'
  ),
  'an active Coach viewer is not treated as an administrator'
);

select extensions.throws_ok(
  $$insert into public.team_members (
      team_id, profile_id, role, active, coach_access_level
    ) values (
      '72000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000004',
      'coach',
      true,
      null
    )$$,
  '23514',
  null,
  'a Coach membership must declare admin or viewer access'
);

select extensions.throws_ok(
  $$insert into public.team_members (
      team_id, profile_id, role, active, coach_access_level
    ) values (
      '72000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000004',
      'player',
      true,
      'viewer'
    )$$,
  '23514',
  null,
  'a Player membership cannot carry a Coach access level'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '72000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    null,
    null
  )$$,
  'Coach administrator can assign a lesson'
);

select extensions.lives_ok(
  $$update public.profiles
    set display_name = 'Coach Admin Updated'
    where id = '71000000-0000-4000-8000-000000000001'$$,
  'Coach administrator can update their own granted profile fields'
);

select extensions.is(
  (
    select display_name
    from public.profiles
    where id = '71000000-0000-4000-8000-000000000001'
  ),
  'Coach Admin Updated',
  'the administrator profile update is persisted'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.is(
  (select count(*) from public.profiles),
  2::bigint,
  'Coach viewer can read their own profile and the team Player profile'
);

select extensions.is(
  (select count(*) from public.lesson_progress),
  1::bigint,
  'Coach viewer can read the team Player lesson progress'
);

select extensions.ok(
  (select count(*) > 0 from public.quiz_questions),
  'Coach viewer can read quiz information'
);

select extensions.lives_ok(
  $$update public.profiles
    set display_name = 'Viewer Escalated'
    where id = '71000000-0000-4000-8000-000000000002'$$,
  'a blocked viewer profile update is safely filtered by RLS'
);

select extensions.is(
  (
    select display_name
    from public.profiles
    where id = '71000000-0000-4000-8000-000000000002'
  ),
  'Coach Viewer',
  'Coach viewer cannot update even their own profile'
);

select extensions.throws_ok(
  $$select public.assign_lesson(
    '72000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    null,
    null
  )$$,
  '42501',
  'coach administrator is required for this team',
  'Coach viewer cannot assign a lesson'
);

select extensions.throws_ok(
  $$select public.set_lesson_assignment_active(
    (
      select id
      from public.lesson_assignments
      where team_id = '72000000-0000-4000-8000-000000000001'
      limit 1
    ),
    false
  )$$,
  '42501',
  'assignment not found or coach administrator required',
  'Coach viewer cannot change an assignment'
);

select extensions.ok(
  not has_column_privilege(
    'authenticated',
    'public.team_members',
    'coach_access_level',
    'UPDATE'
  ),
  'authenticated clients cannot edit Coach access levels directly'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$update public.profiles
    set display_name = 'Player Access Updated'
    where id = '71000000-0000-4000-8000-000000000003'$$,
  'Player can still update their own granted profile fields'
);

select extensions.is(
  (
    select display_name
    from public.profiles
    where id = '71000000-0000-4000-8000-000000000003'
  ),
  'Player Access Updated',
  'the Player own-profile flow remains unchanged'
);

select extensions.throws_ok(
  $$select public.assign_lesson(
    '72000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    null,
    null
  )$$,
  '42501',
  'coach administrator is required for this team',
  'Player still cannot call a Coach mutation RPC'
);

reset role;
set local role service_role;

select extensions.lives_ok(
  $$select public.provision_player_profile(
    '71000000-0000-4000-8000-000000000004',
    'Provisioned By Admin',
    'PROVADM1',
    '72000000-0000-4000-8000-000000000001',
    true,
    '71000000-0000-4000-8000-000000000001'
  )$$,
  'trusted server can provision a Player for a Coach administrator'
);

select extensions.throws_ok(
  $$select public.provision_player_profile(
    '71000000-0000-4000-8000-000000000005',
    'Provisioned By Viewer',
    'PROVVIEW',
    '72000000-0000-4000-8000-000000000001',
    true,
    '71000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'coach administrator is required for this team',
  'trusted server rejects Player provisioning requested by a Coach viewer'
);

select extensions.is(
  (
    select count(*)
    from public.team_members
    where profile_id = '71000000-0000-4000-8000-000000000004'
      and role = 'player'
      and coach_access_level is null
  ),
  1::bigint,
  'administrator provisioning creates a Player membership without Coach access'
);

select extensions.is(
  (
    select count(*)
    from public.team_members
    where profile_id = '71000000-0000-4000-8000-000000000005'
  ),
  0::bigint,
  'viewer provisioning attempt creates no team membership'
);

reset role;
select * from extensions.finish();
rollback;

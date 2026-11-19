begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(46);

select extensions.has_table(
  'private', 'push_subscriptions',
  'private push subscription table exists'
);

select extensions.has_table(
  'private', 'push_notification_events',
  'private push event table exists'
);

select extensions.ok(
  (select relrowsecurity from pg_class
   where oid = 'private.push_subscriptions'::regclass),
  'push subscriptions use RLS'
);

select extensions.ok(
  (select relforcerowsecurity from pg_class
   where oid = 'private.push_subscriptions'::regclass),
  'push subscription RLS is forced'
);

select extensions.ok(
  (select relrowsecurity from pg_class
   where oid = 'private.push_notification_events'::regclass),
  'push notification events use RLS'
);

select extensions.ok(
  (select relforcerowsecurity from pg_class
   where oid = 'private.push_notification_events'::regclass),
  'push notification event RLS is forced'
);

select extensions.ok(
  exists (
    select 1
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = any(i.indkey)
    where i.indrelid = 'private.push_subscriptions'::regclass
      and i.indisunique
      and a.attname = 'endpoint'
  ),
  'push endpoint is unique'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'private.push_notification_events'::regclass
      and c.conname = 'push_notification_events_unique'
      and c.contype = 'u'
  ),
  'notification events have a deduplication constraint'
);

select extensions.ok(
  to_regclass('private.push_subscriptions_team_active_idx') is not null,
  'team subscription lookup index exists'
);

select extensions.ok(
  to_regclass('private.push_notification_events_team_created_idx') is not null,
  'notification event lookup index exists'
);

select extensions.ok(
  not has_table_privilege(
    'anon', 'private.push_subscriptions', 'SELECT'
  ),
  'anonymous clients cannot read push credentials'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated', 'private.push_subscriptions', 'INSERT'
  ),
  'authenticated clients cannot write push credentials directly'
);

select extensions.ok(
  not has_table_privilege(
    'anon', 'private.push_notification_events', 'SELECT'
  ),
  'anonymous clients cannot read notification events'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated', 'private.push_notification_events', 'INSERT'
  ),
  'authenticated clients cannot claim notification events directly'
);

select extensions.ok(
  has_table_privilege(
    'service_role', 'private.push_subscriptions', 'SELECT'
  ),
  'service role can inspect push subscriptions'
);

select extensions.ok(
  has_table_privilege(
    'service_role', 'private.push_notification_events', 'INSERT'
  ),
  'service role can claim notification events'
);

select extensions.ok(
  to_regprocedure(
    'public.upsert_push_subscription(uuid,uuid,text,text,text)'
  ) is not null,
  'push subscription upsert RPC exists'
);

select extensions.ok(
  to_regprocedure(
    'public.deactivate_push_subscription(uuid,uuid,text)'
  ) is not null,
  'push subscription deactivation RPC exists'
);

select extensions.ok(
  to_regprocedure(
    'public.deactivate_push_subscription_by_id(uuid)'
  ) is not null,
  'subscription-id deactivation RPC exists'
);

select extensions.ok(
  to_regprocedure(
    'public.list_push_notification_targets(uuid,text,uuid)'
  ) is not null,
  'notification target RPC exists'
);

select extensions.ok(
  to_regprocedure(
    'public.claim_push_notification_event(uuid,uuid,text,uuid)'
  ) is not null,
  'notification event claim RPC exists'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.upsert_push_subscription(uuid,uuid,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.upsert_push_subscription(uuid,uuid,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.list_push_notification_targets(uuid,text,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.claim_push_notification_event(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'client roles cannot execute Web Push RPCs'
);

select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.upsert_push_subscription(uuid,uuid,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.deactivate_push_subscription(uuid,uuid,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.deactivate_push_subscription_by_id(uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.list_push_notification_targets(uuid,text,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_push_notification_event(uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'service role can execute every Web Push RPC'
);

select extensions.ok(
  not exists (
    select 1
    from pg_proc p
    where p.oid in (
      'public.upsert_push_subscription(uuid,uuid,text,text,text)'::regprocedure,
      'public.deactivate_push_subscription(uuid,uuid,text)'::regprocedure,
      'public.deactivate_push_subscription_by_id(uuid)'::regprocedure,
      'public.list_push_notification_targets(uuid,text,uuid)'::regprocedure,
      'public.claim_push_notification_event(uuid,uuid,text,uuid)'::regprocedure
    )
      and not p.prosecdef
  ),
  'every Web Push RPC is security definer'
);

select extensions.ok(
  not exists (
    select 1
    from pg_proc p
    where p.oid in (
      'public.upsert_push_subscription(uuid,uuid,text,text,text)'::regprocedure,
      'public.deactivate_push_subscription(uuid,uuid,text)'::regprocedure,
      'public.deactivate_push_subscription_by_id(uuid)'::regprocedure,
      'public.list_push_notification_targets(uuid,text,uuid)'::regprocedure,
      'public.claim_push_notification_event(uuid,uuid,text,uuid)'::regprocedure
    )
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
        where setting like 'search_path=%'
      )
  ),
  'every Web Push RPC pins its search path'
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
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push-admin@test.invalid', '', now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Push Admin"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push-viewer@test.invalid', '', now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Push Viewer"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push-2014@test.invalid', '', now(),
    '{"role":"player","player_code":"PUSH2014"}'::jsonb,
    '{"display_name":"Push Player 2014"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push-2015@test.invalid', '', now(),
    '{"role":"player","player_code":"PUSH2015"}'::jsonb,
    '{"display_name":"Push Player 2015"}'::jsonb,
    now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'push-inactive@test.invalid', '', now(),
    '{"role":"player","player_code":"PUSHINACTIVE"}'::jsonb,
    '{"display_name":"Push Inactive"}'::jsonb,
    now(), now()
  );

update public.profiles
set role = case
      when id in (
        'a1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000002'
      ) then 'coach'::public.app_role
      else 'player'::public.app_role
    end,
    birth_year = case id
      when 'a1000000-0000-4000-8000-000000000003'
        then 2014::smallint
      when 'a1000000-0000-4000-8000-000000000004'
        then 2015::smallint
      when 'a1000000-0000-4000-8000-000000000005'
        then 2014::smallint
      else null
    end,
    account_active = id <> 'a1000000-0000-4000-8000-000000000005'
where id::text like 'a1000000-0000-4000-8000-00000000000%';

insert into public.teams (id, name, season) values (
  'a2000000-0000-4000-8000-000000000001',
  'Web Push Test Team',
  '2026/27'
);

insert into public.team_members (
  team_id, profile_id, role, active, coach_access_level
) values
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'coach', true, 'admin'
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'coach', true, 'viewer'
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'player', true, null
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000004',
    'player', true, null
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000005',
    'player', false, null
  );

insert into private.lesson_rules (
  lesson_id,
  points,
  minimum_video_percent,
  minimum_quiz_percent,
  phase,
  macro_phase,
  active,
  eligible_birth_years
) values (
  'web-push-test-lesson',
  10,
  100,
  null,
  'costruzione',
  'possesso',
  true,
  array[2014]::smallint[]
);

insert into public.lesson_assignments (
  id,
  lesson_id,
  team_id,
  player_id,
  assigned_by,
  active
) values (
  'a3000000-0000-4000-8000-000000000001',
  'web-push-test-lesson',
  'a2000000-0000-4000-8000-000000000001',
  null,
  'a1000000-0000-4000-8000-000000000001',
  true
);

set local role service_role;

select extensions.ok(
  public.upsert_push_subscription(
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'https://push.test/player-2014',
    'p256dh-2014',
    'auth-2014'
  ) is not null,
  'active Player 2014 can receive a server-managed subscription'
);

select extensions.ok(
  public.upsert_push_subscription(
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000004',
    'https://push.test/player-2015',
    'p256dh-2015',
    'auth-2015'
  ) is not null,
  'active Player 2015 can receive a server-managed subscription'
);

select extensions.throws_ok(
  $$select public.upsert_push_subscription(
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000005',
    'https://push.test/inactive',
    'p256dh-inactive',
    'auth-inactive'
  )$$,
  '42501',
  'active player membership is required',
  'inactive Players cannot register subscriptions'
);

select extensions.throws_ok(
  $$select public.upsert_push_subscription(
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'https://push.test/coach-viewer',
    'p256dh-coach',
    'auth-coach'
  )$$,
  '42501',
  'active player membership is required',
  'Coach accounts cannot register Player push subscriptions'
);

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  '2014-only lesson targets only the eligible Player'
);

select extensions.is(
  (
    select endpoint
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  'https://push.test/player-2014'::text,
  'eligible target includes the expected endpoint'
);

reset role;
update private.lesson_rules
set eligible_birth_years = array[2015]::smallint[]
where lesson_id = 'web-push-test-lesson';
set local role service_role;

select extensions.is(
  (
    select endpoint
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  'https://push.test/player-2015'::text,
  '2015-only lesson targets only the eligible Player'
);

reset role;
update private.lesson_rules
set eligible_birth_years = array[2014, 2015]::smallint[]
where lesson_id = 'web-push-test-lesson';
set local role service_role;

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  2::bigint,
  'lesson for both groups targets both active Players'
);

select extensions.throws_ok(
  $$select * from public.list_push_notification_targets(
    'a2000000-0000-4000-8000-000000000001',
    'web-push-test-lesson',
    'a1000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'coach administrator is required for this team',
  'Coach Viewer cannot request notification targets'
);

select extensions.ok(
  public.deactivate_push_subscription(
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'https://push.test/player-2014'
  ),
  'Player can be unsubscribed by endpoint through the server RPC'
);

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  'inactive subscriptions are not notification targets'
);

select extensions.is(
  public.upsert_push_subscription(
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'https://push.test/player-2014',
    'p256dh-2014-refreshed',
    'auth-2014-refreshed'
  ),
  (
    select id
    from private.push_subscriptions
    where endpoint = 'https://push.test/player-2014'
  ),
  'subscription upsert reactivates the existing endpoint record'
);

select extensions.ok(
  public.deactivate_push_subscription_by_id(
    (
      select id
      from private.push_subscriptions
      where endpoint = 'https://push.test/player-2015'
    )
  ),
  'stale provider subscription can be disabled by id'
);

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  'subscription-id deactivation removes the endpoint from targets'
);

reset role;
update public.team_members
set active = false
where team_id = 'a2000000-0000-4000-8000-000000000001'
  and profile_id = 'a1000000-0000-4000-8000-000000000003';
set local role service_role;

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  0::bigint,
  'inactive team memberships are excluded from targets'
);

reset role;
update public.team_members
set active = true
where team_id = 'a2000000-0000-4000-8000-000000000001'
  and profile_id = 'a1000000-0000-4000-8000-000000000003';
update public.profiles
set account_active = false
where id = 'a1000000-0000-4000-8000-000000000003';
set local role service_role;

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  0::bigint,
  'inactive Player profiles are excluded from targets'
);

reset role;
update public.profiles
set account_active = true
where id = 'a1000000-0000-4000-8000-000000000003';
update public.lesson_assignments
set active = false
where id = 'a3000000-0000-4000-8000-000000000001';
set local role service_role;

select extensions.is(
  (
    select count(*)
    from public.list_push_notification_targets(
      'a2000000-0000-4000-8000-000000000001',
      'web-push-test-lesson',
      'a1000000-0000-4000-8000-000000000001'
    )
  ),
  0::bigint,
  'inactive lesson assignments produce no notification targets'
);

reset role;
update public.lesson_assignments
set active = true
where id = 'a3000000-0000-4000-8000-000000000001';
set local role service_role;

select extensions.ok(
  public.claim_push_notification_event(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'lesson_assigned',
    'a1000000-0000-4000-8000-000000000001'
  ),
  'first notification event claim succeeds'
);

select extensions.ok(
  not public.claim_push_notification_event(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'lesson_assigned',
    'a1000000-0000-4000-8000-000000000001'
  ),
  'duplicate notification event claim is rejected idempotently'
);

select extensions.throws_ok(
  $$select public.claim_push_notification_event(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'lesson_assigned',
    'a1000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'coach administrator is required for this team',
  'Coach Viewer cannot claim notification events'
);

select extensions.throws_ok(
  $$select public.claim_push_notification_event(
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'unexpected_event',
    'a1000000-0000-4000-8000-000000000001'
  )$$,
  '22023',
  'unsupported push notification event',
  'unsupported notification event kinds are rejected'
);

reset role;
select * from extensions.finish();
rollback;

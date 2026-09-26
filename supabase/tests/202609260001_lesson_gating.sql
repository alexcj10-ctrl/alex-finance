begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(30);

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
    '60000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-gating-a@rls.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Gating A"}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-gating-a@rls.test',
    '',
    now(),
    '{"role":"player","player_code":"GATEA01"}'::jsonb,
    '{"display_name":"Player Gating A"}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-gating-b@rls.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Gating B"}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-gating-b@rls.test',
    '',
    now(),
    '{"role":"player","player_code":"GATEB01"}'::jsonb,
    '{"display_name":"Player Gating B"}'::jsonb,
    now(),
    now()
  );

insert into public.teams (id, name, season) values
  ('61000000-0000-4000-8000-000000000001', 'Gating Team A', '2026/27'),
  ('61000000-0000-4000-8000-000000000002', 'Gating Team B', '2026/27');

insert into public.team_members (team_id, profile_id, role, active) values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'coach', true),
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 'player', true),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000003', 'coach', true),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 'player', true);

-- Keep the timing contract real while making its wall-clock test inexpensive.
update private.lesson_video_requirements
set duration_seconds = 0.500
where lesson_id = 'costruzione-creare-ampiezza';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    null,
    null
  )$$,
  'coach can assign the gated lesson to their own team'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-inventata',
    0::smallint,
    0::smallint,
    0
  )$$,
  '22023',
  'video variant is not required for this lesson',
  'a fake video variant is rejected by the backend'
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    100::smallint,
    100::smallint,
    42
  )$$,
  '22023',
  'video checkpoints must start at zero',
  'a direct 100 percent checkpoint is rejected'
);

select extensions.lives_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    0::smallint,
    100::smallint,
    42
  )$$,
  'a valid variant can start at checkpoint zero'
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    25::smallint,
    25::smallint,
    11
  )$$,
  '22023',
  'video checkpoint advanced too quickly',
  'an ordered checkpoint sent too quickly is rejected'
);

select extensions.is(
  (
    select watched_percent
    from public.video_progress
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-creare-ampiezza'
      and variant_id = 'variante-a'
  ),
  0::smallint,
  'reported seek position cannot inflate trusted watched percent'
);

select extensions.lives_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    0::smallint,
    100::smallint,
    42
  )$$,
  'repeating an existing checkpoint is idempotent'
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    50::smallint,
    50::smallint,
    21
  )$$,
  '22023',
  'video checkpoints must be recorded in order',
  'a skipped checkpoint is rejected'
);

select extensions.lives_ok(
  $test$
  do $body$
  begin
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-a', 25::smallint, 25::smallint, 11
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-a', 50::smallint, 50::smallint, 21
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-a', 75::smallint, 75::smallint, 31
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-a', 100::smallint, 100::smallint, 42
    );
  end
  $body$;
  $test$,
  'variant A completes through ordered checkpoints'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-creare-ampiezza'
  ),
  0::bigint,
  'quiz questions remain hidden until every video variant is complete'
);

select extensions.throws_ok(
  $$select public.submit_quiz(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    '{
      "10000000-0000-4000-8000-000000000001":"tutti-vicini",
      "10000000-0000-4000-8000-000000000002":"dietro-avversario"
    }'::jsonb,
    '62000000-0000-4000-8000-000000000001'
  )$$,
  '22023',
  'all required videos must be completed before the quiz',
  'quiz submission is blocked until variants A and B are complete'
);

select extensions.throws_ok(
  $$select public.complete_lesson(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  '22023',
  'all required videos must be completed',
  'lesson completion is blocked while variant B is incomplete'
);

select extensions.lives_ok(
  $test$
  do $body$
  begin
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-b', 0::smallint, 0::smallint, 0
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-b', 25::smallint, 25::smallint, 12
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-b', 50::smallint, 50::smallint, 23
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-b', 75::smallint, 75::smallint, 35
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '61000000-0000-4000-8000-000000000001',
      'costruzione-creare-ampiezza', 'variante-b', 100::smallint, 100::smallint, 47
    );
  end
  $body$;
  $test$,
  'variant B completes through ordered checkpoints'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-creare-ampiezza'
  ),
  2::bigint,
  'quiz questions unlock after variants A and B are complete'
);

select extensions.throws_ok(
  $$select public.complete_lesson(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  '22023',
  'quiz must be completed before the lesson',
  'lesson completion remains blocked until a quiz is submitted'
);

select extensions.lives_ok(
  $$select public.submit_quiz(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    '{
      "10000000-0000-4000-8000-000000000001":"tutti-vicini",
      "10000000-0000-4000-8000-000000000002":"dietro-avversario"
    }'::jsonb,
    '62000000-0000-4000-8000-000000000001'
  )$$,
  'a fully answered zero-score quiz is accepted'
);

select extensions.is(
  (
    select score
    from public.quiz_attempts
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
      and client_attempt_id = '62000000-0000-4000-8000-000000000001'
  ),
  0::numeric,
  'the zero quiz score is persisted'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_answers
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'all quiz answers are persisted'
);

select extensions.lives_ok(
  $$select public.complete_lesson(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  'lesson completes after all videos and the quiz'
);

select extensions.is(
  (
    select points_earned
    from public.lesson_progress
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-creare-ampiezza'
  ),
  60,
  'lesson points are awarded once'
);

select extensions.is(
  (
    select count(*)
    from public.player_trophies
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'the eligible trophy is awarded once'
);

select extensions.is(
  (
    select count(*)
    from public.activity_events
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
      and dedupe_key = 'lesson_completed:costruzione-creare-ampiezza'
  ),
  1::bigint,
  'one lesson-completed event is recorded'
);

select extensions.lives_ok(
  $$select public.complete_lesson(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza'
  )$$,
  'repeating lesson completion is idempotent'
);

select extensions.is(
  (
    select points_earned
    from public.lesson_progress
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-creare-ampiezza'
  ),
  60,
  'repeating completion does not duplicate points'
);

select extensions.is(
  (
    select count(*)
    from public.player_trophies
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'repeating completion does not duplicate trophies'
);

select extensions.is(
  (
    select count(*)
    from public.activity_events
    where team_id = '61000000-0000-4000-8000-000000000001'
      and player_id = '60000000-0000-4000-8000-000000000002'
      and dedupe_key = 'lesson_completed:costruzione-creare-ampiezza'
  ),
  1::bigint,
  'repeating completion does not duplicate its activity event'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select extensions.is(
  (select count(*) from public.profiles),
  2::bigint,
  'coach on team B sees only their own profile and player'
);

select extensions.is(
  (select count(*) from public.video_progress),
  0::bigint,
  'coach on team B cannot read team A video progress'
);

select extensions.is(
  (select count(*) from public.quiz_attempts),
  0::bigint,
  'coach on team B cannot read team A quiz attempts'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '61000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'variante-a',
    0::smallint,
    0::smallint,
    0
  )$$,
  '42501',
  'active lesson assignment required',
  'a player cannot write progress into another team'
);

reset role;
select * from extensions.finish();
rollback;

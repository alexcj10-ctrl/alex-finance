begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(29);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-linea-di-passaggio'
      and active
  ),
  3::bigint,
  'line-of-passing lesson has exactly three active questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'costruzione-linea-di-passaggio'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'line-of-passing lesson question positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-linea-di-passaggio'
      and question.active
  ),
  array['a', 'c', 'a']::text[],
  'line-of-passing lesson answer keys are A, C, A'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-linea-di-passaggio'
      and question.active
      and answer_key.question_id is null
  ),
  'every active question has a private answer key'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions
    where lesson_id = 'costruzione-linea-di-passaggio'
      and (not active or is_demo)
  ),
  'questions are active and are not demo content'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'costruzione-linea-di-passaggio'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'costruzione'
      and macro_phase = 'possesso'
      and active
  ),
  'server-side rule requires video completion and quiz submission for 60 points'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-linea-di-passaggio'
      and variant_id = 'linea-passaggio'
      and position = 1
      and active
      and duration_seconds = 12.000
  ),
  'required video variant and duration match the catalog'
);

select extensions.ok(
  not exists (
    select 1
    from public.teams team
    where team.name = 'Esordienti Poggio Mirteto'
      and not exists (
        select 1
        from public.lesson_assignments assignment
        where assignment.team_id = team.id
          and assignment.lesson_id = 'costruzione-linea-di-passaggio'
          and assignment.player_id is null
          and assignment.active
      )
  ),
  'the Production team has an active team assignment when present'
);

select extensions.ok(
  not exists (
    select 1
    from public.teams team
    join public.team_members member
      on member.team_id = team.id
     and member.role = 'player'
     and member.active
    join public.profiles profile
      on profile.id = member.profile_id
     and profile.account_active
    where team.name = 'Esordienti Poggio Mirteto'
      and not exists (
        select 1
        from public.lesson_progress progress
        where progress.team_id = team.id
          and progress.player_id = member.profile_id
          and progress.lesson_id = 'costruzione-linea-di-passaggio'
      )
  ),
  'every active Production Player receives lesson progress'
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
    '70000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach-linea-passaggio@rls.test',
    '',
    now(),
    '{"role":"coach"}'::jsonb,
    '{"display_name":"Coach Linea Passaggio"}'::jsonb,
    now(),
    now()
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'player-linea-passaggio@rls.test',
    '',
    now(),
    '{"role":"player","player_code":"LINEA01"}'::jsonb,
    '{"display_name":"Player Linea Passaggio"}'::jsonb,
    now(),
    now()
  );

insert into public.teams (id, name, season)
values (
  '71000000-0000-4000-8000-000000000001',
  'Line of Passing Test Team',
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
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'coach',
    true,
    'admin'
  ),
  (
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    'player',
    true,
    null
  );

-- Keep the server timing contract active while making this transactional test fast.
update private.lesson_video_requirements
set duration_seconds = 0.500
where lesson_id = 'costruzione-linea-di-passaggio'
  and variant_id = 'linea-passaggio';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.lives_ok(
  $$select public.assign_lesson(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    null,
    null
  )$$,
  'Coach Admin can assign the new lesson'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-linea-di-passaggio'
  ),
  0::bigint,
  'quiz stays hidden before the required video reaches 100 percent'
);

select extensions.throws_ok(
  $$select public.submit_quiz(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    '{
      "40000000-0000-4000-8000-000000000001":"b",
      "40000000-0000-4000-8000-000000000002":"a",
      "40000000-0000-4000-8000-000000000003":"b"
    }'::jsonb,
    '72000000-0000-4000-8000-000000000001'
  )$$,
  '22023',
  'all required videos must be completed before the quiz',
  'quiz submission is blocked before video completion'
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    'linea-passaggio',
    100::smallint,
    100::smallint,
    12
  )$$,
  '22023',
  'video checkpoints must start at zero',
  'the Player cannot jump directly to the final checkpoint'
);

select extensions.lives_ok(
  $$select public.record_video_checkpoint(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    'linea-passaggio',
    0::smallint,
    0::smallint,
    0
  )$$,
  'the required video starts at checkpoint zero'
);

select extensions.lives_ok(
  $test$
  do $body$
  begin
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '71000000-0000-4000-8000-000000000001',
      'costruzione-linea-di-passaggio', 'linea-passaggio', 25::smallint, 25::smallint, 3
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '71000000-0000-4000-8000-000000000001',
      'costruzione-linea-di-passaggio', 'linea-passaggio', 50::smallint, 50::smallint, 6
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '71000000-0000-4000-8000-000000000001',
      'costruzione-linea-di-passaggio', 'linea-passaggio', 75::smallint, 75::smallint, 9
    );
    perform pg_sleep(0.120);
    perform public.record_video_checkpoint(
      '71000000-0000-4000-8000-000000000001',
      'costruzione-linea-di-passaggio', 'linea-passaggio', 100::smallint, 100::smallint, 12
    );
  end
  $body$;
  $test$,
  'the video completes through ordered checkpoints'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-linea-di-passaggio'
  ),
  3::bigint,
  'all three quiz questions unlock after video completion'
);

select extensions.throws_ok(
  $$select public.complete_lesson(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  '22023',
  'quiz must be completed before the lesson',
  'lesson completion stays blocked until quiz submission'
);

select extensions.lives_ok(
  $$select public.submit_quiz(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    '{
      "40000000-0000-4000-8000-000000000001":"b",
      "40000000-0000-4000-8000-000000000002":"a",
      "40000000-0000-4000-8000-000000000003":"b"
    }'::jsonb,
    '72000000-0000-4000-8000-000000000001'
  )$$,
  'a fully answered zero-score quiz is accepted'
);

select extensions.is(
  (
    select score
    from public.quiz_attempts
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and client_attempt_id = '72000000-0000-4000-8000-000000000001'
  ),
  0::numeric,
  'zero is accepted because the quiz has no minimum passing score'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_answers
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-linea-di-passaggio'
  ),
  3::bigint,
  'all three quiz answers persist'
);

select extensions.lives_ok(
  $$select public.complete_lesson(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  'lesson completes after the video and quiz'
);

select extensions.is(
  (
    select points_earned
    from public.lesson_progress
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-linea-di-passaggio'
  ),
  60,
  'the lesson awards 60 points'
);

select extensions.is(
  (
    select status::text || ':' || progress_percent::text
    from public.lesson_progress
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-linea-di-passaggio'
  ),
  'completata:100',
  'completed status and progress persist when reloaded'
);

select extensions.is(
  (
    select count(*)
    from public.activity_events
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and dedupe_key = 'lesson_completed:costruzione-linea-di-passaggio'
  ),
  1::bigint,
  'one completion event is recorded'
);

select extensions.lives_ok(
  $$select public.complete_lesson(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio'
  )$$,
  'repeating completion is idempotent'
);

select extensions.is(
  (
    select points_earned
    from public.lesson_progress
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and lesson_id = 'costruzione-linea-di-passaggio'
  ),
  60,
  'repeating completion does not duplicate points'
);

select extensions.is(
  (
    select count(*)
    from public.activity_events
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000002'
      and dedupe_key = 'lesson_completed:costruzione-linea-di-passaggio'
  ),
  1::bigint,
  'repeating completion does not duplicate the event'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.throws_ok(
  $$select public.record_video_checkpoint(
    '71000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    'linea-passaggio',
    0::smallint,
    0::smallint,
    0
  )$$,
  '42501',
  'active lesson assignment required',
  'Coach playback cannot create Player video progress'
);

reset role;

select extensions.is(
  (
    select count(*)
    from public.video_progress
    where team_id = '71000000-0000-4000-8000-000000000001'
      and player_id = '70000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Coach playback leaves Player progress untouched'
);

select * from extensions.finish();
rollback;

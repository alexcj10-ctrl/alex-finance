begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(8);

select extensions.ok(
  exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'progressione-cambio-corsia'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'progressione'
      and macro_phase = 'possesso'
      and active
      and eligible_birth_years = array[2014, 2015]::smallint[]
  ),
  'change-lane lesson rule and audience are correct'
);

select extensions.is(
  (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-cambio-corsia'
      and active
  ),
  1::bigint,
  'change-lane lesson has one required video'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'progressione-cambio-corsia'
      and variant_id = 'cambio-corsia'
      and position = 1
      and active
      and duration_seconds = 20.000
  ),
  'change-lane required video metadata is correct'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'progressione-cambio-corsia'
      and active
      and not is_demo
  ),
  3::bigint,
  'change-lane lesson has exactly three active non-demo questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'progressione-cambio-corsia'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'change-lane quiz positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-cambio-corsia'
      and question.active
  ),
  array['b', 'a', 'c']::text[],
  'change-lane answer keys are B, A, C'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-cambio-corsia'
      and question.active
      and answer_key.question_id is null
  ),
  'every change-lane question has a private answer key'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_assignments
    where lesson_id = 'progressione-cambio-corsia'
  ),
  0::bigint,
  'change-lane lesson is not assigned automatically'
);

select * from extensions.finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(9);

select extensions.ok(
  exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'costruzione-occupare-spazi'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'progressione'
      and macro_phase = 'possesso'
      and active
      and eligible_birth_years = array[2014, 2015]::smallint[]
  ),
  'occupare-spazi lesson rule and audience are correct'
);

select extensions.is(
  (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-occupare-spazi'
      and active
  ),
  2::bigint,
  'occupare-spazi lesson has two required videos'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-occupare-spazi'
      and variant_id = 'occupare-spazi-1'
      and position = 1
      and active
      and duration_seconds = 12.000
  ),
  'occupare-spazi first required video metadata is correct'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-occupare-spazi'
      and variant_id = 'occupare-spazi-2'
      and position = 2
      and active
      and duration_seconds = 24.000
  ),
  'occupare-spazi second required video metadata is correct'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-occupare-spazi'
      and active
      and not is_demo
  ),
  3::bigint,
  'occupare-spazi lesson has exactly three active non-demo questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'costruzione-occupare-spazi'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'occupare-spazi quiz positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-occupare-spazi'
      and question.active
  ),
  array['b', 'c', 'a']::text[],
  'occupare-spazi answer keys are B, C, A'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-occupare-spazi'
      and question.active
      and answer_key.question_id is null
  ),
  'every occupare-spazi question has a private answer key'
);

select extensions.is(
  (
    select count(*)
    from public.lesson_assignments
    where lesson_id = 'costruzione-occupare-spazi'
  ),
  0::bigint,
  'occupare-spazi lesson is not assigned automatically'
);

select * from extensions.finish();
rollback;

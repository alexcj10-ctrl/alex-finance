begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(18);

select extensions.ok(
  position(
    'transizione'
    in pg_get_constraintdef(
      (
        select oid
        from pg_constraint
        where conrelid = 'private.lesson_rules'::regclass
          and conname = 'lesson_rules_phase_check'
      )
    )
  ) > 0,
  'lesson phase constraint includes transizione'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'transizione-inferiorita-numerica'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'transizione'
      and macro_phase = 'non_possesso'
      and active
      and eligible_birth_years = array[2014, 2015]::smallint[]
  ),
  'inferiority lesson rule and audience are correct'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'progressione-positiva-negativa'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'progressione'
      and macro_phase = 'possesso'
      and active
      and eligible_birth_years = array[2014, 2015]::smallint[]
  ),
  'positive-negative progression rule and audience are correct'
);

select extensions.is(
  (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'transizione-inferiorita-numerica'
      and active
  ),
  1::bigint,
  'inferiority lesson has one required video'
);

select extensions.ok(
  exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'transizione-inferiorita-numerica'
      and variant_id = 'inferiorita-numerica'
      and position = 1
      and active
      and duration_seconds = 12.000
  ),
  'inferiority required video metadata is correct'
);

select extensions.is(
  (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ),
  2::bigint,
  'progression lesson has two required videos'
);

select extensions.is(
  (
    select array_agg(variant_id order by position)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ),
  array['progressione-positiva', 'progressione-negativa']::text[],
  'progression required video variants are ordered correctly'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ),
  array[1, 2]::smallint[],
  'progression required video positions are complete'
);

select extensions.is(
  (
    select array_agg(duration_seconds order by position)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ),
  array[10.000, 12.000]::numeric[],
  'progression required video durations match the media files'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'transizione-inferiorita-numerica'
      and active
  ),
  3::bigint,
  'inferiority lesson has exactly three active questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'transizione-inferiorita-numerica'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'inferiority quiz positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'transizione-inferiorita-numerica'
      and question.active
  ),
  array['b', 'a', 'c']::text[],
  'inferiority answer keys are B, A, C'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'transizione-inferiorita-numerica'
      and question.active
      and answer_key.question_id is null
  ),
  'every inferiority question has a private answer key'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ),
  3::bigint,
  'progression lesson has exactly three active questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'progression quiz positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-positiva-negativa'
      and question.active
  ),
  array['b', 'c', 'b']::text[],
  'progression answer keys are B, C, B'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-positiva-negativa'
      and question.active
      and answer_key.question_id is null
  ),
  'every progression question has a private answer key'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id in (
      'transizione-inferiorita-numerica',
      'progressione-positiva-negativa'
    )
      and active
      and not is_demo
  ),
  6::bigint,
  'all six new questions are active and not demo content'
);

select * from extensions.finish();
rollback;

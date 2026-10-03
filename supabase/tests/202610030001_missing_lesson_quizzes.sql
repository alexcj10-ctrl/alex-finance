begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(13);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-attira-uomo-libero'
      and active
  ),
  3::bigint,
  'third-man lesson has three active questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'costruzione-attira-uomo-libero'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'third-man lesson question positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-attira-uomo-libero'
      and question.active
  ),
  array['b', 'c', 'a']::text[],
  'third-man lesson answer keys are B, C, A'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-attira-uomo-libero'
      and question.active
      and answer_key.question_id is null
  ),
  'third-man lesson questions all have feedback answer keys'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'pressione-alta-chiudi-centro-porta-fuori'
      and active
  ),
  3::bigint,
  'close-the-centre lesson has three active questions'
);

select extensions.is(
  (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'pressione-alta-chiudi-centro-porta-fuori'
      and active
  ),
  array[1, 2, 3]::smallint[],
  'close-the-centre lesson question positions are complete'
);

select extensions.is(
  (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'pressione-alta-chiudi-centro-porta-fuori'
      and question.active
  ),
  array['b', 'c', 'b']::text[],
  'close-the-centre lesson answer keys are B, C, B'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'pressione-alta-chiudi-centro-porta-fuori'
      and question.active
      and answer_key.question_id is null
  ),
  'close-the-centre lesson questions all have feedback answer keys'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-creare-ampiezza'
      and active
  ),
  2::bigint,
  'existing width lesson quiz remains unchanged'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_questions
    where lesson_id in (
      'costruzione-attira-uomo-libero',
      'pressione-alta-chiudi-centro-porta-fuori'
    )
      and (not active or is_demo)
  ),
  'new quiz questions are active and not demo content'
);

select extensions.ok(
  not exists (
    select 1
    from private.lesson_rules
    where lesson_id in (
      'costruzione-attira-uomo-libero',
      'pressione-alta-chiudi-centro-porta-fuori'
    )
      and minimum_quiz_percent is distinct from 0
  ),
  'both lessons require quiz submission without a minimum passing score'
);

select extensions.is(
  (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-attira-uomo-libero'
      and active
  ),
  1::bigint,
  'third-man lesson still requires its existing video'
);

select extensions.is(
  (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'pressione-alta-chiudi-centro-porta-fuori'
      and active
  ),
  2::bigint,
  'close-the-centre lesson still requires both existing video variants'
);

select * from extensions.finish();
rollback;

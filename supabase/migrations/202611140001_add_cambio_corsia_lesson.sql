begin;

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
  'progressione-cambio-corsia',
  60,
  100,
  0,
  'progressione',
  'possesso',
  true,
  array[2014, 2015]::smallint[]
)
on conflict (lesson_id) do update
set points = excluded.points,
    minimum_video_percent = excluded.minimum_video_percent,
    minimum_quiz_percent = excluded.minimum_quiz_percent,
    phase = excluded.phase,
    macro_phase = excluded.macro_phase,
    active = excluded.active,
    eligible_birth_years = excluded.eligible_birth_years;

insert into private.lesson_video_requirements (
  lesson_id,
  variant_id,
  position,
  active,
  duration_seconds
) values (
  'progressione-cambio-corsia',
  'cambio-corsia',
  1,
  true,
  20.000
)
on conflict (lesson_id, variant_id) do update
set position = excluded.position,
    active = excluded.active,
    duration_seconds = excluded.duration_seconds;

insert into public.quiz_questions (
  id,
  lesson_id,
  prompt,
  choices,
  position,
  active,
  is_demo
) values
  (
    '80000000-0000-4000-8000-000000000001',
    'progressione-cambio-corsia',
    'Perché può essere utile portare la palla da una corsia laterale all''altra?',
    '[{"id":"a","label":"Per fare più passaggi possibili"},{"id":"b","label":"Per attirare gli avversari verso la palla e trovare più spazio nella corsia lontana"},{"id":"c","label":"Per tenere sempre la palla vicino alla linea laterale"},{"id":"d","label":"Per rallentare sempre il gioco"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    'progressione-cambio-corsia',
    'Dopo aver portato la palla sulla corsia lontana, quale vantaggio può avere il compagno che riceve?',
    '[{"id":"a","label":"Più tempo e più spazio per ricevere e giocare"},{"id":"b","label":"Deve giocare obbligatoriamente all''indietro"},{"id":"c","label":"Deve ricevere sempre vicino alla linea laterale"},{"id":"d","label":"Ha meno possibilità di vedere il gioco"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    'progressione-cambio-corsia',
    'Ricevi sulla corsia lontana dopo il cambio di gioco e davanti a te si è liberato spazio. Cosa puoi fare?',
    '[{"id":"a","label":"Tornare sempre verso la corsia da cui è arrivata la palla"},{"id":"b","label":"Fermarmi e aspettare che gli avversari si avvicinino"},{"id":"c","label":"Sfruttare lo spazio e progredire in avanti se posso creare vantaggio"},{"id":"d","label":"Giocare sempre indietro senza osservare"}]'::jsonb,
    3,
    true,
    false
  )
on conflict (lesson_id, position) do update
set prompt = excluded.prompt,
    choices = excluded.choices,
    active = excluded.active,
    is_demo = excluded.is_demo,
    updated_at = now();

insert into private.quiz_answer_keys (
  question_id,
  correct_choice_id,
  feedback_correct,
  feedback_incorrect
)
select
  question.id,
  answer_key.correct_choice_id,
  answer_key.feedback_correct,
  answer_key.feedback_incorrect
from (
  values
    (
      'progressione-cambio-corsia',
      1::smallint,
      'b',
      'Esatto. La palla può attirare gli avversari verso una corsia e liberare spazio sul lato lontano.',
      'Il cambio di corsia non serve semplicemente a fare più passaggi. Cerchiamo di attirare gli avversari da una parte per trovare spazio dall''altra.'
    ),
    (
      'progressione-cambio-corsia',
      2::smallint,
      'a',
      'Esatto. Se gli avversari sono stati attiratti verso l''altra corsia, chi riceve sul lato lontano può avere più tempo e più spazio.',
      'Osserva cosa succede agli avversari quando vengono attiratti verso la palla: sul lato lontano possono aprirsi condizioni migliori per ricevere.'
    ),
    (
      'progressione-cambio-corsia',
      3::smallint,
      'c',
      'Esatto. Il cambio di corsia può permetterti di ricevere in vantaggio e, se davanti hai spazio utile, di progredire.',
      'Dopo il cambio di corsia devi osservare il nuovo spazio disponibile. Se puoi avanzare creando vantaggio, sfruttalo.'
    )
) as answer_key (
  lesson_id,
  position,
  correct_choice_id,
  feedback_correct,
  feedback_incorrect
)
join public.quiz_questions question
  on question.lesson_id = answer_key.lesson_id
 and question.position = answer_key.position
on conflict (question_id) do update
set correct_choice_id = excluded.correct_choice_id,
    feedback_correct = excluded.feedback_correct,
    feedback_incorrect = excluded.feedback_incorrect;

do $$
begin
  if not exists (
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
  ) then
    raise exception 'invalid server-side rule for progressione-cambio-corsia';
  end if;

  if (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-cambio-corsia'
      and active
  ) <> 1 then
    raise exception 'progressione-cambio-corsia must have one required video';
  end if;

  if not exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'progressione-cambio-corsia'
      and variant_id = 'cambio-corsia'
      and position = 1
      and active
      and duration_seconds = 20.000
  ) then
    raise exception 'invalid video requirement for progressione-cambio-corsia';
  end if;

  if (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'progressione-cambio-corsia'
      and active
      and not is_demo
  ) <> 3 then
    raise exception 'progressione-cambio-corsia must have three active non-demo questions';
  end if;

  if (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'progressione-cambio-corsia'
      and active
  ) <> array[1, 2, 3]::smallint[] then
    raise exception 'progressione-cambio-corsia quiz positions are invalid';
  end if;

  if (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-cambio-corsia'
      and question.active
  ) <> array['b', 'a', 'c']::text[] then
    raise exception 'progressione-cambio-corsia answer keys are invalid';
  end if;

  if exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-cambio-corsia'
      and question.active
      and answer_key.question_id is null
  ) then
    raise exception 'progressione-cambio-corsia has an active question without an answer key';
  end if;
end;
$$;

commit;

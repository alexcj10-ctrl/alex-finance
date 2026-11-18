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
  'costruzione-occupare-spazi',
  60,
  100,
  0,
  'costruzione',
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
) values
  (
    'costruzione-occupare-spazi',
    'occupare-spazi-1',
    1,
    true,
    12.000
  ),
  (
    'costruzione-occupare-spazi',
    'occupare-spazi-2',
    2,
    true,
    24.000
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
    '90000000-0000-4000-8000-000000000001',
    'costruzione-occupare-spazi',
    'Non hai una linea di passaggio pulita con il portatore. Cosa devi fare?',
    '[{"id":"a","label":"Restare fermo e aspettare che la palla arrivi"},{"id":"b","label":"Osservare uno spazio libero dove la palla può arrivare e muovermi per occuparlo"},{"id":"c","label":"Avvicinarmi sempre il più possibile al portatore"},{"id":"d","label":"Nascondermi dietro l''avversario"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    'costruzione-occupare-spazi',
    'Perché uno spazio libero può diventare una nuova soluzione per la squadra?',
    '[{"id":"a","label":"Perché la palla deve essere giocata sempre nello spazio vuoto"},{"id":"b","label":"Perché tutti i giocatori devono andare nello stesso spazio"},{"id":"c","label":"Perché se riconosco e occupo quello spazio posso diventare giocabile e creare una nuova linea di passaggio"},{"id":"d","label":"Perché lo spazio libero obbliga l''avversario a fermarsi"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    'costruzione-occupare-spazi',
    'Prima di muoverti per ricevere, cosa devi osservare?',
    '[{"id":"a","label":"Se esiste uno spazio libero dove la palla può arrivare e dove posso diventare giocabile"},{"id":"b","label":"Solo quanto sono vicino alla palla"},{"id":"c","label":"Se posso restare nella stessa posizione"},{"id":"d","label":"Solo dove si trova la porta avversaria"}]'::jsonb,
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
      'costruzione-occupare-spazi',
      1::smallint,
      'b',
      'Esatto. Se la linea di passaggio è chiusa, devi osservare dove può arrivare la palla e occupare uno spazio libero per diventare giocabile.',
      'Se resti nella stessa posizione, la linea può continuare a essere chiusa. Cerca invece uno spazio libero raggiungibile dalla palla e muoviti per occuparlo.'
    ),
    (
      'costruzione-occupare-spazi',
      2::smallint,
      'c',
      'Esatto. Uno spazio libero diventa una soluzione quando un giocatore lo riconosce, lo occupa e diventa raggiungibile dal portatore.',
      'Lo spazio da solo non è ancora una soluzione. Diventa utile quando un giocatore lo riconosce, lo occupa e crea una nuova possibilità di passaggio.'
    ),
    (
      'costruzione-occupare-spazi',
      3::smallint,
      'a',
      'Esatto. Prima di muoverti devi osservare la relazione tra palla, avversari e spazio, cercando una zona libera nella quale puoi diventare giocabile.',
      'Non basta essere vicino alla palla. Devi capire dove puoi muoverti per creare una linea di passaggio realmente utilizzabile.'
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
    where lesson_id = 'costruzione-occupare-spazi'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'costruzione'
      and macro_phase = 'possesso'
      and active
      and eligible_birth_years = array[2014, 2015]::smallint[]
  ) then
    raise exception 'invalid server-side rule for costruzione-occupare-spazi';
  end if;

  if (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-occupare-spazi'
      and active
  ) <> 2 then
    raise exception 'costruzione-occupare-spazi must have two required videos';
  end if;

  if not exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-occupare-spazi'
      and variant_id = 'occupare-spazi-1'
      and position = 1
      and active
      and duration_seconds = 12.000
  ) then
    raise exception 'invalid first video requirement for costruzione-occupare-spazi';
  end if;

  if not exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-occupare-spazi'
      and variant_id = 'occupare-spazi-2'
      and position = 2
      and active
      and duration_seconds = 24.000
  ) then
    raise exception 'invalid second video requirement for costruzione-occupare-spazi';
  end if;

  if (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-occupare-spazi'
      and active
      and not is_demo
  ) <> 3 then
    raise exception 'costruzione-occupare-spazi must have three active non-demo questions';
  end if;

  if (
    select array_agg(position order by position)
    from public.quiz_questions
    where lesson_id = 'costruzione-occupare-spazi'
      and active
  ) <> array[1, 2, 3]::smallint[] then
    raise exception 'costruzione-occupare-spazi quiz positions are invalid';
  end if;

  if (
    select array_agg(answer_key.correct_choice_id order by question.position)
    from public.quiz_questions question
    join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-occupare-spazi'
      and question.active
  ) <> array['b', 'c', 'a']::text[] then
    raise exception 'costruzione-occupare-spazi answer keys are invalid';
  end if;

  if exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-occupare-spazi'
      and question.active
      and answer_key.question_id is null
  ) then
    raise exception 'costruzione-occupare-spazi has an active question without an answer key';
  end if;
end;
$$;

commit;

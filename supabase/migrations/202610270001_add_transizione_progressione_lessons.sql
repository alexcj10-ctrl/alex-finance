begin;

alter table private.lesson_rules
  drop constraint if exists lesson_rules_phase_check;

alter table private.lesson_rules
  add constraint lesson_rules_phase_check check (phase in (
    'costruzione',
    'progressione',
    'finalizzazione',
    'pressione_alta',
    'pressione_bassa',
    'transizione'
  ));

insert into private.lesson_rules (
  lesson_id,
  points,
  minimum_video_percent,
  minimum_quiz_percent,
  phase,
  macro_phase,
  active,
  eligible_birth_years
) values
  (
    'transizione-inferiorita-numerica',
    60,
    100,
    0,
    'transizione',
    'non_possesso',
    true,
    array[2014, 2015]::smallint[]
  ),
  (
    'progressione-positiva-negativa',
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
) values
  (
    'transizione-inferiorita-numerica',
    'inferiorita-numerica',
    1,
    true,
    12.000
  ),
  (
    'progressione-positiva-negativa',
    'progressione-positiva',
    1,
    true,
    10.000
  ),
  (
    'progressione-positiva-negativa',
    'progressione-negativa',
    2,
    true,
    12.000
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
    '50000000-0000-4000-8000-000000000001',
    'transizione-inferiorita-numerica',
    'Vedi che gli avversari stanno attaccando una zona in superiorità numerica rispetto alla tua squadra. Cosa devi fare?',
    '[{"id":"a","label":"Uscire subito in pressione sul portatore"},{"id":"b","label":"Scappare verso la propria porta e togliere profondità"},{"id":"c","label":"Restare fermo nella propria posizione"},{"id":"d","label":"Andare verso il compagno più vicino"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'transizione-inferiorita-numerica',
    'Perché, quando siamo in inferiorità numerica, andare subito in pressione può essere pericoloso?',
    '[{"id":"a","label":"Perché gli avversari possono trovare una linea di passaggio libera, superare la pressione e creare pericolo"},{"id":"b","label":"Perché dobbiamo sempre lasciare il pallone agli avversari"},{"id":"c","label":"Perché non possiamo mai difendere in avanti"},{"id":"d","label":"Perché dobbiamo aspettare che la palla esca"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    'transizione-inferiorita-numerica',
    'Qual è la priorità quando difendiamo in inferiorità numerica?',
    '[{"id":"a","label":"Recuperare subito il pallone"},{"id":"b","label":"Seguire soltanto il giocatore con la palla"},{"id":"c","label":"Proteggere lo spazio tra i difensori e la propria porta, togliendo profondità"},{"id":"d","label":"Portare tutti i giocatori sulla fascia"}]'::jsonb,
    3,
    true,
    false
  ),
  (
    '60000000-0000-4000-8000-000000000001',
    'progressione-positiva-negativa',
    'Sei l''uomo libero, ricevi palla e hai spazio davanti a te che puoi utilizzare per creare vantaggio. Cosa devi fare?',
    '[{"id":"a","label":"Tornare sempre indietro"},{"id":"b","label":"Progressare nello spazio"},{"id":"c","label":"Fermarti e aspettare"},{"id":"d","label":"Giocare subito lateralmente"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'progressione-positiva-negativa',
    'Quando una progressione è positiva?',
    '[{"id":"a","label":"Quando avanzo anche se davanti a me non c''è spazio"},{"id":"b","label":"Quando corro più velocemente possibile"},{"id":"c","label":"Quando sono l''uomo libero e avanzando posso occupare uno spazio utile o creare superiorità"},{"id":"d","label":"Quando porto sempre la palla verso la porta"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    'progressione-positiva-negativa',
    'Sei libero, ma davanti a te lo spazio per progressare è chiuso e avanzare non crea vantaggio. Cosa fai?',
    '[{"id":"a","label":"Provo comunque a entrare nello spazio"},{"id":"b","label":"Ricomincio la giocata e cerco nuovamente l''uomo libero"},{"id":"c","label":"Tengo la palla fermo"},{"id":"d","label":"Calcio lungo"}]'::jsonb,
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
      'transizione-inferiorita-numerica',
      1::smallint,
      'b',
      'Esatto. Se siamo in inferiorità numerica dobbiamo prima scappare, proteggere la porta e togliere profondità.',
      'Se gli avversari hanno superiorità numerica, uscire in pressione può liberare un''altra linea di passaggio. Prima scappa, togli profondità e proteggi la porta.'
    ),
    (
      'transizione-inferiorita-numerica',
      2::smallint,
      'a',
      'Esatto. Se esci in pressione quando gli avversari hanno superiorità numerica, possono trovare un uomo libero, superare la pressione e creare pericolo.',
      'Il problema non è pressare in generale. Il problema è farlo quando siamo in inferiorità numerica: l''avversario può trovare una linea libera e superare la pressione.'
    ),
    (
      'transizione-inferiorita-numerica',
      3::smallint,
      'c',
      'Esatto. La priorità è proteggere lo spazio dietro di noi e la propria porta, togliendo profondità e guadagnando tempo.',
      'Quando siamo in inferiorità numerica la priorità non è recuperare subito il pallone. Prima proteggiamo profondità e porta.'
    ),
    (
      'progressione-positiva-negativa',
      1::smallint,
      'b',
      'Esatto. Se sei l''uomo libero e davanti hai uno spazio utile, la progressione può creare un nuovo vantaggio per la squadra.',
      'Prima osserva lo spazio davanti a te. Se sei l''uomo libero e quello spazio può essere utilizzato per creare vantaggio, devi progredire.'
    ),
    (
      'progressione-positiva-negativa',
      2::smallint,
      'c',
      'Esatto. La progressione è positiva quando sfrutta uno spazio realmente disponibile e permette di creare o aumentare un vantaggio.',
      'Progressare non significa semplicemente andare in avanti. La progressione è positiva quando sei l''uomo libero e avanzare nello spazio crea un vantaggio reale.'
    ),
    (
      'progressione-positiva-negativa',
      3::smallint,
      'b',
      'Esatto. Se lo spazio non c''è, progressare non serve. Ricominciamo la giocata e cerchiamo nuovamente l''uomo libero.',
      'Se avanzare non crea vantaggio, non dobbiamo forzare la progressione. Ricominciamo la giocata per trovare nuovamente l''uomo libero.'
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
declare
  target_lesson_id text;
begin
  if not exists (
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
  ) then
    raise exception 'invalid server-side rule for transizione-inferiorita-numerica';
  end if;

  if not exists (
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
  ) then
    raise exception 'invalid server-side rule for progressione-positiva-negativa';
  end if;

  if (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'transizione-inferiorita-numerica'
      and active
  ) <> 1 then
    raise exception 'transizione-inferiorita-numerica must have one required video';
  end if;

  if (
    select count(*)
    from private.lesson_video_requirements
    where lesson_id = 'progressione-positiva-negativa'
      and active
  ) <> 2 then
    raise exception 'progressione-positiva-negativa must have two required videos';
  end if;

  foreach target_lesson_id in array array[
    'transizione-inferiorita-numerica',
    'progressione-positiva-negativa'
  ] loop
    if (
      select count(*)
      from public.quiz_questions question
      where question.lesson_id = target_lesson_id
        and question.active
    ) <> 3 then
      raise exception 'lesson % must have exactly three active quiz questions', target_lesson_id;
    end if;

    if exists (
      select 1
      from public.quiz_questions question
      left join private.quiz_answer_keys answer_key
        on answer_key.question_id = question.id
      where question.lesson_id = target_lesson_id
        and question.active
        and answer_key.question_id is null
    ) then
      raise exception 'lesson % has an active question without an answer key', target_lesson_id;
    end if;
  end loop;
end;
$$;

commit;

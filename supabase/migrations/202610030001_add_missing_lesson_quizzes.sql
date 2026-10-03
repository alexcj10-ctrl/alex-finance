begin;

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
    '20000000-0000-4000-8000-000000000001',
    'costruzione-attira-uomo-libero',
    'Quando usiamo il terzo uomo?',
    '[{"id":"a","label":"Ogni volta che abbiamo il possesso"},{"id":"b","label":"Quando vediamo l’uomo libero ma non abbiamo una linea di passaggio diretta verso di lui"},{"id":"c","label":"Solo quando siamo vicino alla porta"},{"id":"d","label":"Quando vogliamo rallentare il gioco"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'costruzione-attira-uomo-libero',
    'Qual è il vero obiettivo del terzo uomo?',
    '[{"id":"a","label":"Fare più passaggi possibili"},{"id":"b","label":"Tornare sempre indietro"},{"id":"c","label":"Raggiungere un giocatore utile che non possiamo servire direttamente"},{"id":"d","label":"Far toccare la palla a tutti"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'costruzione-attira-uomo-libero',
    'Vedi un compagno libero oltre la pressione, ma la linea di passaggio è chiusa. Cosa cerchi?',
    '[{"id":"a","label":"Un compagno intermedio che possa collegarti con l’uomo libero"},{"id":"b","label":"Un tiro da lontano"},{"id":"c","label":"Di portare sempre la palla da solo"},{"id":"d","label":"Di passare comunque attraverso l’avversario"}]'::jsonb,
    3,
    true,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    'pressione-alta-chiudi-centro-porta-fuori',
    'Perché quando difendiamo dobbiamo stare più vicini tra noi?',
    '[{"id":"a","label":"Per occupare meno campo senza motivo"},{"id":"b","label":"Per ridurre gli spazi che l’avversario può utilizzare"},{"id":"c","label":"Per lasciare libera la zona centrale"},{"id":"d","label":"Per stare tutti vicino alla palla"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'pressione-alta-chiudi-centro-porta-fuori',
    'Qual è lo spazio che dobbiamo proteggere prima?',
    '[{"id":"a","label":"La fascia laterale"},{"id":"b","label":"La bandierina del calcio d’angolo"},{"id":"c","label":"Il centro e la strada verso la nostra porta"},{"id":"d","label":"Qualsiasi zona senza priorità"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'pressione-alta-chiudi-centro-porta-fuori',
    'Se chiudiamo bene il centro, dove vogliamo indirizzare l’avversario?',
    '[{"id":"a","label":"Verso la nostra porta"},{"id":"b","label":"Verso le corsie laterali"},{"id":"c","label":"Dentro il centro del campo"},{"id":"d","label":"Non importa dove"}]'::jsonb,
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
      'costruzione-attira-uomo-libero',
      1::smallint,
      'b',
      'Esatto. Se l’uomo libero non è raggiungibile direttamente, possiamo usare un compagno intermedio per arrivare a lui.',
      'Guarda prima dove si trova l’uomo libero. Il terzo uomo serve quando non possiamo raggiungerlo con un passaggio diretto.'
    ),
    (
      'costruzione-attira-uomo-libero',
      2::smallint,
      'c',
      'Esatto. Il terzo uomo crea una nuova linea di passaggio per raggiungere l’uomo libero.',
      'Il numero di passaggi non è l’obiettivo. Il terzo uomo serve per arrivare a una soluzione utile che non è accessibile direttamente.'
    ),
    (
      'costruzione-attira-uomo-libero',
      3::smallint,
      'a',
      'Esatto. Il compagno intermedio permette di cambiare l’angolo della giocata e raggiungere l’uomo libero.',
      'Se la linea diretta è chiusa, dobbiamo trovare un’altra connessione. Cerca un compagno intermedio.'
    ),
    (
      'pressione-alta-chiudi-centro-porta-fuori',
      1::smallint,
      'b',
      'Esatto. Distanze più corte tra i compagni ci aiutano a chiudere gli spazi e a difendere insieme.',
      'Stare compatti non significa andare tutti sulla palla. Significa ridurre gli spazi che l’avversario può utilizzare.'
    ),
    (
      'pressione-alta-chiudi-centro-porta-fuori',
      2::smallint,
      'c',
      'Esatto. La priorità è proteggere la porta e il corridoio centrale.',
      'Non tutti gli spazi hanno la stessa pericolosità. Prima proteggiamo porta e zona centrale.'
    ),
    (
      'pressione-alta-chiudi-centro-porta-fuori',
      3::smallint,
      'b',
      'Esatto. Vogliamo proteggere il centro e orientare l’avversario verso l’esterno.',
      'La zona centrale è quella che vogliamo proteggere. Preferiamo accompagnare il gioco avversario verso le corsie laterali.'
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
  foreach target_lesson_id in array array[
    'costruzione-attira-uomo-libero',
    'pressione-alta-chiudi-centro-porta-fuori'
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

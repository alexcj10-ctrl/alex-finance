begin;

update public.quiz_questions
set choices = '[{"id":"a","label":"Tornare sempre indietro"},{"id":"b","label":"Progredire nello spazio"},{"id":"c","label":"Fermarti e aspettare"},{"id":"d","label":"Giocare subito lateralmente"}]'::jsonb,
    updated_at = now()
where lesson_id = 'progressione-positiva-negativa'
  and position = 1;

update public.quiz_questions
set prompt = 'Sei libero, ma davanti a te lo spazio per progredire è chiuso e avanzare non crea vantaggio. Cosa fai?',
    updated_at = now()
where lesson_id = 'progressione-positiva-negativa'
  and position = 3;

update private.quiz_answer_keys answer_key
set feedback_incorrect = 'Progredire non significa semplicemente andare in avanti. La progressione è positiva quando sei l''uomo libero e avanzare nello spazio crea un vantaggio reale.'
from public.quiz_questions question
where answer_key.question_id = question.id
  and question.lesson_id = 'progressione-positiva-negativa'
  and question.position = 2;

update private.quiz_answer_keys answer_key
set feedback_correct = 'Esatto. Se lo spazio non c''è, progredire non serve. Ricominciamo la giocata e cerchiamo nuovamente l''uomo libero.'
from public.quiz_questions question
where answer_key.question_id = question.id
  and question.lesson_id = 'progressione-positiva-negativa'
  and question.position = 3;

do $$
begin
  if exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'progressione-positiva-negativa'
      and (
        lower(question.prompt) like '%progressar%'
        or lower(question.choices::text) like '%progressar%'
        or lower(coalesce(answer_key.feedback_correct, '')) like '%progressar%'
        or lower(coalesce(answer_key.feedback_incorrect, '')) like '%progressar%'
      )
  ) then
    raise exception 'progressare wording is still present in the progression lesson';
  end if;
end;
$$;

commit;

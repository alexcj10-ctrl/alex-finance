begin;

insert into private.lesson_rules (
  lesson_id,
  points,
  minimum_video_percent,
  minimum_quiz_percent,
  phase,
  macro_phase,
  active
) values (
  'costruzione-linea-di-passaggio',
  60,
  100,
  0,
  'costruzione',
  'possesso',
  true
)
on conflict (lesson_id) do update
set points = excluded.points,
    minimum_video_percent = excluded.minimum_video_percent,
    minimum_quiz_percent = excluded.minimum_quiz_percent,
    phase = excluded.phase,
    macro_phase = excluded.macro_phase,
    active = excluded.active;

insert into private.lesson_video_requirements (
  lesson_id,
  variant_id,
  position,
  active,
  duration_seconds
) values (
  'costruzione-linea-di-passaggio',
  'linea-passaggio',
  1,
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
    '40000000-0000-4000-8000-000000000001',
    'costruzione-linea-di-passaggio',
    'Prima di chiedere palla, cosa devi controllare?',
    '[{"id":"a","label":"Se tra il portatore e me c’è una linea di passaggio pulita"},{"id":"b","label":"Se sono il giocatore più vicino alla palla"},{"id":"c","label":"Se un mio compagno è nella mia stessa posizione"},{"id":"d","label":"Se posso rimanere fermo dove sono"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'costruzione-linea-di-passaggio',
    'Un avversario si trova sulla linea di passaggio tra il portatore e te. Cosa devi fare?',
    '[{"id":"a","label":"Restare fermo e chiedere palla più forte"},{"id":"b","label":"Avvicinarti direttamente al portatore senza cambiare angolo"},{"id":"c","label":"Muovermi per creare un nuovo angolo e liberare la linea di passaggio"},{"id":"d","label":"Nascondermi dietro l’avversario"}]'::jsonb,
    2,
    true,
    false
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'costruzione-linea-di-passaggio',
    'Quando sei realmente in una linea di passaggio pulita?',
    '[{"id":"a","label":"Quando il portatore può raggiungermi direttamente senza che un avversario chiuda la traiettoria"},{"id":"b","label":"Quando sono molto lontano dalla palla"},{"id":"c","label":"Quando sono sulla stessa linea di un avversario"},{"id":"d","label":"Quando sono molto vicino a un altro compagno"}]'::jsonb,
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
      1::smallint,
      'a',
      'Esatto. Prima di ricevere devi capire se il portatore può raggiungerti con una linea di passaggio pulita.',
      'Prima guarda la relazione tra te, la palla e gli avversari. Devi capire se la linea di passaggio è realmente libera.'
    ),
    (
      2::smallint,
      'c',
      'Esatto. Se la linea è chiusa, devi muoverti per creare un nuovo angolo e diventare giocabile.',
      'Se l’avversario chiude la traiettoria, restare nella stessa posizione non risolve il problema. Devi muoverti per liberare la linea.'
    ),
    (
      3::smallint,
      'a',
      'Esatto. Sei realmente giocabile quando esiste una traiettoria pulita tra il portatore e te.',
      'Essere libero non basta. Devi essere raggiungibile: la traiettoria tra il portatore e te deve essere pulita.'
    )
) as answer_key (
  position,
  correct_choice_id,
  feedback_correct,
  feedback_incorrect
)
join public.quiz_questions question
  on question.lesson_id = 'costruzione-linea-di-passaggio'
 and question.position = answer_key.position
on conflict (question_id) do update
set correct_choice_id = excluded.correct_choice_id,
    feedback_correct = excluded.feedback_correct,
    feedback_incorrect = excluded.feedback_incorrect;

-- Make the lesson immediately available to the existing Production team and
-- keep it available to future Players through the active team assignment.
insert into public.lesson_assignments (
  lesson_id,
  team_id,
  player_id,
  assigned_by,
  assigned_at,
  active
)
select
  'costruzione-linea-di-passaggio',
  team.id,
  null,
  coach.profile_id,
  now(),
  true
from public.teams team
join lateral (
  select member.profile_id
  from public.team_members member
  join public.profiles profile on profile.id = member.profile_id
  where member.team_id = team.id
    and member.role = 'coach'
    and member.coach_access_level = 'admin'
    and member.active
    and profile.role = 'coach'
    and profile.account_active
  order by member.profile_id
  limit 1
) coach on true
where team.name = 'Esordienti Poggio Mirteto'
  and not exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.team_id = team.id
      and assignment.lesson_id = 'costruzione-linea-di-passaggio'
      and assignment.player_id is null
      and assignment.active
  );

with materialized as (
  insert into public.lesson_progress (
    team_id,
    player_id,
    lesson_id,
    status,
    progress_percent,
    assigned_at
  )
  select
    assignment.team_id,
    member.profile_id,
    assignment.lesson_id,
    'da_fare',
    0,
    assignment.assigned_at
  from public.lesson_assignments assignment
  join public.teams team on team.id = assignment.team_id
  join public.team_members member
    on member.team_id = assignment.team_id
   and member.role = 'player'
   and member.active
  join public.profiles profile
    on profile.id = member.profile_id
   and profile.role = 'player'
   and profile.account_active
  where team.name = 'Esordienti Poggio Mirteto'
    and assignment.lesson_id = 'costruzione-linea-di-passaggio'
    and assignment.player_id is null
    and assignment.active
  on conflict (team_id, player_id, lesson_id) do nothing
  returning team_id, player_id, lesson_id
)
insert into public.activity_events (
  team_id,
  player_id,
  lesson_id,
  event_type,
  metadata,
  dedupe_key
)
select
  materialized.team_id,
  materialized.player_id,
  materialized.lesson_id,
  'lesson_assigned',
  jsonb_build_object(
    'scope', 'team',
    'assignmentId', assignment.id
  ),
  'lesson_assigned:' || materialized.lesson_id
from materialized
join public.lesson_assignments assignment
  on assignment.team_id = materialized.team_id
 and assignment.lesson_id = materialized.lesson_id
 and assignment.player_id is null
 and assignment.active
on conflict (team_id, player_id, dedupe_key)
  where dedupe_key is not null
  do nothing;

do $$
begin
  if not exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'costruzione-linea-di-passaggio'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and phase = 'costruzione'
      and macro_phase = 'possesso'
      and active
  ) then
    raise exception 'invalid server-side rule for costruzione-linea-di-passaggio';
  end if;

  if not exists (
    select 1
    from private.lesson_video_requirements
    where lesson_id = 'costruzione-linea-di-passaggio'
      and variant_id = 'linea-passaggio'
      and position = 1
      and active
      and duration_seconds = 12.000
  ) then
    raise exception 'invalid video requirement for costruzione-linea-di-passaggio';
  end if;

  if (
    select count(*)
    from public.quiz_questions
    where lesson_id = 'costruzione-linea-di-passaggio'
      and active
  ) <> 3 then
    raise exception 'costruzione-linea-di-passaggio must have exactly three active questions';
  end if;

  if exists (
    select 1
    from public.quiz_questions question
    left join private.quiz_answer_keys answer_key
      on answer_key.question_id = question.id
    where question.lesson_id = 'costruzione-linea-di-passaggio'
      and question.active
      and answer_key.question_id is null
  ) then
    raise exception 'costruzione-linea-di-passaggio has a question without an answer key';
  end if;

  if exists (
    select 1
    from public.teams team
    where team.name = 'Esordienti Poggio Mirteto'
  ) and not exists (
    select 1
    from public.lesson_assignments assignment
    join public.teams team on team.id = assignment.team_id
    where team.name = 'Esordienti Poggio Mirteto'
      and assignment.lesson_id = 'costruzione-linea-di-passaggio'
      and assignment.player_id is null
      and assignment.active
  ) then
    raise exception 'Production team assignment was not created for costruzione-linea-di-passaggio';
  end if;

  if exists (
    select 1
    from public.teams team
    join public.team_members member
      on member.team_id = team.id
     and member.role = 'player'
     and member.active
    join public.profiles profile
      on profile.id = member.profile_id
     and profile.role = 'player'
     and profile.account_active
    where team.name = 'Esordienti Poggio Mirteto'
      and not exists (
        select 1
        from public.lesson_progress progress
        where progress.team_id = team.id
          and progress.player_id = member.profile_id
          and progress.lesson_id = 'costruzione-linea-di-passaggio'
      )
  ) then
    raise exception 'Production Player progress was not created for costruzione-linea-di-passaggio';
  end if;
end;
$$;

commit;

begin;

-- The lesson catalog remains in the application, while this private mirror is
-- the server-side authority for the video variants required to unlock a quiz.
create table if not exists private.lesson_video_requirements (
  lesson_id text not null
    references private.lesson_rules(lesson_id) on delete cascade,
  variant_id text not null check (
    variant_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'
  ),
  position smallint not null check (position between 1 and 100),
  active boolean not null default true,
  primary key (lesson_id, variant_id),
  unique (lesson_id, position)
);

insert into private.lesson_video_requirements (
  lesson_id, variant_id, position, active
) values
  ('costruzione-creare-ampiezza', 'variante-a', 1, true),
  ('costruzione-creare-ampiezza', 'variante-b', 2, true),
  ('costruzione-attira-uomo-libero', 'terzo-uomo-dx', 1, true),
  ('pressione-alta-chiudi-centro-porta-fuori', 'pressione-alta-dx', 1, true),
  ('pressione-alta-chiudi-centro-porta-fuori', 'pressione-alta-sx', 2, true)
on conflict (lesson_id, variant_id) do update
set position = excluded.position,
    active = excluded.active;

-- A submitted quiz is required, but there is no minimum passing score.
update private.lesson_rules
set minimum_quiz_percent = 0
where active;

create or replace function private.has_completed_required_videos(
  p_team_id uuid,
  p_player_id uuid,
  p_lesson_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from private.lesson_video_requirements required_video
      where required_video.lesson_id = p_lesson_id
        and required_video.active
    )
    and not exists (
      select 1
      from private.lesson_video_requirements required_video
      where required_video.lesson_id = p_lesson_id
        and required_video.active
        and not exists (
          select 1
          from public.video_progress progress
          where progress.team_id = p_team_id
            and progress.player_id = p_player_id
            and progress.lesson_id = required_video.lesson_id
            and progress.variant_id = required_video.variant_id
            and progress.completed
            and progress.last_checkpoint = 100
            and progress.watched_percent = 100
        )
    );
$$;

-- Coaches may inspect the configured quiz at any time. A Player can read quiz
-- questions only after every required video variant is complete in the DB.
create or replace function private.can_read_quiz_question(p_lesson_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.profiles p on p.id = tm.profile_id
    where tm.profile_id = (select auth.uid())
      and tm.active
      and p.account_active
      and (
        (tm.role = 'coach' and p.role = 'coach')
        or (
          tm.role = 'player'
          and p.role = 'player'
          and exists (
            select 1
            from public.lesson_assignments la
            where la.team_id = tm.team_id
              and la.lesson_id = p_lesson_id
              and la.active
              and (la.player_id is null or la.player_id = tm.profile_id)
          )
          and private.has_completed_required_videos(
            tm.team_id,
            tm.profile_id,
            p_lesson_id
          )
        )
      )
  );
$$;

create or replace function public.record_video_checkpoint(
  p_team_id uuid,
  p_lesson_id text,
  p_variant_id text,
  p_checkpoint smallint,
  p_watched_percent smallint,
  p_last_position_seconds numeric
)
returns public.video_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_player_id uuid := auth.uid();
  event_name text;
  previous_checkpoint smallint;
  normalized_percent smallint;
  result public.video_progress%rowtype;
begin
  if p_variant_id is null
     or p_variant_id !~ '^[a-z0-9][a-z0-9-]{0,127}$'
     or p_checkpoint not in (0, 25, 50, 75, 100)
     or p_watched_percent not between p_checkpoint and 100
     or p_last_position_seconds not between 0 and 86400 then
    raise exception 'invalid video checkpoint payload' using errcode = '22023';
  end if;

  perform public.start_lesson(p_team_id, p_lesson_id);

  if not exists (
    select 1
    from private.lesson_video_requirements required_video
    where required_video.lesson_id = p_lesson_id
      and required_video.variant_id = p_variant_id
      and required_video.active
  ) then
    raise exception 'video variant is not required for this lesson'
      using errcode = '22023';
  end if;

  select progress.last_checkpoint into previous_checkpoint
  from public.video_progress progress
  where progress.team_id = p_team_id
    and progress.player_id = current_player_id
    and progress.lesson_id = p_lesson_id
    and progress.variant_id = p_variant_id
  for update;

  if not found and p_checkpoint <> 0 then
    raise exception 'video checkpoints must start at zero'
      using errcode = '22023';
  end if;

  if previous_checkpoint is not null
     and p_checkpoint > previous_checkpoint + 25 then
    raise exception 'video checkpoints must be recorded in order'
      using errcode = '22023';
  end if;

  -- Persist only trusted checkpoint progress. The browser may report a later
  -- current position, but it cannot turn an earlier checkpoint into 100%.
  normalized_percent := p_checkpoint;

  insert into public.video_progress (
    team_id,
    player_id,
    lesson_id,
    variant_id,
    watched_percent,
    last_position_seconds,
    last_checkpoint,
    completed
  ) values (
    p_team_id,
    current_player_id,
    p_lesson_id,
    p_variant_id,
    normalized_percent,
    p_last_position_seconds,
    p_checkpoint,
    p_checkpoint = 100
  )
  on conflict (team_id, player_id, lesson_id, variant_id) do update
  set watched_percent = greatest(
        public.video_progress.watched_percent,
        excluded.watched_percent
      ),
      last_position_seconds = case
        when excluded.last_checkpoint >= public.video_progress.last_checkpoint
          then excluded.last_position_seconds
        else public.video_progress.last_position_seconds
      end,
      last_checkpoint = greatest(
        public.video_progress.last_checkpoint,
        excluded.last_checkpoint
      ),
      completed = public.video_progress.completed or excluded.completed
  returning * into result;

  update public.lesson_progress lp
  set progress_percent = greatest(
        lp.progress_percent,
        least(normalized_percent, 99)
      )
  where lp.team_id = p_team_id
    and lp.player_id = current_player_id
    and lp.lesson_id = p_lesson_id
    and lp.status = 'in_corso';

  event_name := case p_checkpoint
    when 0 then 'video_started'
    when 25 then 'video_25'
    when 50 then 'video_50'
    when 75 then 'video_75'
    when 100 then 'video_completed'
  end;

  insert into public.activity_events (
    team_id, player_id, lesson_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id,
    current_player_id,
    p_lesson_id,
    event_name,
    jsonb_build_object(
      'variantId', p_variant_id,
      'watchedPercent', result.watched_percent
    ),
    'video:' || p_lesson_id || ':' || p_variant_id || ':' || p_checkpoint::text
  )
  on conflict (team_id, player_id, dedupe_key)
    where dedupe_key is not null
    do nothing;

  return result;
end;
$$;

create or replace function public.complete_lesson(
  p_team_id uuid,
  p_lesson_id text
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_player_id uuid := auth.uid();
  rule private.lesson_rules%rowtype;
  result public.lesson_progress%rowtype;
begin
  perform public.start_lesson(p_team_id, p_lesson_id);

  select lr.* into rule
  from private.lesson_rules lr
  where lr.lesson_id = p_lesson_id and lr.active;

  if not found then
    raise exception 'unknown or inactive lesson' using errcode = '22023';
  end if;

  select lp.* into result
  from public.lesson_progress lp
  where lp.team_id = p_team_id
    and lp.player_id = current_player_id
    and lp.lesson_id = p_lesson_id
  for update;

  if result.status = 'completata' then
    return result;
  end if;

  if not private.has_completed_required_videos(
    p_team_id,
    current_player_id,
    p_lesson_id
  ) then
    raise exception 'all required videos must be completed'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.quiz_attempts qa
    where qa.team_id = p_team_id
      and qa.player_id = current_player_id
      and qa.lesson_id = p_lesson_id
  ) then
    raise exception 'quiz must be completed before the lesson'
      using errcode = '22023';
  end if;

  update public.lesson_progress lp
  set status = 'completata',
      progress_percent = 100,
      points_earned = case
        when lp.points_earned = 0 then rule.points
        else lp.points_earned
      end
  where lp.team_id = p_team_id
    and lp.player_id = current_player_id
    and lp.lesson_id = p_lesson_id
  returning lp.* into result;

  insert into public.activity_events (
    team_id, player_id, lesson_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id,
    current_player_id,
    p_lesson_id,
    'lesson_completed',
    jsonb_build_object('pointsEarned', result.points_earned),
    'lesson_completed:' || p_lesson_id
  )
  on conflict (team_id, player_id, dedupe_key)
    where dedupe_key is not null
    do nothing;

  perform private.award_player_trophies(p_team_id, current_player_id);

  return result;
end;
$$;

create or replace function public.submit_quiz(
  p_team_id uuid,
  p_lesson_id text,
  p_answers jsonb,
  p_client_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_player_id uuid := auth.uid();
  result public.quiz_attempts%rowtype;
  question record;
  selected_choice text;
  answer_is_correct boolean;
  answer_feedback text;
  answer_results jsonb := '[]'::jsonb;
  total_count integer;
  keyed_count integer;
  supplied_count integer;
  correct_count integer := 0;
  next_attempt integer;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be a JSON object' using errcode = '22023';
  end if;

  if current_player_id is null
     or not private.player_has_active_assignment(p_team_id, current_player_id, p_lesson_id) then
    raise exception 'active lesson assignment required' using errcode = '42501';
  end if;

  if p_client_attempt_id is not null then
    select qa.* into result
    from public.quiz_attempts qa
    where qa.team_id = p_team_id
      and qa.player_id = current_player_id
      and qa.client_attempt_id = p_client_attempt_id;

    if found then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'questionId', a.question_id,
            'selectedChoiceId', a.selected_choice_id,
            'isCorrect', a.is_correct,
            'feedback', a.feedback
          ) order by q.position
        ),
        '[]'::jsonb
      ) into answer_results
      from public.quiz_answers a
      join public.quiz_questions q on q.id = a.question_id
      where a.attempt_id = result.id;

      return jsonb_build_object(
        'attemptId', result.id,
        'attemptNumber', result.attempt_number,
        'totalQuestions', result.total_questions,
        'correctAnswers', result.correct_answers,
        'percentage', result.score,
        'pointsEarned', result.points_earned,
        'completedAt', result.completed_at,
        'answers', answer_results
      );
    end if;
  end if;

  if not private.has_completed_required_videos(
    p_team_id,
    current_player_id,
    p_lesson_id
  ) then
    raise exception 'all required videos must be completed before the quiz'
      using errcode = '22023';
  end if;

  select
    count(*)::integer,
    count(k.question_id)::integer
  into total_count, keyed_count
  from public.quiz_questions q
  left join private.quiz_answer_keys k on k.question_id = q.id
  where q.lesson_id = p_lesson_id and q.active;

  if total_count not between 2 and 3 or keyed_count <> total_count then
    raise exception 'quiz is not configured correctly' using errcode = '22023';
  end if;

  select count(*)::integer into supplied_count
  from jsonb_object_keys(p_answers);

  if supplied_count <> total_count then
    raise exception 'exactly one answer per question is required' using errcode = '22023';
  end if;

  for question in
    select
      q.id,
      q.position,
      q.choices,
      k.correct_choice_id,
      k.feedback_correct,
      k.feedback_incorrect
    from public.quiz_questions q
    join private.quiz_answer_keys k on k.question_id = q.id
    where q.lesson_id = p_lesson_id and q.active
    order by q.position
  loop
    selected_choice := p_answers ->> question.id::text;

    if selected_choice is null or not exists (
      select 1
      from jsonb_array_elements(question.choices) choice
      where choice ->> 'id' = selected_choice
    ) then
      raise exception 'invalid answer for question %', question.id
        using errcode = '22023';
    end if;

    answer_is_correct := selected_choice = question.correct_choice_id;
    answer_feedback := case
      when answer_is_correct then question.feedback_correct
      else question.feedback_incorrect
    end;
    if answer_is_correct then
      correct_count := correct_count + 1;
    end if;

    answer_results := answer_results || jsonb_build_array(
      jsonb_build_object(
        'questionId', question.id,
        'selectedChoiceId', selected_choice,
        'isCorrect', answer_is_correct,
        'feedback', answer_feedback
      )
    );
  end loop;

  perform public.start_lesson(p_team_id, p_lesson_id);

  select coalesce(max(qa.attempt_number), 0) + 1 into next_attempt
  from public.quiz_attempts qa
  where qa.team_id = p_team_id
    and qa.player_id = current_player_id
    and qa.lesson_id = p_lesson_id;

  insert into public.quiz_attempts (
    team_id,
    player_id,
    lesson_id,
    total_questions,
    correct_answers,
    attempt_number,
    client_attempt_id,
    points_earned
  ) values (
    p_team_id,
    current_player_id,
    p_lesson_id,
    total_count,
    correct_count,
    next_attempt,
    p_client_attempt_id,
    0
  )
  returning * into result;

  for question in
    select
      q.id,
      q.position,
      q.choices,
      k.correct_choice_id,
      k.feedback_correct,
      k.feedback_incorrect
    from public.quiz_questions q
    join private.quiz_answer_keys k on k.question_id = q.id
    where q.lesson_id = p_lesson_id and q.active
    order by q.position
  loop
    selected_choice := p_answers ->> question.id::text;
    answer_is_correct := selected_choice = question.correct_choice_id;
    answer_feedback := case
      when answer_is_correct then question.feedback_correct
      else question.feedback_incorrect
    end;

    insert into public.quiz_answers (
      attempt_id,
      team_id,
      player_id,
      lesson_id,
      question_id,
      selected_choice_id,
      is_correct,
      feedback
    ) values (
      result.id,
      p_team_id,
      current_player_id,
      p_lesson_id,
      question.id,
      selected_choice,
      answer_is_correct,
      answer_feedback
    );
  end loop;

  update public.lesson_progress lp
  set progress_percent = greatest(lp.progress_percent, 99)
  where lp.team_id = p_team_id
    and lp.player_id = current_player_id
    and lp.lesson_id = p_lesson_id
    and lp.status = 'in_corso';

  insert into public.activity_events (
    team_id, player_id, lesson_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id,
    current_player_id,
    p_lesson_id,
    'quiz_completed',
    jsonb_build_object(
      'attemptId', result.id,
      'attemptNumber', result.attempt_number,
      'percentage', result.score
    ),
    'quiz_completed:' || result.id::text
  );

  return jsonb_build_object(
    'attemptId', result.id,
    'attemptNumber', result.attempt_number,
    'totalQuestions', result.total_questions,
    'correctAnswers', result.correct_answers,
    'percentage', result.score,
    'pointsEarned', result.points_earned,
    'completedAt', result.completed_at,
    'answers', answer_results
  );
exception
  when unique_violation then
    if p_client_attempt_id is not null then
      select qa.* into result
      from public.quiz_attempts qa
      where qa.team_id = p_team_id
        and qa.player_id = current_player_id
        and qa.client_attempt_id = p_client_attempt_id;

      if found then
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'questionId', a.question_id,
              'selectedChoiceId', a.selected_choice_id,
              'isCorrect', a.is_correct,
              'feedback', a.feedback
            ) order by q.position
          ),
          '[]'::jsonb
        ) into answer_results
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        where a.attempt_id = result.id;

        return jsonb_build_object(
          'attemptId', result.id,
          'attemptNumber', result.attempt_number,
          'totalQuestions', result.total_questions,
          'correctAnswers', result.correct_answers,
          'percentage', result.score,
          'pointsEarned', result.points_earned,
          'completedAt', result.completed_at,
          'answers', answer_results
        );
      end if;
    end if;
    raise;
end;
$$;

revoke all privileges on table private.lesson_video_requirements
  from public, anon, authenticated;
grant all privileges on table private.lesson_video_requirements to service_role;

revoke execute on function private.has_completed_required_videos(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.has_completed_required_videos(uuid, uuid, text)
  to service_role;

-- CREATE OR REPLACE preserves the established authenticated grants on public
-- RPCs and the quiz-question RLS helper. Reassert the intended access here.
revoke execute on function private.can_read_quiz_question(text)
  from public, anon;
grant execute on function private.can_read_quiz_question(text) to authenticated;

revoke execute on function public.record_video_checkpoint(uuid, text, text, smallint, smallint, numeric)
  from public, anon, service_role;
revoke execute on function public.submit_quiz(uuid, text, jsonb, uuid)
  from public, anon, service_role;
revoke execute on function public.complete_lesson(uuid, text)
  from public, anon, service_role;

grant execute on function public.record_video_checkpoint(uuid, text, text, smallint, smallint, numeric)
  to authenticated;
grant execute on function public.submit_quiz(uuid, text, jsonb, uuid)
  to authenticated;
grant execute on function public.complete_lesson(uuid, text) to authenticated;

commit;

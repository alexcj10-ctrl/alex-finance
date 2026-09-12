-- Repair RPC-local identifiers on databases that already applied 202609120001.
-- CREATE OR REPLACE preserves the existing function identities and grants.

create or replace function public.record_login(p_team_id uuid)
returns public.activity_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_player_id uuid := auth.uid();
  login_bucket text;
  result public.activity_events%rowtype;
begin
  if current_player_id is null
     or not private.is_active_member_as(p_team_id, current_player_id, 'player') then
    raise exception 'active player membership required' using errcode = '42501';
  end if;

  login_bucket := 'login:' || floor(extract(epoch from now()) / 900)::bigint::text;

  insert into public.activity_events (
    team_id, player_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id, current_player_id, 'login', '{}'::jsonb, login_bucket
  )
  on conflict (team_id, player_id, dedupe_key)
    where dedupe_key is not null
    do nothing
  returning * into result;

  if result.id is null then
    select ae.* into result
    from public.activity_events ae
    where ae.team_id = p_team_id
      and ae.player_id = current_player_id
      and ae.dedupe_key = login_bucket;
  end if;

  return result;
end;
$$;

create or replace function public.start_lesson(
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
  assignment_time timestamptz;
  result public.lesson_progress%rowtype;
begin
  if current_player_id is null
     or not private.player_has_active_assignment(p_team_id, current_player_id, p_lesson_id) then
    raise exception 'active lesson assignment required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from private.lesson_rules lr
    where lr.lesson_id = p_lesson_id and lr.active
  ) then
    raise exception 'unknown or inactive lesson' using errcode = '22023';
  end if;

  select min(la.assigned_at) into assignment_time
  from public.lesson_assignments la
  where la.team_id = p_team_id
    and la.lesson_id = p_lesson_id
    and la.active
    and (la.player_id is null or la.player_id = current_player_id);

  insert into public.lesson_progress (
    team_id, player_id, lesson_id, status, progress_percent, assigned_at
  ) values (
    p_team_id, current_player_id, p_lesson_id, 'da_fare', 0, assignment_time
  )
  on conflict (team_id, player_id, lesson_id) do nothing;

  select lp.* into result
  from public.lesson_progress lp
  where lp.team_id = p_team_id
    and lp.player_id = current_player_id
    and lp.lesson_id = p_lesson_id
  for update;

  if result.status = 'da_fare' then
    update public.lesson_progress lp
    set status = 'in_corso', progress_percent = greatest(lp.progress_percent, 1)
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
      'lesson_started',
      '{}'::jsonb,
      'lesson_started:' || p_lesson_id
    )
    on conflict (team_id, player_id, dedupe_key)
      where dedupe_key is not null
      do nothing;
  end if;

  return result;
end;
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
    p_watched_percent,
    p_last_position_seconds,
    p_checkpoint,
    p_checkpoint = 100
  )
  on conflict (team_id, player_id, lesson_id, variant_id) do update
  set watched_percent = greatest(
        public.video_progress.watched_percent,
        excluded.watched_percent
      ),
      last_position_seconds = excluded.last_position_seconds,
      last_checkpoint = greatest(
        public.video_progress.last_checkpoint,
        excluded.last_checkpoint
      ),
      completed = public.video_progress.completed or excluded.completed
  returning * into result;

  update public.lesson_progress lp
  set progress_percent = greatest(
        lp.progress_percent,
        least(p_watched_percent, 99)
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
  best_video smallint;
  best_quiz numeric;
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

  select coalesce(max(vp.watched_percent), 0)::smallint into best_video
  from public.video_progress vp
  where vp.team_id = p_team_id
    and vp.player_id = current_player_id
    and vp.lesson_id = p_lesson_id;

  if best_video < rule.minimum_video_percent then
    raise exception 'required video progress not reached' using errcode = '22023';
  end if;

  if rule.minimum_quiz_percent is not null then
    select max(qa.score) into best_quiz
    from public.quiz_attempts qa
    where qa.team_id = p_team_id
      and qa.player_id = current_player_id
      and qa.lesson_id = p_lesson_id;

    if best_quiz is null or best_quiz < rule.minimum_quiz_percent then
      raise exception 'required quiz score not reached' using errcode = '22023';
    end if;
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

create or replace function public.import_local_progress(
  p_team_id uuid,
  p_lessons jsonb,
  p_videos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_player_id uuid := auth.uid();
  lesson_item jsonb;
  video_item jsonb;
  current_lesson_id text;
  current_variant_id text;
  watched_percent smallint;
  checkpoint smallint;
  last_position numeric;
  lessons_started integer := 0;
  lessons_completed integer := 0;
  videos_imported integer := 0;
  skipped integer := 0;
  imported_at timestamptz;
begin
  if current_player_id is null
     or not private.is_active_member_as(p_team_id, current_player_id, 'player') then
    raise exception 'active player membership required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lessons) <> 'array'
     or jsonb_typeof(p_videos) <> 'array'
     or jsonb_array_length(p_lessons) > 100
     or jsonb_array_length(p_videos) > 200
     or octet_length(p_lessons::text) + octet_length(p_videos::text) > 131072 then
    raise exception 'invalid or oversized local progress payload' using errcode = '22023';
  end if;

  select p.local_progress_imported_at into imported_at
  from public.profiles p
  where p.id = current_player_id
  for update;

  if imported_at is not null then
    return jsonb_build_object(
      'status', 'already_imported',
      'importedAt', imported_at,
      'lessonsStarted', 0,
      'lessonsCompleted', 0,
      'videosImported', 0,
      'skipped', 0
    );
  end if;

  for lesson_item in select value from jsonb_array_elements(p_lessons)
  loop
    current_lesson_id := lesson_item ->> 'lessonId';
    if jsonb_typeof(lesson_item) <> 'object'
       or current_lesson_id is null
       or not private.player_has_active_assignment(p_team_id, current_player_id, current_lesson_id)
       or not exists (
         select 1 from private.lesson_rules lr
         where lr.lesson_id = current_lesson_id and lr.active
       ) then
      skipped := skipped + 1;
      continue;
    end if;

    perform public.start_lesson(p_team_id, current_lesson_id);
    lessons_started := lessons_started + 1;
  end loop;

  for video_item in select value from jsonb_array_elements(p_videos)
  loop
    if jsonb_typeof(video_item) <> 'object' then
      skipped := skipped + 1;
      continue;
    end if;

    current_lesson_id := video_item ->> 'lessonId';
    current_variant_id := video_item ->> 'variantId';

    begin
      watched_percent := (video_item ->> 'watchedPercent')::smallint;
      last_position := coalesce((video_item ->> 'lastPositionSeconds')::numeric, 0);
    exception when invalid_text_representation or numeric_value_out_of_range then
      skipped := skipped + 1;
      continue;
    end;

    if current_lesson_id is null
       or current_variant_id is null
       or watched_percent not between 0 and 100
       or last_position not between 0 and 86400
       or not private.player_has_active_assignment(p_team_id, current_player_id, current_lesson_id)
       or not exists (
         select 1 from private.lesson_rules lr
         where lr.lesson_id = current_lesson_id and lr.active
       ) then
      skipped := skipped + 1;
      continue;
    end if;

    checkpoint := case
      when coalesce((video_item ->> 'completed')::boolean, false) or watched_percent = 100 then 100
      when watched_percent >= 75 then 75
      when watched_percent >= 50 then 50
      when watched_percent >= 25 then 25
      else 0
    end;
    if checkpoint = 100 then
      watched_percent := 100;
    end if;

    perform public.record_video_checkpoint(
      p_team_id,
      current_lesson_id,
      current_variant_id,
      checkpoint,
      watched_percent,
      last_position
    );
    videos_imported := videos_imported + 1;
  end loop;

  for lesson_item in select value from jsonb_array_elements(p_lessons)
  loop
    current_lesson_id := lesson_item ->> 'lessonId';
    if jsonb_typeof(lesson_item) <> 'object'
       or current_lesson_id is null
       or nullif(lesson_item ->> 'completedAt', '') is null
       or not private.player_has_active_assignment(p_team_id, current_player_id, current_lesson_id) then
      continue;
    end if;

    begin
      perform public.complete_lesson(p_team_id, current_lesson_id);
      lessons_completed := lessons_completed + 1;
    exception when invalid_parameter_value then
      skipped := skipped + 1;
    end;
  end loop;

  update public.profiles p
  set local_progress_imported_at = now()
  where p.id = current_player_id
  returning p.local_progress_imported_at into imported_at;

  return jsonb_build_object(
    'status', 'imported',
    'importedAt', imported_at,
    'lessonsStarted', lessons_started,
    'lessonsCompleted', lessons_completed,
    'videosImported', videos_imported,
    'skipped', skipped
  );
end;
$$;

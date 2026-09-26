begin;

alter table private.lesson_video_requirements
  add column duration_seconds numeric(10, 3);

update private.lesson_video_requirements
set duration_seconds = case
  when lesson_id = 'costruzione-creare-ampiezza'
    and variant_id in ('variante-a', 'variante-b') then 6
  when lesson_id = 'costruzione-attira-uomo-libero'
    and variant_id = 'terzo-uomo-dx' then 18
  when lesson_id = 'pressione-alta-chiudi-centro-porta-fuori'
    and variant_id in ('pressione-alta-dx', 'pressione-alta-sx') then 10
end;

alter table private.lesson_video_requirements
  alter column duration_seconds set not null,
  add constraint lesson_video_requirements_duration_check
    check (duration_seconds > 0 and duration_seconds <= 86400);

-- Transaction timestamps do not advance during pg_sleep or between RPC calls
-- made in one transaction. Store wall-clock time so checkpoint spacing can be
-- enforced correctly and duplicate requests cannot reset the timer.
create or replace function private.prepare_video_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.watched_percent < old.watched_percent then
      raise exception 'watched percent cannot decrease';
    end if;

    if new.last_checkpoint < old.last_checkpoint then
      raise exception 'video checkpoint cannot decrease';
    end if;

    if old.completed and not new.completed then
      raise exception 'completed video cannot be reopened';
    end if;
  end if;

  new.updated_at := clock_timestamp();
  return new;
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
  video_duration_seconds numeric(10, 3);
  minimum_interval_seconds numeric;
  normalized_percent smallint;
  result public.video_progress%rowtype;
begin
  if p_variant_id is null
     or p_variant_id !~ '^[a-z0-9][a-z0-9-]{0,127}$'
     or p_checkpoint is null
     or p_checkpoint not in (0, 25, 50, 75, 100)
     or p_watched_percent is null
     or p_watched_percent not between p_checkpoint and 100
     or p_last_position_seconds is null
     or p_last_position_seconds not between 0 and 86400 then
    raise exception 'invalid video checkpoint payload' using errcode = '22023';
  end if;

  perform public.start_lesson(p_team_id, p_lesson_id);

  select required_video.duration_seconds
  into video_duration_seconds
  from private.lesson_video_requirements required_video
  where required_video.lesson_id = p_lesson_id
    and required_video.variant_id = p_variant_id
    and required_video.active;

  if not found then
    raise exception 'video variant is not required for this lesson'
      using errcode = '22023';
  end if;

  select progress.* into result
  from public.video_progress progress
  where progress.team_id = p_team_id
    and progress.player_id = current_player_id
    and progress.lesson_id = p_lesson_id
    and progress.variant_id = p_variant_id
  for update;

  if found then
    -- Retries and stale duplicate deliveries are idempotent. In particular,
    -- they do not update updated_at and therefore cannot postpone the next
    -- legitimate checkpoint.
    if p_checkpoint <= result.last_checkpoint then
      return result;
    end if;

    if p_checkpoint <> result.last_checkpoint + 25 then
      raise exception 'video checkpoints must be recorded in order'
        using errcode = '22023';
    end if;

    -- Each checkpoint represents 25% of the video. Require 80% of that
    -- nominal playback time, allowing 20% slack for timers and delivery lag.
    minimum_interval_seconds := video_duration_seconds * 0.20;

    if clock_timestamp() < result.updated_at
        + make_interval(secs => minimum_interval_seconds::double precision) then
      raise exception 'video checkpoint advanced too quickly'
        using errcode = '22023';
    end if;
  elsif p_checkpoint <> 0 then
    raise exception 'video checkpoints must start at zero'
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
      last_position_seconds = excluded.last_position_seconds,
      last_checkpoint = excluded.last_checkpoint,
      completed = excluded.completed
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

revoke all privileges on table private.lesson_video_requirements
  from public, anon, authenticated;
grant all privileges on table private.lesson_video_requirements to service_role;

revoke execute on function private.prepare_video_progress()
  from public, anon, authenticated;

revoke execute on function public.record_video_checkpoint(uuid, text, text, smallint, smallint, numeric)
  from public, anon, service_role;
grant execute on function public.record_video_checkpoint(uuid, text, text, smallint, smallint, numeric)
  to authenticated;

commit;

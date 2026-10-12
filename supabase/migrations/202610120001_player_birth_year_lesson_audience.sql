begin;

alter table public.profiles
  add column if not exists birth_year smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_birth_year_check'
  ) then
    alter table public.profiles
      add constraint profiles_birth_year_check check (
        birth_year is null or birth_year in (2014, 2015)
      );
  end if;
end;
$$;

alter table private.lesson_rules
  add column if not exists eligible_birth_years smallint[]
    default array[2014, 2015]::smallint[];

update private.lesson_rules
set eligible_birth_years = array[2014, 2015]::smallint[]
where eligible_birth_years is null;

alter table private.lesson_rules
  alter column eligible_birth_years
    set default array[2014, 2015]::smallint[],
  alter column eligible_birth_years set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.lesson_rules'::regclass
      and conname = 'lesson_rules_eligible_birth_years_check'
  ) then
    alter table private.lesson_rules
      add constraint lesson_rules_eligible_birth_years_check check (
        eligible_birth_years = array[2014]::smallint[]
        or eligible_birth_years = array[2015]::smallint[]
        or eligible_birth_years = array[2014, 2015]::smallint[]
      );
  end if;
end;
$$;

create or replace function private.player_is_eligible_for_lesson(
  p_player_id uuid,
  p_lesson_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join private.lesson_rules lr on lr.lesson_id = p_lesson_id
    where p.id = p_player_id
      and p.role = 'player'
      and p.account_active
      and lr.active
      and (
        p.birth_year is null
        or p.birth_year = any(lr.eligible_birth_years)
      )
  );
$$;

create or replace function private.player_has_active_assignment(
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
    private.is_active_member_as(p_team_id, p_player_id, 'player')
    and private.player_is_eligible_for_lesson(p_player_id, p_lesson_id)
    and exists (
      select 1
      from public.lesson_assignments la
      where la.team_id = p_team_id
        and la.lesson_id = p_lesson_id
        and la.active
        and (la.player_id is null or la.player_id = p_player_id)
    );
$$;

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
          and private.player_has_active_assignment(
            tm.team_id,
            tm.profile_id,
            p_lesson_id
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

-- Keep the historical six-argument provisioning contract for autonomous
-- signup, where no group is collected and NULL retains legacy access.
create or replace function public.provision_player_profile(
  p_user_id uuid,
  p_display_name text,
  p_player_code text,
  p_team_id uuid,
  p_active boolean,
  p_coach_id uuid,
  p_birth_year smallint
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(btrim(p_player_code));
  result public.profiles%rowtype;
  inserted_player record;
begin
  if p_display_name is null
     or char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  if normalized_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'invalid player code' using errcode = '22023';
  end if;

  if p_birth_year is not null and p_birth_year not in (2014, 2015) then
    raise exception 'invalid player birth year' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'auth user does not exist' using errcode = '23503';
  end if;

  if not private.is_coach_admin(p_team_id, p_coach_id) then
    raise exception 'coach administrator is required for this team'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'coach'
  ) then
    raise exception 'cannot provision a coach as player' using errcode = '22023';
  end if;

  insert into public.profiles (
    id, display_name, role, player_code, birth_year, account_active
  ) values (
    p_user_id,
    btrim(p_display_name),
    'player',
    normalized_code,
    p_birth_year,
    p_active
  )
  on conflict (id) do update
  set display_name = excluded.display_name,
      player_code = excluded.player_code,
      birth_year = excluded.birth_year,
      account_active = excluded.account_active
  returning * into result;

  insert into public.team_members (
    team_id, profile_id, role, active, coach_access_level
  ) values (
    p_team_id, p_user_id, 'player', p_active, null
  )
  on conflict (team_id, profile_id) do update
  set role = 'player',
      active = excluded.active,
      coach_access_level = null;

  if p_active then
    for inserted_player in
      with assigned as (
        select la.lesson_id, min(la.assigned_at) as assigned_at
        from public.lesson_assignments la
        where la.team_id = p_team_id
          and la.active
          and (la.player_id is null or la.player_id = p_user_id)
          and private.player_is_eligible_for_lesson(
            p_user_id,
            la.lesson_id
          )
        group by la.lesson_id
      ), inserted as (
        insert into public.lesson_progress (
          team_id, player_id, lesson_id, status, progress_percent, assigned_at
        )
        select
          p_team_id,
          p_user_id,
          assigned.lesson_id,
          'da_fare',
          0,
          assigned.assigned_at
        from assigned
        on conflict (team_id, player_id, lesson_id) do nothing
        returning lesson_id
      )
      select lesson_id from inserted
    loop
      insert into public.activity_events (
        team_id, player_id, lesson_id, event_type, metadata, dedupe_key
      ) values (
        p_team_id,
        p_user_id,
        inserted_player.lesson_id,
        'lesson_assigned',
        jsonb_build_object('scope', 'team'),
        'lesson_assigned:' || inserted_player.lesson_id
      )
      on conflict (team_id, player_id, dedupe_key)
        where dedupe_key is not null
        do nothing;
    end loop;
  end if;

  return result;
end;
$$;

create or replace function public.provision_player_profile(
  p_user_id uuid,
  p_display_name text,
  p_player_code text,
  p_team_id uuid,
  p_active boolean,
  p_coach_id uuid
)
returns public.profiles
language sql
security definer
set search_path = ''
as $$
  select public.provision_player_profile(
    p_user_id,
    p_display_name,
    p_player_code,
    p_team_id,
    p_active,
    p_coach_id,
    null::smallint
  );
$$;

create or replace function public.set_player_birth_year(
  p_team_id uuid,
  p_player_id uuid,
  p_birth_year smallint,
  p_coach_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles%rowtype;
  materialized record;
begin
  if p_birth_year is null or p_birth_year not in (2014, 2015) then
    raise exception 'invalid player birth year' using errcode = '22023';
  end if;

  if not private.is_coach_admin(p_team_id, p_coach_id) then
    raise exception 'coach administrator is required for this team'
      using errcode = '42501';
  end if;

  if not private.is_active_member_as(p_team_id, p_player_id, 'player') then
    raise exception 'player is not active in this team' using errcode = '22023';
  end if;

  update public.profiles p
  set birth_year = p_birth_year
  where p.id = p_player_id
    and p.role = 'player'
  returning p.* into result;

  if not found then
    raise exception 'player profile not found' using errcode = '22023';
  end if;

  for materialized in
    with assigned as (
      select la.lesson_id, min(la.assigned_at) as assigned_at
      from public.lesson_assignments la
      where la.team_id = p_team_id
        and la.active
        and (la.player_id is null or la.player_id = p_player_id)
        and private.player_is_eligible_for_lesson(
          p_player_id,
          la.lesson_id
        )
      group by la.lesson_id
    ), inserted as (
      insert into public.lesson_progress (
        team_id, player_id, lesson_id, status, progress_percent, assigned_at
      )
      select
        p_team_id,
        p_player_id,
        assigned.lesson_id,
        'da_fare',
        0,
        assigned.assigned_at
      from assigned
      on conflict (team_id, player_id, lesson_id) do nothing
      returning lesson_id
    )
    select lesson_id from inserted
  loop
    insert into public.activity_events (
      team_id, player_id, lesson_id, event_type, metadata, dedupe_key
    ) values (
      p_team_id,
      p_player_id,
      materialized.lesson_id,
      'lesson_assigned',
      jsonb_build_object('scope', 'group_update'),
      'lesson_assigned:' || materialized.lesson_id
    )
    on conflict (team_id, player_id, dedupe_key)
      where dedupe_key is not null
      do nothing;
  end loop;

  return result;
end;
$$;

create or replace function public.assign_lesson(
  p_team_id uuid,
  p_lesson_id text,
  p_player_id uuid default null,
  p_due_at timestamptz default null
)
returns public.lesson_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  coach_id uuid := auth.uid();
  result public.lesson_assignments%rowtype;
  materialized record;
begin
  if coach_id is null
     or not private.is_coach_admin(p_team_id, coach_id) then
    raise exception 'coach administrator is required for this team'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from private.lesson_rules lr
    where lr.lesson_id = p_lesson_id and lr.active
  ) then
    raise exception 'unknown or inactive lesson' using errcode = '22023';
  end if;

  if p_due_at is not null and p_due_at < now() then
    raise exception 'due date cannot be in the past' using errcode = '22023';
  end if;

  if p_player_id is not null
     and not private.is_active_member_as(p_team_id, p_player_id, 'player') then
    raise exception 'player is not active in this team' using errcode = '22023';
  end if;

  if p_player_id is not null
     and not private.player_is_eligible_for_lesson(p_player_id, p_lesson_id) then
    raise exception 'player is not eligible for this lesson'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_team_id::text || ':' || p_lesson_id || ':' || coalesce(p_player_id::text, 'team'),
      0
    )
  );

  select la.* into result
  from public.lesson_assignments la
  where la.team_id = p_team_id
    and la.lesson_id = p_lesson_id
    and la.active
    and la.player_id is not distinct from p_player_id
  for update;

  if found then
    update public.lesson_assignments la
    set due_at = p_due_at
    where la.id = result.id
    returning la.* into result;
  else
    insert into public.lesson_assignments (
      lesson_id, team_id, player_id, assigned_by, due_at, active
    ) values (
      p_lesson_id, p_team_id, p_player_id, coach_id, p_due_at, true
    )
    returning * into result;
  end if;

  for materialized in
    with candidates as (
      select tm.profile_id as player_id
      from public.team_members tm
      join public.profiles p on p.id = tm.profile_id
      where tm.team_id = p_team_id
        and tm.role = 'player'
        and tm.active
        and p.role = 'player'
        and p.account_active
        and (p_player_id is null or tm.profile_id = p_player_id)
        and private.player_is_eligible_for_lesson(
          tm.profile_id,
          p_lesson_id
        )
    ), inserted as (
      insert into public.lesson_progress (
        team_id, player_id, lesson_id, status, progress_percent, assigned_at
      )
      select p_team_id, c.player_id, p_lesson_id, 'da_fare', 0, result.assigned_at
      from candidates c
      on conflict (team_id, player_id, lesson_id) do nothing
      returning player_id
    )
    select player_id from inserted
  loop
    insert into public.activity_events (
      team_id, player_id, lesson_id, event_type, metadata, dedupe_key
    ) values (
      p_team_id,
      materialized.player_id,
      p_lesson_id,
      'lesson_assigned',
      jsonb_build_object(
        'scope', case when p_player_id is null then 'team' else 'player' end,
        'assignmentId', result.id
      ),
      'lesson_assigned:' || p_lesson_id
    )
    on conflict (team_id, player_id, dedupe_key)
      where dedupe_key is not null
      do nothing;
  end loop;

  return result;
end;
$$;

create or replace function public.set_lesson_assignment_active(
  p_assignment_id uuid,
  p_active boolean
)
returns public.lesson_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  coach_id uuid := auth.uid();
  result public.lesson_assignments%rowtype;
  materialized record;
begin
  select la.* into result
  from public.lesson_assignments la
  where la.id = p_assignment_id
  for update;

  if not found
     or coach_id is null
     or not private.is_coach_admin(result.team_id, coach_id) then
    raise exception 'assignment not found or coach administrator required'
      using errcode = '42501';
  end if;

  if p_active
     and result.player_id is not null
     and not private.player_is_eligible_for_lesson(
       result.player_id,
       result.lesson_id
     ) then
    raise exception 'player is not eligible for this lesson'
      using errcode = '22023';
  end if;

  update public.lesson_assignments la
  set active = p_active
  where la.id = p_assignment_id
  returning la.* into result;

  if p_active then
    for materialized in
      with candidates as (
        select tm.profile_id as player_id
        from public.team_members tm
        join public.profiles p on p.id = tm.profile_id
        where tm.team_id = result.team_id
          and tm.role = 'player'
          and tm.active
          and p.role = 'player'
          and p.account_active
          and (result.player_id is null or tm.profile_id = result.player_id)
          and private.player_is_eligible_for_lesson(
            tm.profile_id,
            result.lesson_id
          )
      ), inserted as (
        insert into public.lesson_progress (
          team_id, player_id, lesson_id, status, progress_percent, assigned_at
        )
        select
          result.team_id,
          c.player_id,
          result.lesson_id,
          'da_fare',
          0,
          result.assigned_at
        from candidates c
        on conflict (team_id, player_id, lesson_id) do nothing
        returning player_id
      )
      select player_id from inserted
    loop
      insert into public.activity_events (
        team_id, player_id, lesson_id, event_type, metadata, dedupe_key
      ) values (
        result.team_id,
        materialized.player_id,
        result.lesson_id,
        'lesson_assigned',
        jsonb_build_object('assignmentId', result.id),
        'lesson_assigned:' || result.lesson_id
      )
      on conflict (team_id, player_id, dedupe_key)
        where dedupe_key is not null
        do nothing;
    end loop;
  end if;

  return result;
end;
$$;

create or replace function public.list_lesson_audiences(p_team_id uuid)
returns table (
  lesson_id text,
  eligible_birth_years smallint[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.is_active_member_as(p_team_id, auth.uid(), 'coach') then
    raise exception 'coach access required for this team'
      using errcode = '42501';
  end if;

  return query
    select lr.lesson_id, lr.eligible_birth_years
    from private.lesson_rules lr
    where lr.active
    order by lr.lesson_id;
end;
$$;

drop policy if exists lesson_assignments_read_own_or_coach
  on public.lesson_assignments;
create policy lesson_assignments_read_own_or_coach
on public.lesson_assignments for select to authenticated
using (
  private.is_active_member_as(team_id, (select auth.uid()), 'coach')
  or (
    active
    and (player_id is null or player_id = (select auth.uid()))
    and private.is_active_member_as(team_id, (select auth.uid()), 'player')
    and private.player_is_eligible_for_lesson(
      (select auth.uid()),
      lesson_id
    )
  )
);

drop policy if exists lesson_progress_read_own_or_coach
  on public.lesson_progress;
create policy lesson_progress_read_own_or_coach
on public.lesson_progress for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
    and private.player_is_eligible_for_lesson(player_id, lesson_id)
  )
  or private.can_coach_player(team_id, player_id)
);

drop policy if exists video_progress_read_own_or_coach
  on public.video_progress;
create policy video_progress_read_own_or_coach
on public.video_progress for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
    and private.player_is_eligible_for_lesson(player_id, lesson_id)
  )
  or private.can_coach_player(team_id, player_id)
);

drop policy if exists quiz_attempts_read_own_or_coach
  on public.quiz_attempts;
create policy quiz_attempts_read_own_or_coach
on public.quiz_attempts for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
    and private.player_is_eligible_for_lesson(player_id, lesson_id)
  )
  or private.can_coach_player(team_id, player_id)
);

drop policy if exists quiz_answers_read_own_or_coach
  on public.quiz_answers;
create policy quiz_answers_read_own_or_coach
on public.quiz_answers for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
    and private.player_is_eligible_for_lesson(player_id, lesson_id)
  )
  or private.can_coach_player(team_id, player_id)
);

drop policy if exists activity_events_read_own_or_coach
  on public.activity_events;
create policy activity_events_read_own_or_coach
on public.activity_events for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
    and (
      lesson_id is null
      or private.player_is_eligible_for_lesson(player_id, lesson_id)
    )
  )
  or private.can_coach_player(team_id, player_id)
);

revoke execute on function private.player_is_eligible_for_lesson(uuid, text)
  from public, anon;
grant execute on function private.player_is_eligible_for_lesson(uuid, text)
  to authenticated, service_role;

revoke all on function public.provision_player_profile(
  uuid, text, text, uuid, boolean, uuid, smallint
) from public, anon, authenticated;
grant execute on function public.provision_player_profile(
  uuid, text, text, uuid, boolean, uuid, smallint
) to service_role;

revoke all on function public.provision_player_profile(
  uuid, text, text, uuid, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.provision_player_profile(
  uuid, text, text, uuid, boolean, uuid
) to service_role;

revoke all on function public.set_player_birth_year(
  uuid, uuid, smallint, uuid
) from public, anon, authenticated;
grant execute on function public.set_player_birth_year(
  uuid, uuid, smallint, uuid
) to service_role;

revoke execute on function public.list_lesson_audiences(uuid)
  from public, anon, service_role;
grant execute on function public.list_lesson_audiences(uuid)
  to authenticated;

commit;

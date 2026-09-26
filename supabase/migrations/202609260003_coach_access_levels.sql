begin;

-- Coach memberships are explicitly classified as full administrators or
-- read-only observers. Player memberships never carry a Coach access level.
alter table public.team_members
  add column if not exists coach_access_level text;

update public.team_members
set coach_access_level = null
where role = 'player';

-- Safe default for every existing Coach: read-only. The only Production
-- administrator is promoted by the real auth/profile UUID, never by a name or
-- an email address that could be changed or duplicated.
update public.team_members
set coach_access_level = 'viewer'
where role = 'coach';

update public.team_members
set coach_access_level = 'admin'
where role = 'coach'
  and profile_id = '7e87c4e1-e5ca-4ca3-a602-e01f74e8650d';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_members'::regclass
      and conname = 'team_members_coach_access_level_check'
  ) then
    alter table public.team_members
      add constraint team_members_coach_access_level_check check (
        (
          role = 'coach'
          and coach_access_level is not null
          and coach_access_level in ('admin', 'viewer')
        )
        or (
          role = 'player'
          and coach_access_level is null
        )
      );
  end if;
end;
$$;

create index if not exists team_members_active_coach_access_idx
  on public.team_members(team_id, coach_access_level, profile_id)
  where role = 'coach' and active;

create or replace function private.is_coach_admin(
  p_team_id uuid,
  p_profile_id uuid
)
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
    where tm.team_id = p_team_id
      and tm.profile_id = p_profile_id
      and tm.role = 'coach'
      and tm.coach_access_level = 'admin'
      and tm.active
      and p.role = 'coach'
      and p.account_active
  );
$$;

revoke all on function private.is_coach_admin(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.is_coach_admin(uuid, uuid)
  to authenticated, service_role;

-- A Player may still edit the two granted fields on their own active profile.
-- A Coach observer cannot update even their own profile; an administrator can.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  and account_active
  and (
    role = 'player'
    or (
      role = 'coach'
      and exists (
        select 1
        from public.team_members tm
        where tm.profile_id = (select auth.uid())
          and private.is_coach_admin(tm.team_id, tm.profile_id)
      )
    )
  )
)
with check (
  id = (select auth.uid())
  and account_active
  and (
    role = 'player'
    or (
      role = 'coach'
      and exists (
        select 1
        from public.team_members tm
        where tm.profile_id = (select auth.uid())
          and private.is_coach_admin(tm.team_id, tm.profile_id)
      )
    )
  )
);

-- This function is called only by the trusted server role, but the nominated
-- Coach must still be an active administrator of the target team.
create or replace function public.provision_player_profile(
  p_user_id uuid,
  p_display_name text,
  p_player_code text,
  p_team_id uuid,
  p_active boolean,
  p_coach_id uuid
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
    id, display_name, role, player_code, account_active
  ) values (
    p_user_id, btrim(p_display_name), 'player', normalized_code, p_active
  )
  on conflict (id) do update
  set display_name = excluded.display_name,
      player_code = excluded.player_code,
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
      with inserted as (
        insert into public.lesson_progress (
          team_id, player_id, lesson_id, status, progress_percent, assigned_at
        )
        select
          la.team_id,
          p_user_id,
          la.lesson_id,
          'da_fare',
          0,
          la.assigned_at
        from public.lesson_assignments la
        where la.team_id = p_team_id
          and la.player_id is null
          and la.active
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

revoke all on function public.provision_player_profile(
  uuid, text, text, uuid, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.provision_player_profile(
  uuid, text, text, uuid, boolean, uuid
) to service_role;

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

commit;

begin;

create or replace function public.set_lesson_audience(
  p_team_id uuid,
  p_lesson_id text,
  p_eligible_birth_years smallint[],
  p_coach_id uuid
)
returns table (
  lesson_id text,
  eligible_birth_years smallint[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rule record;
  materialized record;
begin
  if p_eligible_birth_years is null
     or not (
       p_eligible_birth_years = array[2014]::smallint[]
       or p_eligible_birth_years = array[2015]::smallint[]
       or p_eligible_birth_years = array[2014, 2015]::smallint[]
     ) then
    raise exception 'invalid lesson audience' using errcode = '22023';
  end if;

  if not private.is_coach_admin(p_team_id, p_coach_id) then
    raise exception 'coach administrator is required for this team'
      using errcode = '42501';
  end if;

  update private.lesson_rules lr
  set eligible_birth_years = p_eligible_birth_years
  where lr.lesson_id = p_lesson_id
    and lr.active
  returning lr.lesson_id, lr.eligible_birth_years into changed_rule;

  if not found then
    raise exception 'unknown or inactive lesson' using errcode = '22023';
  end if;

  for materialized in
    with candidates as (
      select
        tm.profile_id as player_id,
        min(la.assigned_at) as assigned_at
      from public.team_members tm
      join public.profiles p on p.id = tm.profile_id
      join public.lesson_assignments la
        on la.team_id = tm.team_id
       and la.lesson_id = p_lesson_id
       and la.active
       and (la.player_id is null or la.player_id = tm.profile_id)
      where tm.team_id = p_team_id
        and tm.role = 'player'
        and tm.active
        and p.role = 'player'
        and p.account_active
        and private.player_is_eligible_for_lesson(
          tm.profile_id,
          p_lesson_id
        )
      group by tm.profile_id
    ), inserted as (
      insert into public.lesson_progress (
        team_id, player_id, lesson_id, status, progress_percent, assigned_at
      )
      select
        p_team_id,
        candidates.player_id,
        p_lesson_id,
        'da_fare',
        0,
        candidates.assigned_at
      from candidates
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
      jsonb_build_object('scope', 'audience_update'),
      'lesson_assigned:' || p_lesson_id
    )
    on conflict (team_id, player_id, dedupe_key)
      where dedupe_key is not null
      do nothing;
  end loop;

  return query
    select changed_rule.lesson_id, changed_rule.eligible_birth_years;
end;
$$;

revoke all on function public.set_lesson_audience(
  uuid, text, smallint[], uuid
) from public, anon, authenticated;
grant execute on function public.set_lesson_audience(
  uuid, text, smallint[], uuid
) to service_role;

commit;

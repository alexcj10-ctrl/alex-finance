-- Supabase publishable/secret keys are not JWTs. Access to this SECURITY
-- DEFINER function is restricted by explicit grants, so a legacy JWT claim is
-- not a reliable way to identify a request made with a server-side secret key.

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

  if not exists (
    select 1
    from public.team_members tm
    join public.profiles p on p.id = tm.profile_id
    where tm.team_id = p_team_id
      and tm.profile_id = p_coach_id
      and tm.role = 'coach'
      and tm.active
      and p.role = 'coach'
      and p.account_active
  ) then
    raise exception 'coach is not authorized for this team' using errcode = '42501';
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

  insert into public.team_members (team_id, profile_id, role, active)
  values (p_team_id, p_user_id, 'player', p_active)
  on conflict (team_id, profile_id) do update
  set role = 'player', active = excluded.active;

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

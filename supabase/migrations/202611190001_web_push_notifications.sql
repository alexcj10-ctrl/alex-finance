begin;

-- Browser push credentials are sensitive infrastructure data. They live in the
-- private schema, are protected by forced RLS, and are reachable only through
-- the service-role RPCs defined below.
create table if not exists private.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  player_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, player_id)
    references public.team_members(team_id, profile_id) on delete cascade,
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_check check (
    endpoint = btrim(endpoint)
    and endpoint ~ '^https://'
    and char_length(endpoint) between 1 and 4096
  ),
  constraint push_subscriptions_p256dh_check check (
    p256dh = btrim(p256dh)
    and char_length(p256dh) between 1 and 1024
  ),
  constraint push_subscriptions_auth_key_check check (
    auth_key = btrim(auth_key)
    and char_length(auth_key) between 1 and 1024
  )
);

create index if not exists push_subscriptions_team_active_idx
  on private.push_subscriptions(team_id, active, player_id);
create index if not exists push_subscriptions_player_active_idx
  on private.push_subscriptions(player_id, active, updated_at desc);

alter table private.push_subscriptions enable row level security;
alter table private.push_subscriptions force row level security;

create table if not exists private.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  assignment_id uuid not null
    references public.lesson_assignments(id) on delete cascade,
  event_kind text not null,
  created_at timestamptz not null default now(),
  constraint push_notification_events_kind_check check (
    event_kind = 'lesson_assigned'
  ),
  constraint push_notification_events_unique
    unique (team_id, assignment_id, event_kind)
);

create index if not exists push_notification_events_team_created_idx
  on private.push_notification_events(team_id, created_at desc);

alter table private.push_notification_events enable row level security;
alter table private.push_notification_events force row level security;

revoke all on table private.push_subscriptions
  from public, anon, authenticated;
revoke all on table private.push_notification_events
  from public, anon, authenticated;
grant select, insert, update, delete on table private.push_subscriptions
  to service_role;
grant select, insert, update, delete on table private.push_notification_events
  to service_role;

create or replace function public.upsert_push_subscription(
  p_team_id uuid,
  p_player_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  normalized_endpoint text := btrim(p_endpoint);
  normalized_p256dh text := btrim(p_p256dh);
  normalized_auth_key text := btrim(p_auth_key);
begin
  if normalized_endpoint is null
     or normalized_endpoint !~ '^https://'
     or char_length(normalized_endpoint) not between 1 and 4096 then
    raise exception 'invalid push endpoint' using errcode = '22023';
  end if;

  if normalized_p256dh is null
     or char_length(normalized_p256dh) not between 1 and 1024
     or normalized_auth_key is null
     or char_length(normalized_auth_key) not between 1 and 1024 then
    raise exception 'invalid push subscription keys' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.team_members tm
    join public.profiles p on p.id = tm.profile_id
    where tm.team_id = p_team_id
      and tm.profile_id = p_player_id
      and tm.role = 'player'
      and tm.active
      and p.role = 'player'
      and p.account_active
  ) then
    raise exception 'active player membership is required'
      using errcode = '42501';
  end if;

  insert into private.push_subscriptions as subscription (
    team_id,
    player_id,
    endpoint,
    p256dh,
    auth_key,
    active,
    created_at,
    updated_at
  ) values (
    p_team_id,
    p_player_id,
    normalized_endpoint,
    normalized_p256dh,
    normalized_auth_key,
    true,
    now(),
    now()
  )
  on conflict (endpoint) do update
  set team_id = excluded.team_id,
      player_id = excluded.player_id,
      p256dh = excluded.p256dh,
      auth_key = excluded.auth_key,
      active = true,
      updated_at = now()
  returning subscription.id into result_id;

  return result_id;
end;
$$;

create or replace function public.deactivate_push_subscription(
  p_team_id uuid,
  p_player_id uuid,
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update private.push_subscriptions
  set active = false,
      updated_at = now()
  where team_id = p_team_id
    and player_id = p_player_id
    and endpoint = btrim(p_endpoint)
    and active;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.deactivate_push_subscription_by_id(
  p_subscription_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update private.push_subscriptions
  set active = false,
      updated_at = now()
  where id = p_subscription_id
    and active;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.list_push_notification_targets(
  p_team_id uuid,
  p_lesson_id text,
  p_coach_id uuid
)
returns table (
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_coach_admin(p_team_id, p_coach_id) then
    raise exception 'coach administrator is required for this team'
      using errcode = '42501';
  end if;

  return query
  select
    subscription.id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth_key
  from private.push_subscriptions subscription
  join public.team_members member
    on member.team_id = subscription.team_id
   and member.profile_id = subscription.player_id
  join public.profiles player
    on player.id = member.profile_id
  join private.lesson_rules lesson
    on lesson.lesson_id = p_lesson_id
   and lesson.active
  where subscription.team_id = p_team_id
    and subscription.active
    and member.active
    and member.role = 'player'
    and player.role = 'player'
    and player.account_active
    and (
      player.birth_year is null
      or player.birth_year = any(lesson.eligible_birth_years)
    )
    and exists (
      select 1
      from public.lesson_assignments assignment
      where assignment.team_id = p_team_id
        and assignment.lesson_id = p_lesson_id
        and assignment.active
        and (
          assignment.player_id is null
          or assignment.player_id = subscription.player_id
        )
    )
  order by subscription.created_at, subscription.id;
end;
$$;

create or replace function public.claim_push_notification_event(
  p_team_id uuid,
  p_assignment_id uuid,
  p_event_kind text,
  p_coach_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if not private.is_coach_admin(p_team_id, p_coach_id) then
    raise exception 'coach administrator is required for this team'
      using errcode = '42501';
  end if;

  if p_event_kind is null or btrim(p_event_kind) <> 'lesson_assigned' then
    raise exception 'unsupported push notification event'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.team_id = p_team_id
      and assignment.active
  ) then
    raise exception 'active lesson assignment not found for this team'
      using errcode = '22023';
  end if;

  insert into private.push_notification_events (
    team_id,
    assignment_id,
    event_kind
  ) values (
    p_team_id,
    p_assignment_id,
    'lesson_assigned'
  )
  on conflict (team_id, assignment_id, event_kind) do nothing;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.upsert_push_subscription(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.deactivate_push_subscription(
  uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.deactivate_push_subscription_by_id(uuid)
  from public, anon, authenticated;
revoke all on function public.list_push_notification_targets(
  uuid, text, uuid
) from public, anon, authenticated;
revoke all on function public.claim_push_notification_event(
  uuid, uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.upsert_push_subscription(
  uuid, uuid, text, text, text
) to service_role;
grant execute on function public.deactivate_push_subscription(
  uuid, uuid, text
) to service_role;
grant execute on function public.deactivate_push_subscription_by_id(uuid)
  to service_role;
grant execute on function public.list_push_notification_targets(
  uuid, text, uuid
) to service_role;
grant execute on function public.claim_push_notification_event(
  uuid, uuid, text, uuid
) to service_role;

commit;

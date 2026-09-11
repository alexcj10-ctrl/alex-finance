begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('player', 'coach');
create type public.lesson_status as enum ('da_fare', 'in_corso', 'completata');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  role public.app_role not null default 'player',
  avatar_path text check (avatar_path is null or char_length(avatar_path) between 1 and 512),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  season text not null check (char_length(btrim(season)) between 1 and 32),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  active boolean not null default true,
  primary key (team_id, profile_id)
);

create table public.lesson_progress (
  team_id uuid not null,
  player_id uuid not null,
  lesson_id text not null check (lesson_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  status public.lesson_status not null default 'da_fare',
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  points_earned integer not null default 0 check (points_earned between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id, lesson_id),
  foreign key (team_id, player_id)
    references public.team_members(team_id, profile_id) on delete cascade,
  constraint lesson_progress_state_check check (
    (status = 'da_fare' and progress_percent = 0 and started_at is null and completed_at is null)
    or (status = 'in_corso' and progress_percent between 0 and 99 and started_at is not null and completed_at is null)
    or (status = 'completata' and progress_percent = 100 and started_at is not null and completed_at is not null)
  ),
  constraint lesson_progress_time_check check (
    completed_at is null or completed_at >= started_at
  )
);

create table public.video_progress (
  team_id uuid not null,
  player_id uuid not null,
  lesson_id text not null,
  variant_id text not null check (variant_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  watched_percent smallint not null default 0 check (watched_percent between 0 and 100),
  last_position_seconds numeric(10, 3) not null default 0
    check (last_position_seconds between 0 and 86400),
  last_checkpoint smallint not null default 0 check (last_checkpoint in (0, 25, 50, 75, 100)),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id, lesson_id, variant_id),
  foreign key (team_id, player_id, lesson_id)
    references public.lesson_progress(team_id, player_id, lesson_id) on delete cascade,
  constraint video_progress_checkpoint_check check (watched_percent >= last_checkpoint),
  constraint video_progress_completed_check check (completed = (last_checkpoint = 100))
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  player_id uuid not null,
  lesson_id text not null,
  score numeric(5, 2) generated always as (
    round((correct_answers::numeric * 100) / nullif(total_questions::numeric, 0), 2)
  ) stored,
  total_questions smallint not null check (total_questions between 1 and 20),
  correct_answers smallint not null
    check (correct_answers >= 0 and correct_answers <= total_questions),
  completed_at timestamptz not null default now(),
  foreign key (team_id, player_id, lesson_id)
    references public.lesson_progress(team_id, player_id, lesson_id) on delete cascade
);

create table public.player_trophies (
  team_id uuid not null,
  player_id uuid not null,
  trophy_id text not null check (trophy_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  unlocked_at timestamptz not null default now(),
  primary key (team_id, player_id, trophy_id),
  foreign key (team_id, player_id)
    references public.team_members(team_id, profile_id) on delete cascade
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  player_id uuid not null,
  lesson_id text check (lesson_id is null or lesson_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  event_type text not null check (event_type in (
    'app_opened',
    'lesson_assigned',
    'lesson_started',
    'lesson_completed',
    'video_started',
    'video_checkpoint',
    'video_completed',
    'quiz_completed',
    'trophy_unlocked'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (team_id, player_id)
    references public.team_members(team_id, profile_id) on delete cascade,
  constraint activity_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint activity_metadata_size_check check (octet_length(metadata::text) <= 2048)
);

create index team_members_active_profile_idx
  on public.team_members(profile_id, team_id, role) where active;
create index team_members_active_team_idx
  on public.team_members(team_id, role, profile_id) where active;
create index lesson_progress_team_lesson_idx
  on public.lesson_progress(team_id, lesson_id, status, player_id);
create index lesson_progress_player_status_idx
  on public.lesson_progress(player_id, status);
create index video_progress_team_lesson_idx
  on public.video_progress(team_id, lesson_id, player_id);
create index quiz_attempts_team_lesson_idx
  on public.quiz_attempts(team_id, lesson_id, completed_at desc);
create index quiz_attempts_player_lesson_idx
  on public.quiz_attempts(player_id, lesson_id, completed_at desc);
create index player_trophies_team_trophy_idx
  on public.player_trophies(team_id, trophy_id, player_id);
create index activity_events_team_player_idx
  on public.activity_events(team_id, player_id, created_at desc);
create index activity_events_player_idx
  on public.activity_events(player_id, created_at desc);
create index activity_events_lesson_idx
  on public.activity_events(team_id, lesson_id, created_at desc)
  where lesson_id is not null;

create function private.prepare_lesson_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_rank smallint;
  new_rank smallint;
begin
  if tg_op = 'UPDATE' then
    old_rank := case old.status when 'da_fare' then 0 when 'in_corso' then 1 else 2 end;
    new_rank := case new.status when 'da_fare' then 0 when 'in_corso' then 1 else 2 end;

    if new_rank < old_rank then
      raise exception 'lesson progress cannot move backwards';
    end if;

    if new.progress_percent < old.progress_percent then
      raise exception 'lesson progress percent cannot decrease';
    end if;
  end if;

  if new.status <> 'da_fare' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status = 'completata' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completata' then
    new.completed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_lesson_progress_before_write
before insert or update on public.lesson_progress
for each row execute function private.prepare_lesson_progress();

create function private.prepare_video_progress()
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

  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_video_progress_before_write
before insert or update on public.video_progress
for each row execute function private.prepare_video_progress();

create function private.handle_esordienti_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_display_name text;
begin
  safe_display_name := left(
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Giocatore'),
    50
  );

  insert into public.profiles (id, display_name, role)
  values (new.id, safe_display_name, 'player')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_esordienti_auth_user_created
after insert on auth.users
for each row execute function private.handle_esordienti_new_user();

create function private.is_active_member_as(
  p_team_id uuid,
  p_profile_id uuid,
  p_role public.app_role
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
      and tm.active
      and tm.role = p_role
      and p.role = p_role
  );
$$;

create function private.can_read_team(p_team_id uuid)
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
      and tm.profile_id = (select auth.uid())
      and tm.active
      and tm.role = p.role
  );
$$;

create function private.can_coach_player(p_team_id uuid, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members cm
    join public.profiles cp
      on cp.id = cm.profile_id and cp.role = 'coach'
    join public.team_members pm
      on pm.team_id = cm.team_id
      and pm.profile_id = p_player_id
      and pm.role = 'player'
      and pm.active
    join public.profiles pp
      on pp.id = pm.profile_id and pp.role = 'player'
    where cm.team_id = p_team_id
      and cm.profile_id = (select auth.uid())
      and cm.role = 'coach'
      and cm.active
  );
$$;

create function private.can_coach_profile(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members cm
    join public.profiles cp
      on cp.id = cm.profile_id and cp.role = 'coach'
    join public.team_members pm
      on pm.team_id = cm.team_id
      and pm.profile_id = p_player_id
      and pm.role = 'player'
      and pm.active
    join public.profiles pp
      on pp.id = pm.profile_id and pp.role = 'player'
    where cm.profile_id = (select auth.uid())
      and cm.role = 'coach'
      and cm.active
  );
$$;

revoke execute on function private.prepare_lesson_progress() from public, anon, authenticated;
revoke execute on function private.prepare_video_progress() from public, anon, authenticated;
revoke execute on function private.handle_esordienti_new_user() from public, anon, authenticated;
revoke execute on function private.is_active_member_as(uuid, uuid, public.app_role)
  from public, anon, authenticated;
revoke execute on function private.can_read_team(uuid) from public, anon, authenticated;
revoke execute on function private.can_coach_player(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.can_coach_profile(uuid) from public, anon, authenticated;
grant execute on function private.is_active_member_as(uuid, uuid, public.app_role)
  to authenticated;
grant execute on function private.can_read_team(uuid) to authenticated;
grant execute on function private.can_coach_player(uuid, uuid) to authenticated;
grant execute on function private.can_coach_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.video_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.player_trophies enable row level security;
alter table public.activity_events enable row level security;

revoke all on table public.profiles, public.teams, public.team_members,
  public.lesson_progress, public.video_progress, public.quiz_attempts,
  public.player_trophies, public.activity_events from anon, authenticated;

grant all on table public.profiles, public.teams, public.team_members,
  public.lesson_progress, public.video_progress, public.quiz_attempts,
  public.player_trophies, public.activity_events to service_role;

grant select on table public.profiles, public.teams, public.team_members,
  public.lesson_progress, public.video_progress, public.quiz_attempts,
  public.player_trophies, public.activity_events to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
grant insert (team_id, player_id, lesson_id, status, progress_percent)
  on public.lesson_progress to authenticated;
grant update (status, progress_percent)
  on public.lesson_progress to authenticated;
grant insert (
  team_id,
  player_id,
  lesson_id,
  variant_id,
  watched_percent,
  last_position_seconds,
  last_checkpoint,
  completed
) on public.video_progress to authenticated;
grant update (watched_percent, last_position_seconds, last_checkpoint, completed)
  on public.video_progress to authenticated;
grant insert (id, team_id, player_id, lesson_id, event_type, metadata)
  on public.activity_events to authenticated;

create policy profiles_read_own_or_coached_player
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.can_coach_profile(id));

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy teams_read_active_membership
on public.teams for select to authenticated
using (private.can_read_team(id));

create policy team_members_read_self_or_coached_players
on public.team_members for select to authenticated
using (
  profile_id = (select auth.uid())
  or (
    active
    and role = 'player'
    and private.is_active_member_as(team_id, (select auth.uid()), 'coach')
  )
);

create policy lesson_progress_read_own_or_coach
on public.lesson_progress for select to authenticated
using (
  player_id = (select auth.uid())
  or private.can_coach_player(team_id, player_id)
);

create policy lesson_progress_insert_own
on public.lesson_progress for insert to authenticated
with check (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
);

create policy lesson_progress_update_own
on public.lesson_progress for update to authenticated
using (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
)
with check (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
);

create policy video_progress_read_own_or_coach
on public.video_progress for select to authenticated
using (
  player_id = (select auth.uid())
  or private.can_coach_player(team_id, player_id)
);

create policy video_progress_insert_own
on public.video_progress for insert to authenticated
with check (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
);

create policy video_progress_update_own
on public.video_progress for update to authenticated
using (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
)
with check (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
);

create policy quiz_attempts_read_own_or_coach
on public.quiz_attempts for select to authenticated
using (
  player_id = (select auth.uid())
  or private.can_coach_player(team_id, player_id)
);

create policy player_trophies_read_own_or_coach
on public.player_trophies for select to authenticated
using (
  player_id = (select auth.uid())
  or private.can_coach_player(team_id, player_id)
);

create policy activity_events_read_own_or_coach
on public.activity_events for select to authenticated
using (
  player_id = (select auth.uid())
  or private.can_coach_player(team_id, player_id)
);

create policy activity_events_insert_own
on public.activity_events for insert to authenticated
with check (
  player_id = (select auth.uid())
  and private.is_active_member_as(team_id, player_id, 'player')
  and event_type in (
    'app_opened',
    'lesson_started',
    'lesson_completed',
    'video_started',
    'video_checkpoint',
    'video_completed'
  )
);

commit;

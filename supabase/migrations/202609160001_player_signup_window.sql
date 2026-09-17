begin;

-- Self-signup is fail-closed unless an authenticated Coach opens a short,
-- environment-scoped window. A persistent quota limits abuse even when Vercel
-- serves requests from multiple serverless instances.
create table if not exists public.player_signup_windows (
  environment text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  open_until timestamptz,
  max_signups smallint not null default 25,
  signups_used smallint not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (environment, team_id)
);

-- Upgrade safely if an earlier draft of this migration was applied manually.
alter table public.player_signup_windows
  add column if not exists environment text,
  add column if not exists max_signups smallint not null default 25,
  add column if not exists signups_used smallint not null default 0;

update public.player_signup_windows
set environment = 'production'
where environment is null;

alter table public.player_signup_windows
  alter column environment set not null,
  drop constraint if exists player_signup_windows_pkey,
  drop constraint if exists player_signup_windows_environment_check,
  drop constraint if exists player_signup_windows_max_signups_check,
  drop constraint if exists player_signup_windows_signups_used_check;

alter table public.player_signup_windows
  add constraint player_signup_windows_pkey primary key (environment, team_id),
  add constraint player_signup_windows_environment_check
    check (environment in ('development', 'preview', 'production')),
  add constraint player_signup_windows_max_signups_check
    check (max_signups between 1 and 50),
  add constraint player_signup_windows_signups_used_check
    check (signups_used between 0 and max_signups);

drop index if exists public.player_signup_windows_open_until_idx;
create index if not exists player_signup_windows_environment_open_until_idx
  on public.player_signup_windows(environment, open_until)
  where open_until is not null;

alter table public.player_signup_windows enable row level security;
alter table public.player_signup_windows force row level security;

-- The table is intentionally unavailable to browser roles. Coach access is
-- mediated by Vercel Functions after session and team-membership checks.
revoke all privileges on table public.player_signup_windows
  from public, anon, authenticated;
grant all privileges on table public.player_signup_windows to service_role;

create or replace function public.consume_player_signup_slot(
  p_team_id uuid,
  p_environment text
)
returns table(open_until timestamptz, remaining_signups integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.player_signup_windows as signup_window
  set signups_used = signup_window.signups_used + 1,
      updated_at = now()
  where signup_window.team_id = p_team_id
    and signup_window.environment = p_environment
    and signup_window.open_until > now()
    and signup_window.signups_used < signup_window.max_signups
  returning
    signup_window.open_until,
    (signup_window.max_signups - signup_window.signups_used)::integer;
end;
$$;

create or replace function public.release_player_signup_slot(
  p_team_id uuid,
  p_environment text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.player_signup_windows as signup_window
  set signups_used = greatest(0, signup_window.signups_used - 1),
      updated_at = now()
  where signup_window.team_id = p_team_id
    and signup_window.environment = p_environment
    and signup_window.signups_used > 0;
$$;

revoke all on function public.consume_player_signup_slot(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_player_signup_slot(uuid, text)
  to service_role;
revoke all on function public.release_player_signup_slot(uuid, text)
  from public, anon, authenticated;
grant execute on function public.release_player_signup_slot(uuid, text)
  to service_role;

comment on table public.player_signup_windows is
  'Environment-scoped, expiring Coach enrollment windows with a persistent signup quota.';

commit;

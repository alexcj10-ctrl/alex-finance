begin;

-- This migration extends the read-only Coach foundation with the authenticated,
-- server-authoritative learning flow. It is intentionally additive so the
-- original migration remains a valid snapshot of the previous architecture.

alter table public.profiles
  add column if not exists player_code text,
  add column if not exists account_active boolean not null default true,
  add column if not exists local_progress_imported_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_player_code_check'
  ) then
    alter table public.profiles
      add constraint profiles_player_code_check check (
        player_code is null
        or (
          player_code = upper(btrim(player_code))
          and player_code ~ '^[A-Z0-9]{4,20}$'
        )
      );
  end if;
end;
$$;

create unique index if not exists profiles_player_code_unique_idx
  on public.profiles (player_code)
  where player_code is not null;

create unique index if not exists team_members_one_active_player_team_idx
  on public.team_members(profile_id)
  where active and role = 'player';

create table if not exists public.lesson_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null check (lesson_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  active boolean not null default true,
  foreign key (team_id, player_id)
    references public.team_members(team_id, profile_id) on delete cascade,
  foreign key (team_id, assigned_by)
    references public.team_members(team_id, profile_id) on delete restrict,
  constraint lesson_assignments_due_check check (
    due_at is null or due_at >= assigned_at
  )
);

create unique index if not exists lesson_assignments_active_team_unique_idx
  on public.lesson_assignments(team_id, lesson_id)
  where active and player_id is null;
create unique index if not exists lesson_assignments_active_player_unique_idx
  on public.lesson_assignments(team_id, player_id, lesson_id)
  where active and player_id is not null;
create index if not exists lesson_assignments_player_idx
  on public.lesson_assignments(player_id, active, assigned_at desc)
  where player_id is not null;
create index if not exists lesson_assignments_team_idx
  on public.lesson_assignments(team_id, active, assigned_at desc);

create or replace function private.valid_quiz_choices(p_choices jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  choice jsonb;
  choice_id text;
  seen_ids text[] := array[]::text[];
begin
  if jsonb_typeof(p_choices) <> 'array'
     or jsonb_array_length(p_choices) not between 2 and 6 then
    return false;
  end if;

  for choice in select value from jsonb_array_elements(p_choices)
  loop
    if jsonb_typeof(choice) <> 'object' then
      return false;
    end if;

    choice_id := choice ->> 'id';
    if choice_id is null
       or choice_id !~ '^[a-z0-9][a-z0-9-]{0,63}$'
       or char_length(coalesce(choice ->> 'label', '')) not between 1 and 240
       or choice_id = any(seen_ids) then
      return false;
    end if;

    seen_ids := array_append(seen_ids, choice_id);
  end loop;

  return true;
end;
$$;

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null check (lesson_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 500),
  choices jsonb not null check (private.valid_quiz_choices(choices)),
  position smallint not null check (position between 1 and 20),
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position),
  unique (id, lesson_id)
);

create index if not exists quiz_questions_lesson_active_idx
  on public.quiz_questions(lesson_id, position)
  where active;

create table if not exists private.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_choice_id text not null check (
    correct_choice_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'
  ),
  feedback_correct text not null check (
    char_length(btrim(feedback_correct)) between 1 and 500
  ),
  feedback_incorrect text not null check (
    char_length(btrim(feedback_incorrect)) between 1 and 500
  )
);

create table if not exists private.lesson_rules (
  lesson_id text primary key check (lesson_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  points smallint not null check (points between 0 and 1000),
  minimum_video_percent smallint not null default 100
    check (minimum_video_percent between 0 and 100),
  minimum_quiz_percent smallint check (minimum_quiz_percent between 0 and 100),
  phase text not null check (phase in (
    'costruzione', 'progressione', 'finalizzazione',
    'pressione_alta', 'pressione_bassa'
  )),
  macro_phase text not null check (macro_phase in ('possesso', 'non_possesso')),
  active boolean not null default true
);

create table if not exists private.trophy_rules (
  trophy_id text primary key check (trophy_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  rule_kind text not null check (rule_kind in (
    'completed_lessons', 'points', 'complete_phase', 'complete_macro'
  )),
  minimum integer check (minimum is null or minimum between 1 and 100000),
  phase text,
  macro_phase text,
  constraint trophy_rules_shape_check check (
    (rule_kind = 'completed_lessons' and minimum is not null and phase is null and macro_phase is null)
    or (rule_kind = 'points' and minimum is not null and phase is null and macro_phase is null)
    or (rule_kind = 'complete_phase' and minimum is null and phase is not null and macro_phase is null)
    or (rule_kind = 'complete_macro' and minimum is not null and phase is null and macro_phase is not null)
  )
);

alter table public.quiz_attempts
  add column if not exists attempt_number integer,
  add column if not exists client_attempt_id uuid,
  add column if not exists points_earned integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by team_id, player_id, lesson_id
      order by completed_at, id
    )::integer as inferred_attempt_number
  from public.quiz_attempts
  where attempt_number is null
)
update public.quiz_attempts qa
set attempt_number = ranked.inferred_attempt_number
from ranked
where qa.id = ranked.id;

alter table public.quiz_attempts alter column attempt_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_attempts'::regclass
      and conname = 'quiz_attempts_attempt_number_check'
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_attempt_number_check
      check (attempt_number between 1 and 10000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_attempts'::regclass
      and conname = 'quiz_attempts_points_check'
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_points_check
      check (points_earned between 0 and 100000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_attempts'::regclass
      and conname = 'quiz_attempts_identity_unique'
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_identity_unique
      unique (id, team_id, player_id, lesson_id);
  end if;
end;
$$;

create unique index if not exists quiz_attempts_number_unique_idx
  on public.quiz_attempts(team_id, player_id, lesson_id, attempt_number);
create unique index if not exists quiz_attempts_client_id_unique_idx
  on public.quiz_attempts(team_id, player_id, client_attempt_id)
  where client_attempt_id is not null;

create table if not exists public.quiz_answers (
  attempt_id uuid not null,
  team_id uuid not null,
  player_id uuid not null,
  lesson_id text not null,
  question_id uuid not null,
  selected_choice_id text not null check (
    selected_choice_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'
  ),
  is_correct boolean not null,
  feedback text not null check (char_length(btrim(feedback)) between 1 and 500),
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (attempt_id, team_id, player_id, lesson_id)
    references public.quiz_attempts(id, team_id, player_id, lesson_id)
    on delete cascade,
  foreign key (question_id, lesson_id)
    references public.quiz_questions(id, lesson_id)
    on delete restrict
);

create index if not exists quiz_answers_player_lesson_idx
  on public.quiz_answers(player_id, lesson_id, answered_at desc);
create index if not exists quiz_answers_team_lesson_idx
  on public.quiz_answers(team_id, lesson_id, answered_at desc);

alter table public.activity_events add column if not exists dedupe_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_dedupe_key_check'
  ) then
    alter table public.activity_events
      add constraint activity_events_dedupe_key_check check (
        dedupe_key is null or char_length(dedupe_key) between 1 and 240
      );
  end if;
end;
$$;

alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;
alter table public.activity_events
  add constraint activity_events_event_type_check check (event_type in (
    'app_opened',
    'login',
    'lesson_assigned',
    'lesson_started',
    'lesson_completed',
    'video_started',
    'video_25',
    'video_50',
    'video_75',
    'video_checkpoint',
    'video_completed',
    'quiz_completed',
    'trophy_unlocked'
  ));

create unique index if not exists activity_events_dedupe_unique_idx
  on public.activity_events(team_id, player_id, dedupe_key)
  where dedupe_key is not null;

create or replace function private.validate_quiz_answer_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_choices jsonb;
begin
  select q.choices into question_choices
  from public.quiz_questions q
  where q.id = new.question_id;

  if question_choices is null or not exists (
    select 1
    from jsonb_array_elements(question_choices) choice
    where choice ->> 'id' = new.correct_choice_id
  ) then
    raise exception 'correct choice does not belong to the question';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_quiz_answer_key_before_write
  on private.quiz_answer_keys;
create trigger validate_quiz_answer_key_before_write
before insert or update on private.quiz_answer_keys
for each row execute function private.validate_quiz_answer_key();

-- Only the minimal server-side rules needed to validate points and trophies are
-- duplicated here; titles, copy, videos and tactical content remain in lessons.ts.
insert into private.lesson_rules (
  lesson_id, points, minimum_video_percent, minimum_quiz_percent, phase, macro_phase, active
) values
  ('costruzione-creare-ampiezza', 60, 100, 50, 'costruzione', 'possesso', true),
  ('costruzione-attira-uomo-libero', 60, 100, null, 'costruzione', 'possesso', true),
  ('pressione-alta-chiudi-centro-porta-fuori', 50, 100, null, 'pressione_alta', 'non_possesso', true)
on conflict (lesson_id) do nothing;

insert into private.trophy_rules (trophy_id, rule_kind, minimum, phase, macro_phase)
values
  ('prima-lezione', 'completed_lessons', 1, null, null),
  ('costruttore', 'complete_phase', null, 'costruzione', null),
  ('cinque-lezioni', 'completed_lessons', 5, null, null),
  ('cento-punti', 'points', 100, null, null),
  ('specialista-con-palla', 'complete_macro', 3, null, 'possesso')
on conflict (trophy_id) do nothing;

insert into public.quiz_questions (
  id, lesson_id, prompt, choices, position, active, is_demo
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'costruzione-creare-ampiezza',
    'Perché occupiamo tutta la larghezza nella rimessa dal fondo?',
    '[{"id":"linee-pulite","label":"Per dare al portiere più linee di passaggio pulite"},{"id":"tutti-vicini","label":"Per stare tutti vicini alla palla"},{"id":"solo-lancio","label":"Per obbligare il portiere a lanciare lungo"}]'::jsonb,
    1,
    true,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'costruzione-creare-ampiezza',
    'Dove devi posizionarti per aiutare il portiere?',
    '[{"id":"visibile-libero","label":"In una posizione visibile con la linea di passaggio libera"},{"id":"dietro-avversario","label":"Dietro un avversario"},{"id":"stessa-linea","label":"Sulla stessa linea di un compagno"}]'::jsonb,
    2,
    true,
    false
  )
on conflict (id) do nothing;

insert into private.quiz_answer_keys (
  question_id, correct_choice_id, feedback_correct, feedback_incorrect
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'linee-pulite',
    'Esatto: l’ampiezza apre il campo e rende più chiare le soluzioni del portiere.',
    'Riguarda il principio: aprire il campo serve a creare linee di passaggio pulite.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'visibile-libero',
    'Esatto: fatti vedere e lascia libera la linea tra te e la palla.',
    'Cerca una posizione in cui il portiere possa vederti e servirti senza ostacoli.'
  )
on conflict (question_id) do nothing;

create or replace function private.handle_esordienti_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_display_name text;
  requested_role public.app_role;
  safe_player_code text;
begin
  safe_display_name := left(
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Giocatore'),
    50
  );
  requested_role := case
    when new.raw_app_meta_data ->> 'role' = 'coach' then 'coach'::public.app_role
    else 'player'::public.app_role
  end;
  safe_player_code := nullif(upper(btrim(new.raw_app_meta_data ->> 'player_code')), '');

  if safe_player_code is not null and safe_player_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'invalid player code';
  end if;

  if requested_role = 'coach' then
    safe_player_code := null;
  end if;

  insert into public.profiles (
    id, display_name, role, player_code, account_active
  ) values (
    new.id, safe_display_name, requested_role, safe_player_code, true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function private.is_active_member_as(
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
      and p.account_active
  );
$$;

create or replace function private.can_read_team(p_team_id uuid)
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
      and p.account_active
  );
$$;

create or replace function private.can_coach_player(
  p_team_id uuid,
  p_player_id uuid
)
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
      on cp.id = cm.profile_id
      and cp.role = 'coach'
      and cp.account_active
    join public.team_members pm
      on pm.team_id = cm.team_id
      and pm.profile_id = p_player_id
      and pm.role = 'player'
    join public.profiles pp
      on pp.id = pm.profile_id
      and pp.role = 'player'
    where cm.team_id = p_team_id
      and cm.profile_id = (select auth.uid())
      and cm.role = 'coach'
      and cm.active
  );
$$;

create or replace function private.can_coach_profile(p_player_id uuid)
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
      on cp.id = cm.profile_id
      and cp.role = 'coach'
      and cp.account_active
    join public.team_members pm
      on pm.team_id = cm.team_id
      and pm.profile_id = p_player_id
      and pm.role = 'player'
    join public.profiles pp
      on pp.id = pm.profile_id
      and pp.role = 'player'
    where cm.profile_id = (select auth.uid())
      and cm.role = 'coach'
      and cm.active
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
          and exists (
            select 1
            from public.lesson_assignments la
            where la.team_id = tm.team_id
              and la.lesson_id = p_lesson_id
              and la.active
              and (la.player_id is null or la.player_id = tm.profile_id)
          )
        )
      )
  );
$$;

create or replace function private.award_player_trophies(
  p_team_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  unlocked record;
begin
  for unlocked in
    with eligible as (
      select tr.trophy_id
      from private.trophy_rules tr
      where case tr.rule_kind
        when 'completed_lessons' then (
          select count(*) >= tr.minimum
          from public.lesson_progress lp
          where lp.team_id = p_team_id
            and lp.player_id = p_player_id
            and lp.status = 'completata'
        )
        when 'points' then (
          select coalesce(sum(lp.points_earned), 0) >= tr.minimum
          from public.lesson_progress lp
          where lp.team_id = p_team_id
            and lp.player_id = p_player_id
        )
        when 'complete_phase' then (
          exists (
            select 1 from private.lesson_rules lr
            where lr.active and lr.phase = tr.phase
          )
          and not exists (
            select 1
            from private.lesson_rules lr
            where lr.active
              and lr.phase = tr.phase
              and not exists (
                select 1
                from public.lesson_progress lp
                where lp.team_id = p_team_id
                  and lp.player_id = p_player_id
                  and lp.lesson_id = lr.lesson_id
                  and lp.status = 'completata'
              )
          )
        )
        when 'complete_macro' then (
          select count(distinct lp.lesson_id) >= tr.minimum
          from public.lesson_progress lp
          join private.lesson_rules lr on lr.lesson_id = lp.lesson_id and lr.active
          where lp.team_id = p_team_id
            and lp.player_id = p_player_id
            and lp.status = 'completata'
            and lr.macro_phase = tr.macro_phase
        )
        else false
      end
    ), inserted as (
      insert into public.player_trophies (
        team_id, player_id, trophy_id, unlocked_at
      )
      select p_team_id, p_player_id, e.trophy_id, now()
      from eligible e
      on conflict (team_id, player_id, trophy_id) do nothing
      returning trophy_id
    )
    select trophy_id from inserted
  loop
    insert into public.activity_events (
      team_id, player_id, event_type, metadata, dedupe_key
    ) values (
      p_team_id,
      p_player_id,
      'trophy_unlocked',
      jsonb_build_object('trophyId', unlocked.trophy_id),
      'trophy_unlocked:' || unlocked.trophy_id
    )
    on conflict (team_id, player_id, dedupe_key)
      where dedupe_key is not null
      do nothing;
  end loop;
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(btrim(p_player_code));
  result public.profiles%rowtype;
  inserted_player record;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

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
     or not private.is_active_member_as(p_team_id, coach_id, 'coach') then
    raise exception 'coach is not authorized for this team' using errcode = '42501';
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
     or not private.is_active_member_as(result.team_id, coach_id, 'coach') then
    raise exception 'assignment not found or not authorized' using errcode = '42501';
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

create or replace function public.record_login(p_team_id uuid)
returns public.activity_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  login_bucket text;
  result public.activity_events%rowtype;
begin
  if player_id is null
     or not private.is_active_member_as(p_team_id, player_id, 'player') then
    raise exception 'active player membership required' using errcode = '42501';
  end if;

  login_bucket := 'login:' || floor(extract(epoch from now()) / 900)::bigint::text;

  insert into public.activity_events (
    team_id, player_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id, player_id, 'login', '{}'::jsonb, login_bucket
  )
  on conflict (team_id, player_id, dedupe_key)
    where dedupe_key is not null
    do nothing
  returning * into result;

  if result.id is null then
    select ae.* into result
    from public.activity_events ae
    where ae.team_id = p_team_id
      and ae.player_id = player_id
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
  player_id uuid := auth.uid();
  assignment_time timestamptz;
  result public.lesson_progress%rowtype;
begin
  if player_id is null
     or not private.player_has_active_assignment(p_team_id, player_id, p_lesson_id) then
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
    and (la.player_id is null or la.player_id = player_id);

  insert into public.lesson_progress (
    team_id, player_id, lesson_id, status, progress_percent, assigned_at
  ) values (
    p_team_id, player_id, p_lesson_id, 'da_fare', 0, assignment_time
  )
  on conflict (team_id, player_id, lesson_id) do nothing;

  select lp.* into result
  from public.lesson_progress lp
  where lp.team_id = p_team_id
    and lp.player_id = player_id
    and lp.lesson_id = p_lesson_id
  for update;

  if result.status = 'da_fare' then
    update public.lesson_progress lp
    set status = 'in_corso', progress_percent = greatest(lp.progress_percent, 1)
    where lp.team_id = p_team_id
      and lp.player_id = player_id
      and lp.lesson_id = p_lesson_id
    returning lp.* into result;

    insert into public.activity_events (
      team_id, player_id, lesson_id, event_type, metadata, dedupe_key
    ) values (
      p_team_id,
      player_id,
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
  player_id uuid := auth.uid();
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
    player_id,
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
    and lp.player_id = player_id
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
    player_id,
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
  player_id uuid := auth.uid();
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
    and lp.player_id = player_id
    and lp.lesson_id = p_lesson_id
  for update;

  if result.status = 'completata' then
    return result;
  end if;

  select coalesce(max(vp.watched_percent), 0)::smallint into best_video
  from public.video_progress vp
  where vp.team_id = p_team_id
    and vp.player_id = player_id
    and vp.lesson_id = p_lesson_id;

  if best_video < rule.minimum_video_percent then
    raise exception 'required video progress not reached' using errcode = '22023';
  end if;

  if rule.minimum_quiz_percent is not null then
    select max(qa.score) into best_quiz
    from public.quiz_attempts qa
    where qa.team_id = p_team_id
      and qa.player_id = player_id
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
    and lp.player_id = player_id
    and lp.lesson_id = p_lesson_id
  returning lp.* into result;

  insert into public.activity_events (
    team_id, player_id, lesson_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id,
    player_id,
    p_lesson_id,
    'lesson_completed',
    jsonb_build_object('pointsEarned', result.points_earned),
    'lesson_completed:' || p_lesson_id
  )
  on conflict (team_id, player_id, dedupe_key)
    where dedupe_key is not null
    do nothing;

  perform private.award_player_trophies(p_team_id, player_id);

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
  player_id uuid := auth.uid();
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

  if player_id is null
     or not private.player_has_active_assignment(p_team_id, player_id, p_lesson_id) then
    raise exception 'active lesson assignment required' using errcode = '42501';
  end if;

  if p_client_attempt_id is not null then
    select qa.* into result
    from public.quiz_attempts qa
    where qa.team_id = p_team_id
      and qa.player_id = player_id
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
    and qa.player_id = player_id
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
    player_id,
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
      player_id,
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
    and lp.player_id = player_id
    and lp.lesson_id = p_lesson_id
    and lp.status = 'in_corso';

  insert into public.activity_events (
    team_id, player_id, lesson_id, event_type, metadata, dedupe_key
  ) values (
    p_team_id,
    player_id,
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
        and qa.player_id = player_id
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
  player_id uuid := auth.uid();
  lesson_item jsonb;
  video_item jsonb;
  lesson_id text;
  variant_id text;
  watched_percent smallint;
  checkpoint smallint;
  last_position numeric;
  lessons_started integer := 0;
  lessons_completed integer := 0;
  videos_imported integer := 0;
  skipped integer := 0;
  imported_at timestamptz;
begin
  if player_id is null
     or not private.is_active_member_as(p_team_id, player_id, 'player') then
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
  where p.id = player_id
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
    lesson_id := lesson_item ->> 'lessonId';
    if jsonb_typeof(lesson_item) <> 'object'
       or lesson_id is null
       or not private.player_has_active_assignment(p_team_id, player_id, lesson_id)
       or not exists (
         select 1 from private.lesson_rules lr
         where lr.lesson_id = lesson_id and lr.active
       ) then
      skipped := skipped + 1;
      continue;
    end if;

    perform public.start_lesson(p_team_id, lesson_id);
    lessons_started := lessons_started + 1;
  end loop;

  for video_item in select value from jsonb_array_elements(p_videos)
  loop
    if jsonb_typeof(video_item) <> 'object' then
      skipped := skipped + 1;
      continue;
    end if;

    lesson_id := video_item ->> 'lessonId';
    variant_id := video_item ->> 'variantId';

    begin
      watched_percent := (video_item ->> 'watchedPercent')::smallint;
      last_position := coalesce((video_item ->> 'lastPositionSeconds')::numeric, 0);
    exception when invalid_text_representation or numeric_value_out_of_range then
      skipped := skipped + 1;
      continue;
    end;

    if lesson_id is null
       or variant_id is null
       or watched_percent not between 0 and 100
       or last_position not between 0 and 86400
       or not private.player_has_active_assignment(p_team_id, player_id, lesson_id)
       or not exists (
         select 1 from private.lesson_rules lr
         where lr.lesson_id = lesson_id and lr.active
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
      lesson_id,
      variant_id,
      checkpoint,
      watched_percent,
      last_position
    );
    videos_imported := videos_imported + 1;
  end loop;

  for lesson_item in select value from jsonb_array_elements(p_lessons)
  loop
    lesson_id := lesson_item ->> 'lessonId';
    if jsonb_typeof(lesson_item) <> 'object'
       or lesson_id is null
       or nullif(lesson_item ->> 'completedAt', '') is null
       or not private.player_has_active_assignment(p_team_id, player_id, lesson_id) then
      continue;
    end if;

    begin
      perform public.complete_lesson(p_team_id, lesson_id);
      lessons_completed := lessons_completed + 1;
    exception when invalid_parameter_value then
      skipped := skipped + 1;
    end;
  end loop;

  update public.profiles p
  set local_progress_imported_at = now()
  where p.id = player_id
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

alter table public.lesson_assignments enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;

revoke all privileges on table
  public.profiles,
  public.teams,
  public.team_members,
  public.lesson_assignments,
  public.lesson_progress,
  public.video_progress,
  public.quiz_questions,
  public.quiz_attempts,
  public.quiz_answers,
  public.player_trophies,
  public.activity_events
from anon, authenticated;

-- Remove the column-level writes granted by the foundation migration. All
-- learning-state writes now go through the validated RPCs below.
revoke insert (
  team_id, player_id, lesson_id, status, progress_percent
) on public.lesson_progress from authenticated;
revoke update (
  status, progress_percent
) on public.lesson_progress from authenticated;
revoke insert (
  team_id,
  player_id,
  lesson_id,
  variant_id,
  watched_percent,
  last_position_seconds,
  last_checkpoint,
  completed
) on public.video_progress from authenticated;
revoke update (
  watched_percent, last_position_seconds, last_checkpoint, completed
) on public.video_progress from authenticated;
revoke insert (
  id, team_id, player_id, lesson_id, event_type, metadata
) on public.activity_events from authenticated;

grant all privileges on table
  public.profiles,
  public.teams,
  public.team_members,
  public.lesson_assignments,
  public.lesson_progress,
  public.video_progress,
  public.quiz_questions,
  public.quiz_attempts,
  public.quiz_answers,
  public.player_trophies,
  public.activity_events
to service_role;

grant select on table
  public.profiles,
  public.teams,
  public.team_members,
  public.lesson_assignments,
  public.lesson_progress,
  public.video_progress,
  public.quiz_questions,
  public.quiz_attempts,
  public.quiz_answers,
  public.player_trophies,
  public.activity_events
to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

revoke all privileges on table
  private.quiz_answer_keys,
  private.lesson_rules,
  private.trophy_rules
from public, anon, authenticated;
grant all privileges on table
  private.quiz_answer_keys,
  private.lesson_rules,
  private.trophy_rules
to service_role;

drop policy if exists profiles_read_own_or_coached_player on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists teams_read_active_membership on public.teams;
drop policy if exists team_members_read_self_or_coached_players on public.team_members;
drop policy if exists lesson_progress_read_own_or_coach on public.lesson_progress;
drop policy if exists lesson_progress_insert_own on public.lesson_progress;
drop policy if exists lesson_progress_update_own on public.lesson_progress;
drop policy if exists video_progress_read_own_or_coach on public.video_progress;
drop policy if exists video_progress_insert_own on public.video_progress;
drop policy if exists video_progress_update_own on public.video_progress;
drop policy if exists quiz_attempts_read_own_or_coach on public.quiz_attempts;
drop policy if exists player_trophies_read_own_or_coach on public.player_trophies;
drop policy if exists activity_events_read_own_or_coach on public.activity_events;
drop policy if exists activity_events_insert_own on public.activity_events;
drop policy if exists lesson_assignments_read_own_or_coach on public.lesson_assignments;
drop policy if exists quiz_questions_read_assigned_or_coach on public.quiz_questions;
drop policy if exists quiz_answers_read_own_or_coach on public.quiz_answers;

create policy profiles_read_own_or_coached_player
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.can_coach_profile(id));

create policy profiles_update_own
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  and account_active
)
with check (
  id = (select auth.uid())
  and account_active
);

create policy teams_read_active_membership
on public.teams for select to authenticated
using (private.can_read_team(id));

create policy team_members_read_self_or_coached_players
on public.team_members for select to authenticated
using (
  (
    profile_id = (select auth.uid())
    and private.is_active_member_as(team_id, profile_id, role)
  )
  or (
    role = 'player'
    and private.can_coach_player(team_id, profile_id)
  )
);

create policy lesson_assignments_read_own_or_coach
on public.lesson_assignments for select to authenticated
using (
  private.is_active_member_as(team_id, (select auth.uid()), 'coach')
  or (
    active
    and (player_id is null or player_id = (select auth.uid()))
    and private.is_active_member_as(team_id, (select auth.uid()), 'player')
  )
);

create policy lesson_progress_read_own_or_coach
on public.lesson_progress for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
  )
  or private.can_coach_player(team_id, player_id)
);

create policy video_progress_read_own_or_coach
on public.video_progress for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
  )
  or private.can_coach_player(team_id, player_id)
);

create policy quiz_questions_read_assigned_or_coach
on public.quiz_questions for select to authenticated
using (active and private.can_read_quiz_question(lesson_id));

create policy quiz_attempts_read_own_or_coach
on public.quiz_attempts for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
  )
  or private.can_coach_player(team_id, player_id)
);

create policy quiz_answers_read_own_or_coach
on public.quiz_answers for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
  )
  or private.can_coach_player(team_id, player_id)
);

create policy player_trophies_read_own_or_coach
on public.player_trophies for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
  )
  or private.can_coach_player(team_id, player_id)
);

create policy activity_events_read_own_or_coach
on public.activity_events for select to authenticated
using (
  (
    player_id = (select auth.uid())
    and private.is_active_member_as(team_id, player_id, 'player')
  )
  or private.can_coach_player(team_id, player_id)
);

revoke execute on function private.valid_quiz_choices(jsonb)
  from public, anon, authenticated;
revoke execute on function private.validate_quiz_answer_key()
  from public, anon, authenticated;
revoke execute on function private.award_player_trophies(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function private.player_has_active_assignment(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function private.can_read_quiz_question(text)
  from public, anon, authenticated;

grant usage on schema private to authenticated, service_role;
grant execute on function private.is_active_member_as(uuid, uuid, public.app_role)
  to authenticated;
grant execute on function private.can_read_team(uuid) to authenticated;
grant execute on function private.can_coach_player(uuid, uuid) to authenticated;
grant execute on function private.can_coach_profile(uuid) to authenticated;
grant execute on function private.player_has_active_assignment(uuid, uuid, text)
  to authenticated;
grant execute on function private.can_read_quiz_question(text) to authenticated;
grant execute on function private.valid_quiz_choices(jsonb) to service_role;

revoke execute on function public.provision_player_profile(uuid, text, text, uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.provision_player_profile(uuid, text, text, uuid, boolean, uuid)
  to service_role;

revoke execute on function public.assign_lesson(uuid, text, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.set_lesson_assignment_active(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke execute on function public.record_login(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.start_lesson(uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.record_video_checkpoint(uuid, text, text, smallint, smallint, numeric)
  from public, anon, authenticated, service_role;
revoke execute on function public.complete_lesson(uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.submit_quiz(uuid, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.import_local_progress(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.assign_lesson(uuid, text, uuid, timestamptz)
  to authenticated;
grant execute on function public.set_lesson_assignment_active(uuid, boolean)
  to authenticated;
grant execute on function public.record_login(uuid) to authenticated;
grant execute on function public.start_lesson(uuid, text) to authenticated;
grant execute on function public.record_video_checkpoint(uuid, text, text, smallint, smallint, numeric)
  to authenticated;
grant execute on function public.complete_lesson(uuid, text) to authenticated;
grant execute on function public.submit_quiz(uuid, text, jsonb, uuid)
  to authenticated;
-- The legacy import RPC is intentionally not exposed to authenticated clients:
-- trusted points must only come from live checkpoints and quiz submissions.

commit;

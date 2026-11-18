begin;

update private.lesson_rules
set phase = 'progressione'
where lesson_id = 'costruzione-occupare-spazi';

do $$
begin
  if not exists (
    select 1
    from private.lesson_rules
    where lesson_id = 'costruzione-occupare-spazi'
      and phase = 'progressione'
      and macro_phase = 'possesso'
      and points = 60
      and minimum_video_percent = 100
      and minimum_quiz_percent = 0
      and active
      and eligible_birth_years = array[2014, 2015]::smallint[]
  ) then
    raise exception 'occupare-spazi lesson was not moved to progressione';
  end if;
end;
$$;

commit;

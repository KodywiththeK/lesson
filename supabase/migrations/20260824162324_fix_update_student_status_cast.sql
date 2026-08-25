create or replace function public.update_student_status(
  p_academy_id uuid,
  p_student_id uuid,
  p_status text,
  p_changed_at timestamptz default now()
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_changed_date date := (p_changed_at at time zone 'Asia/Seoul')::date;
begin
  if not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception 'not allowed';
  end if;

  if p_status not in ('enrolled', 'suspended', 'withdrawn') then
    raise exception 'unsupported student status';
  end if;

  update public.students
  set
    status = p_status::public.student_status,
    suspended_at = case
      when p_status = 'suspended' then p_changed_at
      when p_status = 'enrolled' then null
      else suspended_at
    end,
    withdrawn_at = case
      when p_status = 'withdrawn' then p_changed_at
      when p_status = 'enrolled' then null
      else withdrawn_at
    end
  where academy_id = p_academy_id
    and id = p_student_id;

  if not found then
    raise exception 'student not found';
  end if;

  if p_status in ('suspended', 'withdrawn') then
    update public.lesson_series
    set
      active = false,
      effective_until = greatest(
        effective_from,
        least(coalesce(effective_until, v_changed_date - 1), v_changed_date - 1)
      )
    where academy_id = p_academy_id
      and student_id = p_student_id
      and active = true;

    update public.lesson_events event
    set
      status = 'cancelled',
      deletion_reason = case
        when p_status = 'suspended' then '원생 휴원'
        else '원생 퇴원'
      end,
      deleted_at = coalesce(event.deleted_at, p_changed_at)
    where event.academy_id = p_academy_id
      and event.student_id = p_student_id
      and event.origin = 'regular'
      and event.status = 'scheduled'
      and (event.starts_at at time zone 'Asia/Seoul')::date >= v_changed_date
      and not exists (
        select 1
        from public.attendance_records attendance
        where attendance.academy_id = event.academy_id
          and attendance.lesson_event_id = event.id
      );
  end if;
end;
$$;

revoke all on function public.update_student_status(uuid, uuid, text, timestamptz) from public;
grant execute on function public.update_student_status(uuid, uuid, text, timestamptz) to authenticated;

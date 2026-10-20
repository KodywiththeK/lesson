-- 감사 로그 원본은 owner 전용으로 유지한다. 선택 날짜의 레슨 변경만 owner/desk에게 투영한다.
create function private.audit_lesson_absence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
begin
  if new.status <> 'absent' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_event_type := 'attendance.absent';
  elsif old.status is distinct from 'absent' then
    v_event_type := 'attendance.absent';
  elsif old.absence_reason is distinct from new.absence_reason then
    v_event_type := 'attendance.absence_reason_changed';
  else
    return new;
  end if;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  ) values (
    new.academy_id, (select auth.uid()), v_event_type,
    'attendance_records', new.id::text, new.absence_reason,
    jsonb_build_object('lesson_event_id', new.lesson_event_id, 'student_id', new.student_id)
  );
  return new;
end;
$$;

create trigger attendance_records_audit_absence_change
after insert or update of status, absence_reason on public.attendance_records
for each row execute function private.audit_lesson_absence_change();

create function private.list_lesson_change_history(
  p_academy_id uuid,
  p_lesson_date date,
  p_lesson_kind text
)
returns table (
  id uuid,
  occurred_at timestamptz,
  event_type text,
  student_name text,
  reason text,
  resolution text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '변경 이력을 볼 권한이 없습니다.';
  end if;

  if p_lesson_date is null or p_lesson_kind is null or p_lesson_kind not in ('academy', 'private') then
    raise exception '조회할 날짜와 레슨 종류를 확인해 주세요.';
  end if;

  return query
  select
    event.id,
    event.occurred_at,
    event.event_type,
    student.name as student_name,
    event.reason,
    case when event.event_type = 'absence.resolved'
      and event.metadata->>'resolution' in ('pass', 'makeup')
      then event.metadata->>'resolution'
      else null
    end as resolution
  from public.audit_events as event
  join public.lesson_events as lesson
    on lesson.academy_id = event.academy_id
    and lesson.id::text = case
      when event.entity_table = 'lesson_events' then event.entity_id
      else coalesce(event.metadata->>'source_lesson_event_id', event.metadata->>'lesson_event_id')
    end
  left join public.students as student
    on student.academy_id = lesson.academy_id and student.id = lesson.student_id
  where event.academy_id = p_academy_id
    and event.event_type in (
      'lesson_event.rescheduled',
      'lesson_event.deleted',
      'absence.resolved',
      'attendance.absent',
      'attendance.absence_reason_changed',
      'attendance.reset',
      'attendance.cancelled'
    )
    and (
      (event.entity_table = 'lesson_events' and event.event_type in ('lesson_event.rescheduled', 'lesson_event.deleted'))
      or (event.entity_table = 'attendance_records' and event.event_type in (
        'absence.resolved', 'attendance.absent', 'attendance.absence_reason_changed',
        'attendance.reset', 'attendance.cancelled'
      ))
    )
    and (
      (p_lesson_kind = 'academy' and lesson.lesson_kind in ('academy', 'makeup'))
      or (p_lesson_kind = 'private' and lesson.lesson_kind = 'private')
    )
    and (
      (lesson.starts_at at time zone 'Asia/Seoul')::date = p_lesson_date
      or (event.event_type = 'lesson_event.rescheduled' and event.metadata->>'target_date' = p_lesson_date::text)
    )
  order by event.occurred_at desc, event.id desc;
end;
$$;

revoke all on function private.list_lesson_change_history(uuid, date, text) from public;
revoke all on function private.list_lesson_change_history(uuid, date, text) from anon;
grant execute on function private.list_lesson_change_history(uuid, date, text) to authenticated;

create function public.list_lesson_change_history(
  p_academy_id uuid,
  p_lesson_date date,
  p_lesson_kind text
)
returns table (
  id uuid,
  occurred_at timestamptz,
  event_type text,
  student_name text,
  reason text,
  resolution text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.list_lesson_change_history(p_academy_id, p_lesson_date, p_lesson_kind);
$$;

revoke all on function public.list_lesson_change_history(uuid, date, text) from public;
revoke all on function public.list_lesson_change_history(uuid, date, text) from anon;
grant execute on function public.list_lesson_change_history(uuid, date, text) to authenticated;

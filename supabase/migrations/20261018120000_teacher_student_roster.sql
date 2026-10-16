-- 선생님 계정의 원생 조회 범위 제한 (2026-10-16 원생·선생님·거래처 명세 검토)
--
-- 명세: 선생님은 담당 원생의 이름·악기·요일만 볼 수 있고 연락처·수강료 같은 민감 정보는 볼 수 없다.
-- 1. 선생님 전용 RPC list_students_for_teacher가 이름·악기·요일만 돌려준다.
-- 2. 수강료·할인이 들어 있는 student_instruments(와 요일별 시간 표)는 선생님이 직접 읽지 못하게
--    select 정책을 owner·desk 전용으로 좁힌다. 선생님의 레슨표는 lesson_events의 students(name) 조인만
--    쓰므로 영향이 없고, 레슨원생 검색은 앱이 선생님일 때 이 RPC로 이름만 받도록 바꿨다
--    (fetchLessonWorkspaceData의 canManage=false 경로).
-- 한계: students 표 자체(나이·학년·학교·직업·출석 코드)는 레슨표 조인 때문에 배정된 선생님이
--       계속 읽을 수 있다. 컬럼 단위 차단은 별도 표로 분리해야 하므로 후속 결정 대상이다.

create or replace function public.list_students_for_teacher(p_academy_id uuid)
returns table (
  student_id uuid,
  student_name text,
  instrument_names text[],
  weekdays text[]
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['teacher'::public.academy_member_role]
  ) then
    raise exception '선생님 계정으로만 담당 원생 명단을 볼 수 있습니다.';
  end if;

  return query
  select
    student.id,
    student.name,
    coalesce(
      array_agg(distinct instrument.instrument_name)
        filter (where instrument.instrument_name is not null),
      '{}'
    ),
    coalesce(
      (
        select array_agg(day order by array_position(array['월', '화', '수', '목', '금', '토', '일'], day))
        from (
          select distinct unnest(active_instrument.weekdays) as day
          from public.student_instruments active_instrument
          where active_instrument.academy_id = student.academy_id
            and active_instrument.student_id = student.id
            and active_instrument.active
        ) days
      ),
      '{}'
    )
  from public.students student
  left join public.student_instruments instrument
    on instrument.academy_id = student.academy_id
   and instrument.student_id = student.id
   and instrument.active
  where student.academy_id = p_academy_id
    and student.status = 'enrolled'
    and student.archived_at is null
    and private.teacher_can_access_student(student.academy_id, student.id)
  group by student.academy_id, student.id, student.name
  order by student.name, student.id;
end;
$$;

revoke all on function public.list_students_for_teacher(uuid) from public, anon;
grant execute on function public.list_students_for_teacher(uuid) to authenticated;

drop policy if exists "student_instruments_select_allowed_members" on public.student_instruments;

drop policy if exists "student_instruments_select_owner_desk" on public.student_instruments;

create policy "student_instruments_select_owner_desk"
on public.student_instruments for select
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  )
);

drop policy if exists "student_instrument_weekly_schedules_select_allowed_members" on public.student_instrument_weekly_schedules;

drop policy if exists "student_instrument_weekly_schedules_select_owner_desk" on public.student_instrument_weekly_schedules;

create policy "student_instrument_weekly_schedules_select_owner_desk"
on public.student_instrument_weekly_schedules for select
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  )
);

notify pgrst, 'reload schema';

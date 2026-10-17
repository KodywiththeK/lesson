-- 개인레슨 결석 사유 입력 (2026-10-17 개인레슨 결석인원 후속)
--
-- mark_private_lesson_attendance가 결석 사유를 선택으로 받는다.
-- - 사유를 비우면 기존 문구 '결석 확인'을 쓴다. 100자를 넘기면 거부한다.
-- - 출결 저장과 회차권 처리는 기존 private.mark_private_lesson_attendance_impl에 그대로 맡기고,
--   결석일 때만 처리 뒤에 사유를 갱신한다. 이미 결석인 수업에 다시 호출하면 사유만 바뀌고 회차권은 영향이 없다
--   (impl의 결석 분기는 사용 기록이 없으면 아무것도 하지 않는다).
-- - 선생님(담당 원생)·원장·데스크 권한 검사는 impl과 attendance_records 트리거가 그대로 맡는다.

-- 예전 6인자 시그니처를 지워 사유 검증을 거치지 않는 호출이 남지 않게 한다.
drop function if exists public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz);

create function public.mark_private_lesson_attendance(
  p_academy_id uuid,
  p_lesson_event_id uuid,
  p_student_id uuid,
  p_instrument_id text,
  p_status text,
  p_marked_at timestamptz default now(),
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_reason text := coalesce(nullif(btrim(p_reason), ''), '결석 확인');
begin
  if char_length(v_reason) > 100 then
    raise exception '사유는 100자 이하로 입력해 주세요.';
  end if;

  perform set_config('app.private_ticket_attendance', '1', true);
  perform private.mark_private_lesson_attendance_impl(
    p_academy_id, p_lesson_event_id, p_student_id,
    p_instrument_id, p_status, p_marked_at);

  if p_status = 'absent' then
    update public.attendance_records
    set absence_reason = v_reason
    where academy_id = p_academy_id
      and lesson_event_id = p_lesson_event_id
      and student_id = p_student_id;
  end if;

  perform set_config('app.private_ticket_attendance', '', true);
end;
$$;

revoke all on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz, text)
  from public, anon;
grant execute on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz, text)
  to authenticated;

notify pgrst, 'reload schema';

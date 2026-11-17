-- 회차권 납입일 미정(2026-11-17 학원 피드백): 등록할 때 납입일을 비워 두고 회차권 목록에서 나중에 입력한다.
--   * 새 10인자 등록 RPC에 납입일을 null로 넘기면 '등록' 상태 회차권의 납입일을 비워 둔다.
--     옛 8·9인자 경로와 seed는 지금처럼 기본값 트리거가 등록일을 넣는다(배포 전환 기간 호환).
--   * 납입일 입력·수정은 입금 전(등록·입금대기) 회차권에만 원장·데스크가 한다. 입금 뒤에는 의미가 없어 막는다.
--   * 납입일이 없는 동안 화면은 '납입일 미정'으로 보이고 납입일 경과는 판정하지 않는다.
--     수입 관리에서는 등록일이 속한 달부터 이번 달까지 이월로 보인다(화면 계산).

alter table public.lesson_ticket_grants alter column due_on drop not null;

create or replace function public.register_lesson_ticket(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_instrument_name text, p_granted_count integer, p_valid_days integer,
  p_registered_at date, p_paid_amount integer, p_is_service boolean,
  p_due_on date
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_result jsonb;
begin
  perform set_config('app.defer_ticket_payment', '1', true);
  perform set_config('app.ticket_due_on', coalesce(p_due_on, p_registered_at)::text, true);
  v_result := public.register_lesson_ticket(
    p_academy_id, p_student_id, p_instrument_id, p_instrument_name,
    p_granted_count, p_valid_days, p_registered_at, p_paid_amount, p_is_service);
  perform set_config('app.defer_ticket_payment', '', true);
  perform set_config('app.ticket_due_on', '', true);

  -- 납입일 미정: 입금할 돈이 있는 '등록' 회차권만 비운다(서비스는 바로 입금완료라 납입일이 의미 없다).
  if p_due_on is null and v_result ? 'ticket_id' then
    update public.lesson_ticket_grants set due_on = null
    where academy_id = p_academy_id and id = (v_result->>'ticket_id')::uuid
      and payment_status = 'registered';
    if found then
      v_result := jsonb_set(v_result, '{due_on}', 'null'::jsonb);
    end if;
  end if;

  return v_result;
end;
$$;

create function public.set_lesson_ticket_due_on(
  p_academy_id uuid, p_ticket_id uuid, p_due_on date
) returns public.lesson_ticket_grants language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_previous date;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 관리는 원장과 데스크만 할 수 있습니다.';
  end if;
  if p_due_on is null then raise exception '납입일을 입력해 주세요.'; end if;
  select * into v_ticket from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_ticket.payment_status not in ('registered', 'payment-pending') then
    raise exception '입금 전(등록·입금대기) 회차권만 납입일을 바꿀 수 있습니다.';
  end if;
  v_previous := v_ticket.due_on;
  update public.lesson_ticket_grants set due_on = p_due_on
  where id = v_ticket.id returning * into v_ticket;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values (p_academy_id, (select auth.uid()), 'lesson_ticket.due_on_changed', 'lesson_ticket_grants',
    v_ticket.id::text, jsonb_build_object('previous_due_on', v_previous, 'due_on', p_due_on));
  return v_ticket;
end;
$$;
revoke all on function public.set_lesson_ticket_due_on(uuid, uuid, date) from public, anon;
grant execute on function public.set_lesson_ticket_due_on(uuid, uuid, date) to authenticated;

notify pgrst, 'reload schema';

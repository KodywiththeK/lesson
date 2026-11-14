-- 회차권 입금 상태 2단계(2026-11-14 학원 피드백): 환불·취소를 삭제 대신 상태로 남기고 외상 예정을 막는다.
--   환불(refund)   : 입금대기·입금완료에서. 학원 환불 규정으로 금액을 계산한다. 입금완료면 수입 행을 그만큼 줄이고,
--                    입금대기면(받은 돈이 없음) 수입은 그대로 두고 계산한 금액만 사용취소 이력에 남긴다.
--   취소(mistake)  : 사용 이력이 없을 때 등록·입금대기·입금완료에서. 입금된 수입 행은 지운다('잘못 등록 삭제'를 대신한다).
--   공통           : 회차권 행·등록 이력·사용 이력을 지우지 않고 상태를 바꾸며 잔여를 0으로 만든다(예약·출석에 다시 쓰지 않음).
--                    예약된 일정이 남아 있으면 거부한다. 사용취소 탭 이력은 기존 delete_lesson_ticket 래퍼가 그대로 남긴다.
-- 외상: 새 외상 예정 일정을 막는다. 외상 표·칸·관련 함수의 물리적 제거는 운영 데이터 확인 뒤 별도 정리 migration에서 한다.

create or replace function private.delete_lesson_ticket_without_history(
  p_academy_id uuid, p_ticket_id uuid, p_mode text
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_context record;
  v_refund integer := 0;
  v_left integer;
  v_reduce integer;
  v_registration record;
  v_ledger_changed boolean := false;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권 환불·취소는 원장과 데스크만 할 수 있습니다.';
  end if;
  if p_mode not in ('refund', 'mistake') then
    raise exception '환불 또는 취소를 선택해 주세요.';
  end if;
  select * into v_grant from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾지 못했습니다.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || v_grant.student_id::text || ':' || v_grant.instrument_id, 0));
  if v_grant.payment_status in ('refunded', 'cancelled') then
    raise exception '이미 환불되었거나 취소된 회차권입니다.';
  end if;
  select * into v_context from private.lesson_ticket_refund_context(p_academy_id, p_ticket_id);
  if v_context.total_granted_count < 1 then
    raise exception '유료 회차가 없습니다. 미사용 서비스 회차는 서비스 회수 기능을 사용해 주세요.';
  end if;
  if p_mode = 'refund' and v_grant.payment_status = 'registered' then
    raise exception '등록 상태인 회차권은 환불이 아니라 취소로 처리해 주세요.';
  end if;
  if p_mode = 'mistake' and not v_context.can_delete_as_mistake then
    raise exception '사용한 유료 회차가 있어 취소할 수 없습니다. 환불로 처리해 주세요.';
  end if;
  if private.private_lesson_grant_reserved_count(p_ticket_id) > 0 then
    raise exception '예약된 개인레슨이 있어 환불·취소할 수 없습니다. 일정을 먼저 정리해 주세요.';
  end if;

  perform set_config('app.ledger_rpc', 'lesson-ticket', true);
  if p_mode = 'refund' then
    update public.lesson_ticket_usages set funding_refunded = true
    where academy_id = p_academy_id and lesson_ticket_grant_id = p_ticket_id and funding_kind = 'paid';
    v_refund := greatest(coalesce(v_context.refund_amount, 0), 0);
    -- 받은 돈이 있을 때(입금완료)만 수입 행을 줄인다. 최근 결제부터, 0원이 되면 행을 지운다.
    if v_grant.payment_status = 'paid' and v_refund > 0 then
      v_left := v_refund;
      for v_registration in
        select original_paid_amount, ledger_entry_id
        from public.lesson_ticket_registrations
        where academy_id = p_academy_id and lesson_ticket_grant_id = p_ticket_id and not is_service and refunded_at is null
        order by registered_at desc, created_at desc, id desc
      loop
        exit when v_left <= 0;
        v_reduce := least(v_registration.original_paid_amount, v_left);
        v_left := v_left - v_reduce;
        if v_registration.ledger_entry_id is not null then
          delete from public.ledger_entries
          where academy_id = p_academy_id and id = v_registration.ledger_entry_id
            and source = 'lesson-ticket' and amount <= v_reduce;
          update public.ledger_entries set amount = amount - v_reduce
          where academy_id = p_academy_id and id = v_registration.ledger_entry_id
            and source = 'lesson-ticket' and amount > v_reduce;
          v_ledger_changed := true;
        end if;
      end loop;
    end if;
  else
    -- 취소: 사용하지 않은 회차권이라 입금된 수입 행이 있으면 모두 지운다.
    delete from public.ledger_entries
    where academy_id = p_academy_id and source = 'lesson-ticket'
      and id in (select ledger_entry_id from public.lesson_ticket_registrations
        where academy_id = p_academy_id and lesson_ticket_grant_id = p_ticket_id and not is_service
          and refunded_at is null and ledger_entry_id is not null);
    v_ledger_changed := found;
  end if;
  perform set_config('app.ledger_rpc', '', true);

  update public.lesson_ticket_registrations set refunded_at = now()
  where academy_id = p_academy_id and lesson_ticket_grant_id = p_ticket_id and not is_service and refunded_at is null;

  if v_grant.service_total_count = 0 then
    update public.lesson_ticket_grants
    set payment_status = case when p_mode = 'refund' then 'refunded' else 'cancelled' end,
      remaining_count = 0
    where id = p_ticket_id;
  else
    -- 서비스가 섞인 옛 회차권: 유료분만 정리하고 서비스분은 계속 쓴다. 남은 것은 받을 돈이 없는 서비스분이라 입금완료로 맞춘다.
    update public.lesson_ticket_grants set
      total_granted_count = service_total_count,
      remaining_count = service_remaining_count,
      paid_amount = 0, paid_at = null,
      payment_status = 'paid', payment_method = null,
      valid_until = (select max(valid_until) from public.lesson_ticket_registrations
        where lesson_ticket_grant_id = p_ticket_id and is_service and refunded_at is null)
    where id = p_ticket_id;
  end if;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()),
    case when p_mode = 'refund' then 'lesson_ticket.refunded' else 'lesson_ticket.cancelled' end,
    'lesson_ticket_grants', p_ticket_id::text,
    jsonb_build_object('mode', p_mode, 'previous_status', v_grant.payment_status,
      'paid_total_count', v_context.total_granted_count,
      'paid_remaining_count', v_context.remaining_count,
      'refund_amount', v_refund, 'ledger_changed', v_ledger_changed,
      'service_retained', v_grant.service_total_count)
  );
  return jsonb_build_object('mode', p_mode, 'refunded', v_refund > 0,
    'refund_amount', v_refund, 'ledger_changed', v_ledger_changed);
end;
$$;

-- 외상 예정 일정은 더 이상 만들지 않는다(입금대기 회차권으로 대체).
create or replace function private.reject_private_lesson_credit() returns trigger
language plpgsql set search_path = public, private, pg_temp as $$
begin
  raise exception '외상 예정 등록은 미입금 회차권으로 바뀌었습니다. 회차권을 등록하고 입금대기로 바꾼 뒤 일정을 잡아 주세요.';
end;
$$;
revoke all on function private.reject_private_lesson_credit() from public, anon, authenticated;
create trigger lesson_events_reject_credit
before insert or update of credit_authorized on public.lesson_events
for each row when (new.credit_authorized) execute function private.reject_private_lesson_credit();

notify pgrst, 'reload schema';

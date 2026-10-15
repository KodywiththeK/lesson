-- 회차권 등록·직접 수정 RPC (2026-10-16)
-- 주의: 이 파일은 작성만 되어 있고 원격 DB에는 적용하지 않았다.
--
-- register_lesson_ticket
--   - 사용 기한(일수)으로 만료일을 계산한다(만료일 = 등록일 + 기한).
--   - 같은 원생·악기의 최신 회차권이 있으면 총 부여 회수와 잔여 회수를 합산하고 만료일을 새로 계산한다.
--   - 결제 금액은 선택이다. 0보다 크면 같은 트랜잭션에서 수입 원장에 기록하며 원장(owner)만 입력할 수 있다.
--     병합 시 grant의 결제 금액은 덮어쓰지 않고 누적한다.
-- adjust_lesson_ticket
--   - 부여 회수·잔여 회수·만료일을 직접 수정한다. 사유 필수, 변경 전후를 audit_events에 남기고
--     잔여 회수가 바뀌면 lesson_ticket_adjustments에도 기록한다.

create or replace function public.register_lesson_ticket(
  p_academy_id uuid,
  p_student_id uuid,
  p_instrument_id text,
  p_instrument_name text,
  p_granted_count integer,
  p_valid_days integer,
  p_registered_at date,
  p_paid_amount integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_existing public.lesson_ticket_grants%rowtype;
  v_ticket public.lesson_ticket_grants%rowtype;
  v_valid_until date;
  v_student_name text;
  v_paid integer := coalesce(p_paid_amount, 0);
  v_merged boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '회차권을 등록할 권한이 없습니다.';
  end if;

  if p_granted_count is null or p_granted_count <= 0 then
    raise exception '부여 회수는 1회 이상이어야 합니다.';
  end if;

  if p_valid_days is null or p_valid_days <= 0 then
    raise exception '사용 기한은 1일 이상이어야 합니다.';
  end if;

  if p_valid_days > 3650 then
    raise exception '사용 기한은 3650일 이하로 입력해 주세요.';
  end if;

  if p_registered_at is null then
    raise exception '등록일을 입력해 주세요.';
  end if;

  if v_paid < 0 then
    raise exception '결제 금액은 0원 이상이어야 합니다.';
  end if;

  if v_paid > 0 and not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '결제 금액을 수입으로 기록하는 것은 원장만 할 수 있습니다. 결제 금액을 비우고 등록해 주세요.';
  end if;

  select name
  into v_student_name
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id;

  if not found then
    raise exception '원생 정보를 찾을 수 없습니다.';
  end if;

  v_valid_until := p_registered_at + p_valid_days;

  select *
  into v_existing
  from public.lesson_ticket_grants
  where academy_id = p_academy_id
    and student_id = p_student_id
    and instrument_id = p_instrument_id
  order by valid_until desc, created_at desc
  limit 1
  for update;

  if found then
    v_merged := true;

    update public.lesson_ticket_grants
    set
      total_granted_count = v_existing.total_granted_count + p_granted_count,
      remaining_count = v_existing.remaining_count + p_granted_count,
      valid_from = least(v_existing.valid_from, p_registered_at),
      valid_until = v_valid_until,
      registered_at = p_registered_at,
      paid_amount = v_existing.paid_amount + v_paid,
      paid_at = case when v_paid > 0 then p_registered_at else v_existing.paid_at end
    where id = v_existing.id
      and academy_id = p_academy_id
    returning * into v_ticket;
  else
    insert into public.lesson_ticket_grants (
      academy_id,
      student_id,
      instrument_id,
      instrument_name,
      total_granted_count,
      remaining_count,
      valid_from,
      valid_until,
      registered_at,
      paid_amount,
      paid_at,
      created_by
    )
    values (
      p_academy_id,
      p_student_id,
      p_instrument_id,
      p_instrument_name,
      p_granted_count,
      p_granted_count,
      p_registered_at,
      v_valid_until,
      p_registered_at,
      v_paid,
      case when v_paid > 0 then p_registered_at else null end,
      (select auth.uid())
    )
    returning * into v_ticket;
  end if;

  if v_paid > 0 then
    insert into public.ledger_entries (
      academy_id, occurred_on, entry_type, source, category, amount,
      description, ref_table, ref_id, created_by
    )
    values (
      p_academy_id,
      p_registered_at,
      'income',
      'lesson-ticket',
      'lesson-ticket',
      v_paid,
      v_student_name || ' ' || p_instrument_name || ' 회차권 ' || p_granted_count || '회 구매',
      'lesson_ticket_grants',
      v_ticket.id::text,
      (select auth.uid())
    );
  end if;

  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    reason,
    metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'lesson_ticket.registered',
    'lesson_ticket_grants',
    v_ticket.id::text,
    null,
    jsonb_build_object(
      'merged', v_merged,
      'granted_count', p_granted_count,
      'valid_days', p_valid_days,
      'paid_amount', v_paid
    )
  );

  return jsonb_build_object(
    'ticket_id', v_ticket.id,
    'merged', v_merged,
    'total_granted_count', v_ticket.total_granted_count,
    'remaining_count', v_ticket.remaining_count,
    'valid_from', v_ticket.valid_from,
    'valid_until', v_ticket.valid_until
  );
end;
$$;

revoke all on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer) from public;
revoke all on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer) from anon;
grant execute on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer) to authenticated;

create or replace function public.adjust_lesson_ticket(
  p_academy_id uuid,
  p_ticket_id uuid,
  p_total_granted_count integer,
  p_remaining_count integer,
  p_valid_until date,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_updated public.lesson_ticket_grants%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '회차권을 수정할 권한이 없습니다.';
  end if;

  if v_reason = '' then
    raise exception '수정 사유를 입력해 주세요.';
  end if;

  if p_total_granted_count is null or p_total_granted_count <= 0 then
    raise exception '부여 회수는 1회 이상이어야 합니다.';
  end if;

  if p_remaining_count is null or p_remaining_count < 0 then
    raise exception '잔여 회수는 0회 이상이어야 합니다.';
  end if;

  if p_remaining_count > p_total_granted_count then
    raise exception '잔여 회수는 부여 회수보다 많을 수 없습니다.';
  end if;

  select *
  into v_ticket
  from public.lesson_ticket_grants
  where academy_id = p_academy_id
    and id = p_ticket_id
  for update;

  if not found then
    raise exception '회차권을 찾지 못했습니다.';
  end if;

  if p_valid_until is null or p_valid_until < v_ticket.valid_from then
    raise exception '만료일은 유효 시작일 이후여야 합니다.';
  end if;

  update public.lesson_ticket_grants
  set
    total_granted_count = p_total_granted_count,
    remaining_count = p_remaining_count,
    valid_until = p_valid_until
  where id = v_ticket.id
    and academy_id = p_academy_id
  returning * into v_updated;

  if p_remaining_count <> v_ticket.remaining_count then
    insert into public.lesson_ticket_adjustments (
      academy_id,
      lesson_ticket_grant_id,
      student_id,
      instrument_id,
      previous_remaining_count,
      delta_count,
      next_remaining_count,
      adjustment_reason,
      adjusted_at,
      adjusted_by
    )
    values (
      p_academy_id,
      v_ticket.id,
      v_ticket.student_id,
      v_ticket.instrument_id,
      v_ticket.remaining_count,
      p_remaining_count - v_ticket.remaining_count,
      p_remaining_count,
      v_reason,
      now(),
      (select auth.uid())
    );
  end if;

  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    reason,
    metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'lesson_ticket.adjusted',
    'lesson_ticket_grants',
    v_ticket.id::text,
    v_reason,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'total_granted_count', v_ticket.total_granted_count,
        'remaining_count', v_ticket.remaining_count,
        'valid_until', v_ticket.valid_until
      ),
      'next', jsonb_build_object(
        'total_granted_count', v_updated.total_granted_count,
        'remaining_count', v_updated.remaining_count,
        'valid_until', v_updated.valid_until
      )
    )
  );

  return jsonb_build_object(
    'ticket_id', v_updated.id,
    'total_granted_count', v_updated.total_granted_count,
    'remaining_count', v_updated.remaining_count,
    'valid_until', v_updated.valid_until
  );
end;
$$;

revoke all on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) from public;
revoke all on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) from anon;
grant execute on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) to authenticated;

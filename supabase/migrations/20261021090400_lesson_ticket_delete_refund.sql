-- 회차권 삭제(환불 처리·잘못 등록)와 데스크의 결제 입력 (2026-10-22 제품 결정).
--
-- 규칙
--   - 삭제 방식은 두 가지다. `refund`(환불 처리): 학원 환불 규정(academy_settings)을 검사해 맞으면
--     결제 합계 × 남은 회수 / 부여 회수(원 단위 반올림)를 환불액으로 정하고 연결된 수입 행을 가장 최근 결제부터
--     그만큼 줄인다(0원이 되면 행을 지운다). 규정에 맞지 않으면 회차권만 지우고 수입은 그대로 둔다.
--     `mistake`(잘못 등록): 한 번도 쓰지 않은(회수가 줄지 않고 사용 기록이 없는) 회차권만, 연결된 수입 기록까지 지운다.
--   - 원장과 데스크만 호출한다. 결제 금액은 데스크가 읽을 수 없는 컬럼이라 환불액은 서버가 계산한다(미리보기 RPC).
--   - 회차권을 지우면 등록 이력·수동 조정·사용 이력이 cascade로 함께 지워진다. 확정된 출석 기록(attendance_records)은
--     회차권을 가리키지 않으므로 그대로 남는다.
--   - 데스크가 회차권 등록 때 결제 금액을 입력할 수 있게 된다. 입출입내역 화면은 원장 전용을 유지한다.
--
-- 보안 검토 항목
--   - 원장 쓰기 트리거(private.require_finance_owner_for_ledger)는 원장이 아니면 수입 행 쓰기를 막는다. 데스크가
--     회차권 등록·삭제에서 수입 행을 쓸 수 있도록, 아래 세 조건이 모두 맞을 때만 통과시킨다.
--       1) 같은 트랜잭션 안에서 회차권 RPC가 set_config('app.ledger_rpc', 'lesson-ticket', true)를 켰다.
--       2) 바뀌는 행의 source가 'lesson-ticket'이다(수정·삭제는 기존 행도).
--       3) 호출자가 그 학원의 원장 또는 데스크다.
--     설정은 is_local = true라 트랜잭션이 끝나면 사라지고, RPC가 쓰기 직후 비운다. 브라우저의 직접 쓰기는 RLS(원장 전용)가
--     따로 막는다.

create or replace function private.require_finance_owner_for_ledger()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_academy_id uuid := coalesce(new.academy_id, old.academy_id);
begin
  if (select auth.uid()) is not null
    and not private.has_academy_role(
      v_academy_id,
      array['owner'::public.academy_member_role]
    )
    and not (
      -- 설정이 없으면 current_setting이 NULL이라 조건 전체가 NULL(거짓)이 되어 가드가 풀린다. 빈 문자열로 맞춘다.
      coalesce(current_setting('app.ledger_rpc', true), '') = 'lesson-ticket'
      and (tg_op = 'DELETE' or new.source = 'lesson-ticket')
      and (tg_op = 'INSERT' or old.source = 'lesson-ticket')
      and private.has_academy_role(
        v_academy_id,
        array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
      )
    ) then
    raise exception '수입 관리 권한이 없습니다.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.require_finance_owner_for_ledger() from public;

-- 회차권 등록: 결제 금액 입력을 원장 전용으로 막던 검사를 없애고 수입 행 쓰기 앞뒤로 설정을 켠다.
create or replace function public.register_lesson_ticket(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_instrument_name text, p_granted_count integer, p_valid_days integer,
  p_registered_at date, p_paid_amount integer default 0
)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_existing public.lesson_ticket_grants%rowtype;
  v_ticket public.lesson_ticket_grants%rowtype;
  v_instrument_name text;
  v_student_name text;
  v_valid_until date;
  v_paid integer := coalesce(p_paid_amount, 0);
  v_ledger_id uuid;
  v_merged boolean := false;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권을 등록할 권한이 없습니다.';
  end if;
  if p_granted_count is null or p_granted_count <= 0 then
    raise exception '부여 회수는 1회 이상이어야 합니다.';
  end if;
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 3650 then
    raise exception '사용 기한은 1~3650일로 입력해 주세요.';
  end if;
  if p_registered_at is null then
    raise exception '등록일을 입력해 주세요.';
  end if;
  if v_paid < 0 then
    raise exception '결제 금액은 0원 이상이어야 합니다.';
  end if;

  select student.name, instrument.instrument_name
    into v_student_name, v_instrument_name
  from public.students student
  join public.student_instruments instrument
    on instrument.academy_id = student.academy_id
   and instrument.student_id = student.id
  where student.academy_id = p_academy_id
    and student.id = p_student_id
    and student.status = 'enrolled'
    and instrument.instrument_id = p_instrument_id
    and instrument.lesson_type = 'private'
    and instrument.active;
  if not found then
    raise exception '활성 개인레슨 악기를 찾을 수 없습니다. 원생 수업을 확인해 주세요.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  v_valid_until := p_registered_at + p_valid_days;
  select * into v_existing from public.lesson_ticket_grants
  where academy_id = p_academy_id and student_id = p_student_id
    and instrument_id = p_instrument_id for update;

  if found then
    if p_registered_at < v_existing.registered_at then
      raise exception '등록일은 직전 등록일보다 앞설 수 없습니다.';
    end if;
    if v_existing.total_granted_count > 2147483647 - p_granted_count
      or v_existing.remaining_count > 2147483647 - p_granted_count
      or v_existing.paid_amount > 2147483647 - v_paid then
      raise exception '회차권 수량 또는 금액이 허용 범위를 넘었습니다.';
    end if;
    v_merged := true;
    v_valid_until := greatest(v_existing.valid_until, v_valid_until);
    update public.lesson_ticket_grants set
      total_granted_count = v_existing.total_granted_count + p_granted_count,
      remaining_count = v_existing.remaining_count + p_granted_count,
      valid_until = v_valid_until, registered_at = p_registered_at,
      instrument_name = v_instrument_name,
      paid_amount = v_existing.paid_amount + v_paid,
      paid_at = case when v_paid > 0 then p_registered_at else v_existing.paid_at end
    where id = v_existing.id returning * into v_ticket;
  else
    insert into public.lesson_ticket_grants (
      academy_id, student_id, instrument_id, instrument_name,
      total_granted_count, remaining_count, valid_from, valid_until,
      registered_at, paid_amount, paid_at, created_by
    ) values (
      p_academy_id, p_student_id, p_instrument_id, v_instrument_name,
      p_granted_count, p_granted_count, p_registered_at, v_valid_until,
      p_registered_at, v_paid,
      case when v_paid > 0 then p_registered_at else null end, (select auth.uid())
    ) returning * into v_ticket;
  end if;

  if v_paid > 0 then
    -- 데스크도 결제를 입력할 수 있도록, 이 트랜잭션 안에서만 회차권 수입 행 쓰기를 허용한다.
    perform set_config('app.ledger_rpc', 'lesson-ticket', true);
    insert into public.ledger_entries (
      academy_id, occurred_on, entry_type, source, category, amount,
      description, ref_table, ref_id, created_by
    ) values (
      p_academy_id, p_registered_at, 'income', 'lesson-ticket', 'lesson-ticket',
      v_paid, v_student_name || ' ' || v_instrument_name || ' 회차권 ' || p_granted_count || '회 구매',
      'lesson_ticket_grants', v_ticket.id::text, (select auth.uid())
    ) returning id into v_ledger_id;
    perform set_config('app.ledger_rpc', '', true);
  end if;

  insert into public.lesson_ticket_registrations (
    academy_id, lesson_ticket_grant_id, registered_at, granted_count,
    valid_until, original_paid_amount, ledger_entry_id, created_by
  ) values (
    p_academy_id, v_ticket.id, p_registered_at, p_granted_count,
    v_ticket.valid_until, v_paid, v_ledger_id, (select auth.uid())
  );

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.registered',
    'lesson_ticket_grants', v_ticket.id::text,
    jsonb_build_object('merged', v_merged, 'granted_count', p_granted_count,
      'valid_days', p_valid_days, 'paid_amount', v_paid)
  );

  return jsonb_build_object('ticket_id', v_ticket.id, 'merged', v_merged,
    'total_granted_count', v_ticket.total_granted_count,
    'remaining_count', v_ticket.remaining_count,
    'valid_from', v_ticket.valid_from, 'valid_until', v_ticket.valid_until);
end;
$$;

-- 환불 판정과 환불액. 규정 이름과 경계(절반 이하 = 사용 횟수 × 2 <= 부여 회수)는 앱의
-- src/domain/lesson-ticket-refund.ts와 같다.
create or replace function private.lesson_ticket_refund_quote(
  p_policy text,
  p_total integer,
  p_remaining integer,
  p_paid_total bigint,
  out used_count integer,
  out eligible boolean,
  out refund_amount integer
)
language plpgsql
immutable
as $$
declare
  v_remaining integer := least(greatest(coalesce(p_remaining, 0), 0), greatest(coalesce(p_total, 0), 0));
begin
  used_count := greatest(coalesce(p_total, 0), 0) - v_remaining;
  eligible := case p_policy
    when 'proportional_always' then true
    when 'proportional_until_half' then used_count * 2 <= p_total
    else false
  end;
  refund_amount := case
    when eligible and p_total > 0 and p_paid_total > 0
      then round(p_paid_total::numeric * v_remaining / p_total)::integer
    else 0
  end;
end;
$$;

revoke all on function private.lesson_ticket_refund_quote(text, integer, integer, bigint) from public, anon, authenticated;

-- 사용 이력 확인(회차권 삭제·미리보기)과 회차권 삭제 때의 cascade가 학원 전체 사용 기록을 훑지 않게 한다.
create index if not exists lesson_ticket_usages_grant_idx
on public.lesson_ticket_usages (academy_id, lesson_ticket_grant_id);

-- 미리보기와 삭제가 같은 값을 쓰도록 환불·잘못 등록 판단을 한 곳에서 계산한다(규정 경계가 두 곳에서 갈라지지 않게).
create or replace function private.lesson_ticket_refund_context(
  p_academy_id uuid,
  p_ticket_id uuid,
  out policy text,
  out total_granted_count integer,
  out remaining_count integer,
  out student_id uuid,
  out instrument_id text,
  out used_count integer,
  out eligible boolean,
  out refund_amount integer,
  out can_delete_as_mistake boolean
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_paid_total bigint;
  v_quote record;
begin
  select * into v_ticket
  from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  policy := private.lesson_ticket_refund_policy(p_academy_id);

  select coalesce(sum(registration.original_paid_amount), 0)
  into v_paid_total
  from public.lesson_ticket_registrations registration
  where registration.academy_id = p_academy_id
    and registration.lesson_ticket_grant_id = p_ticket_id;

  select * into v_quote
  from private.lesson_ticket_refund_quote(
    policy, v_ticket.total_granted_count, v_ticket.remaining_count, v_paid_total
  );

  total_granted_count := v_ticket.total_granted_count;
  remaining_count := v_ticket.remaining_count;
  student_id := v_ticket.student_id;
  instrument_id := v_ticket.instrument_id;
  used_count := v_quote.used_count;
  eligible := v_quote.eligible;
  refund_amount := v_quote.refund_amount;
  -- 회수가 줄지 않았고(remaining >= total) 사용 기록도 없을 때만 잘못 등록으로 지울 수 있다. 앱의
  -- canDeleteLessonTicketAsMistake와 같은 규칙이다.
  can_delete_as_mistake := v_ticket.remaining_count >= v_ticket.total_granted_count
    and not exists (
      select 1 from public.lesson_ticket_usages ticket_usage
      where ticket_usage.academy_id = p_academy_id and ticket_usage.lesson_ticket_grant_id = p_ticket_id
    );
end;
$$;

revoke all on function private.lesson_ticket_refund_context(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_lesson_ticket_refund_preview(
  p_academy_id uuid,
  p_ticket_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_context record;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 삭제는 원장과 데스크만 할 수 있습니다.';
  end if;

  select * into v_context from private.lesson_ticket_refund_context(p_academy_id, p_ticket_id);

  return jsonb_build_object(
    'policy', v_context.policy,
    'total_granted_count', v_context.total_granted_count,
    'used_count', v_context.used_count,
    'eligible', v_context.eligible,
    'refund_amount', v_context.refund_amount,
    'can_delete_as_mistake', v_context.can_delete_as_mistake
  );
end;
$$;

revoke all on function public.get_lesson_ticket_refund_preview(uuid, uuid) from public, anon;
grant execute on function public.get_lesson_ticket_refund_preview(uuid, uuid) to authenticated;

create or replace function public.delete_lesson_ticket(
  p_academy_id uuid,
  p_ticket_id uuid,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_context record;
  v_refund integer := 0;
  v_left integer;
  v_reduce integer;
  v_registration record;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 삭제는 원장과 데스크만 할 수 있습니다.';
  end if;

  if p_mode is null or p_mode not in ('refund', 'mistake') then
    raise exception '삭제 방식을 확인해 주세요.';
  end if;

  -- 같은 회차권을 동시에 등록·출석 처리하는 요청과 겹치지 않도록 행을 잠근 뒤 판단한다.
  perform 1
  from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id
  for update;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  select * into v_context from private.lesson_ticket_refund_context(p_academy_id, p_ticket_id);

  -- 수입 행은 두 방식 모두 등록 이력의 ledger_entry_id로 찾는다.
  perform set_config('app.ledger_rpc', 'lesson-ticket', true);

  if p_mode = 'mistake' then
    if not v_context.can_delete_as_mistake then
      raise exception '사용한 회차권은 잘못 등록으로 삭제할 수 없습니다. 환불 처리로 삭제해 주세요.';
    end if;

    delete from public.ledger_entries
    where academy_id = p_academy_id
      and source = 'lesson-ticket'
      and id in (
        select registration.ledger_entry_id
        from public.lesson_ticket_registrations registration
        where registration.academy_id = p_academy_id
          and registration.lesson_ticket_grant_id = p_ticket_id
          and registration.ledger_entry_id is not null
      );
  elsif v_context.refund_amount > 0 then
    v_refund := v_context.refund_amount;
    v_left := v_refund;

    -- 가장 최근 결제부터 거꾸로 환불액만큼 수입 행을 줄인다. 합계가 환불액과 정확히 같다.
    for v_registration in
      select id, original_paid_amount, ledger_entry_id
      from public.lesson_ticket_registrations
      where academy_id = p_academy_id
        and lesson_ticket_grant_id = p_ticket_id
      order by registered_at desc, created_at desc, id desc
    loop
      exit when v_left <= 0;
      continue when v_registration.original_paid_amount <= 0;

      v_reduce := least(v_registration.original_paid_amount, v_left);
      v_left := v_left - v_reduce;

      if v_registration.ledger_entry_id is not null then
        -- 원장은 0원 행을 둘 수 없다. 전액 환불이면 수입 행을 지운다. 지우기를 먼저 해야
        -- 줄인 금액으로 다시 비교하는 일이 없다.
        delete from public.ledger_entries
        where academy_id = p_academy_id
          and id = v_registration.ledger_entry_id
          and source = 'lesson-ticket'
          and amount <= v_reduce;

        update public.ledger_entries
        set amount = amount - v_reduce
        where academy_id = p_academy_id
          and id = v_registration.ledger_entry_id
          and source = 'lesson-ticket'
          and amount > v_reduce;
      end if;
    end loop;
  end if;

  perform set_config('app.ledger_rpc', '', true);

  delete from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.deleted',
    'lesson_ticket_grants', p_ticket_id::text,
    jsonb_build_object(
      'mode', p_mode,
      'policy', v_context.policy,
      'student_id', v_context.student_id,
      'instrument_id', v_context.instrument_id,
      'total_granted_count', v_context.total_granted_count,
      'remaining_count', v_context.remaining_count,
      'refund_amount', v_refund
    )
  );

  return jsonb_build_object(
    'mode', p_mode,
    'refunded', v_refund > 0,
    'refund_amount', v_refund
  );
end;
$$;

revoke all on function public.delete_lesson_ticket(uuid, uuid, text) from public, anon;
grant execute on function public.delete_lesson_ticket(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

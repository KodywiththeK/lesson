-- 기존 회차권의 만료일보다 짧은 재등록으로 유효 기간이 줄지 않도록 한다.

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
  if v_paid > 0 and not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role]) then
    raise exception '결제 금액은 원장만 입력할 수 있습니다.';
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
    insert into public.ledger_entries (
      academy_id, occurred_on, entry_type, source, category, amount,
      description, ref_table, ref_id, created_by
    ) values (
      p_academy_id, p_registered_at, 'income', 'lesson-ticket', 'lesson-ticket',
      v_paid, v_student_name || ' ' || v_instrument_name || ' 회차권 ' || p_granted_count || '회 구매',
      'lesson_ticket_grants', v_ticket.id::text, (select auth.uid())
    ) returning id into v_ledger_id;
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

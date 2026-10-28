-- 회차권 원본은 환불 규칙에 따라 삭제될 수 있으므로 조회에 필요한 당시 정보를 별도로 보존한다.
create table public.lesson_ticket_cancellation_history (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  ticket_id text not null,
  mode text not null check (mode in ('refund', 'mistake')),
  student_name text,
  instrument_name text,
  total_count integer,
  remaining_count integer,
  registered_at date,
  valid_until date,
  refund_amount integer,
  occurred_at timestamptz not null default now(),
  source_audit_id uuid unique
);
create index lesson_ticket_cancellation_history_academy_date_idx
  on public.lesson_ticket_cancellation_history (academy_id, occurred_at desc, id);
alter table public.lesson_ticket_cancellation_history enable row level security;
revoke all on public.lesson_ticket_cancellation_history from public, anon, authenticated;
grant select on public.lesson_ticket_cancellation_history to authenticated;
create policy lesson_ticket_cancellation_history_select on public.lesson_ticket_cancellation_history
  for select to authenticated using (
    private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  );

-- 사용자가 감사 API에 같은 이벤트를 직접 만들어 이력을 위조하지 못하게 한다.
create policy lesson_ticket_audit_events_rpc_only on public.audit_events
  as restrictive for insert to authenticated
  with check (event_type not in ('lesson_ticket.deleted', 'lesson_ticket.paid_refunded'));

-- 이관과 RPC 교체 사이의 삭제가 이력에서 빠지지 않도록 트랜잭션 종료까지 쓰기를 막는다.
lock table public.lesson_ticket_grants in exclusive mode;

-- 기존 감사 이력에는 날짜와 악기명이 없을 수 있다. 복원할 수 없는 값은 NULL로 둔다.
insert into public.lesson_ticket_cancellation_history
  (academy_id, ticket_id, mode, student_name, instrument_name, total_count, remaining_count, refund_amount, occurred_at, source_audit_id)
select audit.academy_id, audit.entity_id, audit.metadata->>'mode', student.name,
  coalesce(grant_row.instrument_name, instrument.instrument_name),
  case when coalesce(audit.metadata->>'total_granted_count', audit.metadata->>'paid_total_count') ~ '^[0-9]+$' then coalesce(audit.metadata->>'total_granted_count', audit.metadata->>'paid_total_count')::integer end,
  case when coalesce(audit.metadata->>'remaining_count', audit.metadata->>'paid_remaining_count') ~ '^[0-9]+$' then coalesce(audit.metadata->>'remaining_count', audit.metadata->>'paid_remaining_count')::integer end,
  case when audit.metadata->>'refund_amount' ~ '^[0-9]+$' then (audit.metadata->>'refund_amount')::integer end,
  audit.occurred_at, audit.id
from public.audit_events audit
left join public.lesson_ticket_grants grant_row on grant_row.academy_id = audit.academy_id and grant_row.id::text = audit.entity_id
left join public.students student on student.academy_id = audit.academy_id and student.id::text = coalesce(audit.metadata->>'student_id', grant_row.student_id::text)
left join lateral (
  select si.instrument_name from public.student_instruments si
  where si.academy_id = audit.academy_id and si.student_id = student.id
    and si.instrument_id = audit.metadata->>'instrument_id'
  order by si.id limit 1
) instrument on true
where audit.event_type in ('lesson_ticket.deleted', 'lesson_ticket.paid_refunded') and audit.metadata->>'mode' in ('refund', 'mistake');

-- 교체 전에 시작해 잠금을 기다리던 기존 RPC도 커밋 후 감사 이벤트를 기록한다.
-- 기존 RPC가 남긴 정보만 이력에 옮기고 새 wrapper가 처리한 이벤트는 중복 기록하지 않는다.
create function private.capture_legacy_ticket_cancellation() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if new.event_type not in ('lesson_ticket.deleted', 'lesson_ticket.paid_refunded')
    or coalesce(new.metadata->>'mode', '') not in ('refund', 'mistake')
    or current_setting('app.ticket_history_wrapped', true) = '1' then
    return new;
  end if;
  insert into public.lesson_ticket_cancellation_history
    (academy_id, ticket_id, mode, student_name, instrument_name, total_count, remaining_count, refund_amount, occurred_at, source_audit_id)
  select new.academy_id, new.entity_id, new.metadata->>'mode', student.name,
    coalesce(grant_row.instrument_name, instrument.instrument_name),
    case when coalesce(new.metadata->>'total_granted_count', new.metadata->>'paid_total_count') ~ '^[0-9]+$' then coalesce(new.metadata->>'total_granted_count', new.metadata->>'paid_total_count')::integer end,
    case when coalesce(new.metadata->>'remaining_count', new.metadata->>'paid_remaining_count') ~ '^[0-9]+$' then coalesce(new.metadata->>'remaining_count', new.metadata->>'paid_remaining_count')::integer end,
    case when new.metadata->>'refund_amount' ~ '^[0-9]+$' then (new.metadata->>'refund_amount')::integer end,
    new.occurred_at, new.id
  from (select 1) singleton
  left join public.lesson_ticket_grants grant_row on grant_row.academy_id = new.academy_id and grant_row.id::text = new.entity_id
  left join public.students student on student.academy_id = new.academy_id and student.id::text = coalesce(new.metadata->>'student_id', grant_row.student_id::text)
  left join lateral (
    select si.instrument_name from public.student_instruments si
    where si.academy_id = new.academy_id and si.student_id = student.id
      and si.instrument_id = new.metadata->>'instrument_id'
    order by si.id limit 1
  ) instrument on true;
  return new;
end;
$$;
revoke all on function private.capture_legacy_ticket_cancellation() from public, anon, authenticated;
create trigger lesson_ticket_legacy_history_capture after insert on public.audit_events
  for each row execute function private.capture_legacy_ticket_cancellation();

-- 모든 회차권 변경 RPC는 같은 원생·악기 범위를 먼저 잠근다.
create function private.lock_lesson_ticket_scope(p_academy_id uuid, p_ticket_id uuid) returns void
language plpgsql set search_path = public, private, pg_temp as $$
declare v_student_id uuid; v_instrument_id text;
begin
  select student_id, instrument_id into v_student_id, v_instrument_id
    from public.lesson_ticket_grants where academy_id = p_academy_id and id = p_ticket_id;
  if not found then raise exception '회차권을 찾지 못했습니다.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || v_student_id::text || ':' || v_instrument_id, 0));
end;
$$;
revoke all on function private.lock_lesson_ticket_scope(uuid, uuid) from public, anon, authenticated;

alter function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) set schema private;
alter function private.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) rename to adjust_lesson_ticket_without_scope_lock;
revoke all on function private.adjust_lesson_ticket_without_scope_lock(uuid, uuid, integer, integer, date, text) from public, anon, authenticated;
create function public.adjust_lesson_ticket(p_academy_id uuid, p_ticket_id uuid, p_total_granted_count integer,
  p_remaining_count integer, p_valid_until date, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권 수정은 원장과 데스크만 할 수 있습니다.';
  end if;
  perform private.lock_lesson_ticket_scope(p_academy_id, p_ticket_id);
  return private.adjust_lesson_ticket_without_scope_lock(p_academy_id, p_ticket_id, p_total_granted_count,
    p_remaining_count, p_valid_until, p_reason);
end;
$$;
revoke all on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) from public, anon;
grant execute on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) to authenticated;

alter function public.revoke_service_lesson_ticket(uuid, uuid, integer, text) set schema private;
alter function private.revoke_service_lesson_ticket(uuid, uuid, integer, text) rename to revoke_service_lesson_ticket_without_scope_lock;
revoke all on function private.revoke_service_lesson_ticket_without_scope_lock(uuid, uuid, integer, text) from public, anon, authenticated;
create function public.revoke_service_lesson_ticket(p_academy_id uuid, p_ticket_id uuid, p_count integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '서비스 회차를 회수할 권한이 없습니다.';
  end if;
  perform private.lock_lesson_ticket_scope(p_academy_id, p_ticket_id);
  return private.revoke_service_lesson_ticket_without_scope_lock(p_academy_id, p_ticket_id, p_count, p_reason);
end;
$$;
revoke all on function public.revoke_service_lesson_ticket(uuid, uuid, integer, text) from public, anon;
grant execute on function public.revoke_service_lesson_ticket(uuid, uuid, integer, text) to authenticated;

alter function public.delete_lesson_ticket(uuid, uuid, text) set schema private;
alter function private.delete_lesson_ticket(uuid, uuid, text) rename to delete_lesson_ticket_without_history;
revoke all on function private.delete_lesson_ticket_without_history(uuid, uuid, text) from public, anon, authenticated;

create function public.delete_lesson_ticket(p_academy_id uuid, p_ticket_id uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_context record;
  v_student_name text;
  v_result jsonb;
  v_student_id uuid;
  v_instrument_id text;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권 삭제는 원장과 데스크만 할 수 있습니다.';
  end if;
  select student_id, instrument_id into v_student_id, v_instrument_id
    from public.lesson_ticket_grants where academy_id = p_academy_id and id = p_ticket_id;
  if not found then raise exception '회차권을 찾지 못했습니다.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || v_student_id::text || ':' || v_instrument_id, 0));
  select * into v_grant from public.lesson_ticket_grants
    where academy_id = p_academy_id and id = p_ticket_id
      and student_id = v_student_id and instrument_id = v_instrument_id for update;
  if not found then raise exception '회차권을 찾지 못했습니다.'; end if;
  select * into v_context from private.lesson_ticket_refund_context(p_academy_id, p_ticket_id);
  select name into v_student_name from public.students where academy_id = p_academy_id and id = v_grant.student_id;
  perform set_config('app.ticket_history_wrapped', '1', true);
  v_result := private.delete_lesson_ticket_without_history(p_academy_id, p_ticket_id, p_mode);
  perform set_config('app.ticket_history_wrapped', '', true);
  insert into public.lesson_ticket_cancellation_history
    (academy_id, ticket_id, mode, student_name, instrument_name, total_count, remaining_count, registered_at, valid_until, refund_amount)
  values (p_academy_id, p_ticket_id::text, p_mode, v_student_name, v_grant.instrument_name,
    v_context.total_granted_count, v_context.remaining_count, v_grant.registered_at, v_grant.valid_until,
    (v_result->>'refund_amount')::integer);
  return v_result;
end;
$$;
revoke all on function public.delete_lesson_ticket(uuid, uuid, text) from public, anon;
grant execute on function public.delete_lesson_ticket(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';

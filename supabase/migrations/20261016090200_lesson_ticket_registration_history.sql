-- 회차권은 원생·악기별 잔액 한 행과 구매/유효기간 이력 여러 행으로 관리한다.
do $$
begin
  if exists (
    select 1 from public.lesson_ticket_grants
    group by academy_id, student_id, instrument_id having count(*) > 1
  ) or exists (
    select 1 from public.lesson_ticket_grants grant_row
    where grant_row.registered_at <> grant_row.valid_from
      or grant_row.valid_until < grant_row.registered_at
      or (select count(*) from public.audit_events event
          where event.academy_id = grant_row.academy_id
            and event.entity_table = 'lesson_ticket_grants'
            and event.entity_id = grant_row.id::text
            and event.event_type = 'lesson_ticket.registered') > 1
      or exists (select 1 from public.lesson_ticket_adjustments adjustment
          where adjustment.academy_id = grant_row.academy_id
            and adjustment.lesson_ticket_grant_id = grant_row.id)
      or (select count(*) from public.ledger_entries ledger
          where ledger.academy_id = grant_row.academy_id
            and ledger.ref_table = 'lesson_ticket_grants'
            and ledger.ref_id = grant_row.id::text
            and ledger.source = 'lesson-ticket') > 1
  ) then
    raise exception '회차권 이력을 안전하게 복원할 수 없습니다. 중복 또는 병합된 기록을 먼저 확인해 주세요.';
  end if;
end;
$$;

alter table public.lesson_ticket_grants
  add constraint lesson_ticket_grants_one_per_instrument
  unique (academy_id, student_id, instrument_id);

create table public.lesson_ticket_registrations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  lesson_ticket_grant_id uuid not null,
  registered_at date not null,
  granted_count integer not null check (granted_count > 0),
  valid_until date not null check (valid_until >= registered_at),
  original_paid_amount integer not null default 0 check (original_paid_amount >= 0),
  ledger_entry_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (academy_id, lesson_ticket_grant_id)
    references public.lesson_ticket_grants (academy_id, id) on delete cascade,
  foreign key (academy_id, ledger_entry_id)
    references public.ledger_entries (academy_id, id)
    on delete set null (ledger_entry_id)
);

create index lesson_ticket_registrations_period_idx
on public.lesson_ticket_registrations (academy_id, lesson_ticket_grant_id, registered_at, valid_until);

insert into public.lesson_ticket_registrations (
  academy_id, lesson_ticket_grant_id, registered_at, granted_count,
  valid_until, original_paid_amount, ledger_entry_id, created_by, created_at
)
select grant_row.academy_id, grant_row.id, grant_row.registered_at,
  grant_row.total_granted_count, grant_row.valid_until, grant_row.paid_amount,
  ledger.id, grant_row.created_by, grant_row.created_at
from public.lesson_ticket_grants grant_row
left join lateral (
  select id from public.ledger_entries
  where academy_id = grant_row.academy_id
    and ref_table = 'lesson_ticket_grants'
    and ref_id = grant_row.id::text
    and source = 'lesson-ticket'
  limit 1
) ledger on true;

alter table public.lesson_ticket_registrations enable row level security;
grant select on public.lesson_ticket_registrations to authenticated;
create policy "lesson_ticket_registrations_select_owner"
on public.lesson_ticket_registrations for select to authenticated
using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role]));

-- 모든 변경은 권한·감사·원장 연결을 검증하는 RPC만 통과한다.
revoke insert, update, delete on public.lesson_ticket_grants from authenticated;
revoke select on public.lesson_ticket_grants from authenticated;
grant select (id, academy_id, student_id, instrument_id, instrument_name,
  total_granted_count, remaining_count, valid_from, valid_until, registered_at)
on public.lesson_ticket_grants to authenticated;
revoke insert, update, delete on public.lesson_ticket_adjustments from authenticated;
revoke insert, update, delete on public.lesson_ticket_usages from authenticated;
revoke delete on public.teachers from authenticated;
revoke truncate on public.teachers, public.students, public.attendance_records,
  public.lesson_ticket_grants, public.lesson_ticket_adjustments,
  public.lesson_ticket_usages from authenticated, anon;
drop policy if exists "lesson_ticket_grants_write_owner_desk" on public.lesson_ticket_grants;
drop policy if exists "lesson_ticket_adjustments_owner_only" on public.lesson_ticket_adjustments;
drop policy if exists "lesson_ticket_usages_insert_owner_desk" on public.lesson_ticket_usages;
create policy "lesson_ticket_adjustments_select_owner_desk"
on public.lesson_ticket_adjustments for select to authenticated
using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

revoke execute on function public.delete_withdrawn_student(uuid, uuid) from authenticated;
revoke execute on function public.delete_resigned_teacher(uuid, uuid) from authenticated;

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

  -- 최초 등록끼리도 같은 범위에서 직렬화한다. unique 제약은 추가 안전망이다.
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
    v_valid_until, v_paid, v_ledger_id, (select auth.uid())
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

revoke all on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer) from public, anon;
grant execute on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer) to authenticated;

create or replace function public.adjust_lesson_ticket(
  p_academy_id uuid, p_ticket_id uuid, p_total_granted_count integer,
  p_remaining_count integer, p_valid_until date, p_reason text
)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_latest public.lesson_ticket_registrations%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권을 수정할 권한이 없습니다.';
  end if;
  if v_reason = '' then
    raise exception '수정 사유를 입력해 주세요.';
  end if;
  if p_total_granted_count is null or p_total_granted_count < 1 then
    raise exception '부여 회수는 1회 이상이어야 합니다.';
  end if;
  if p_remaining_count is null or p_remaining_count < 0
    or p_remaining_count > p_total_granted_count then
    raise exception '잔여 회수는 0회 이상이며 부여 회수를 넘을 수 없습니다.';
  end if;

  select * into v_ticket from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then
    raise exception '회차권을 찾지 못했습니다.';
  end if;
  select * into v_latest from public.lesson_ticket_registrations
  where academy_id = p_academy_id and lesson_ticket_grant_id = p_ticket_id
  order by registered_at desc, created_at desc, id desc limit 1 for update;
  if not found then
    raise exception '회차권 등록 이력을 찾지 못했습니다.';
  end if;
  if p_valid_until is null or p_valid_until < v_latest.registered_at then
    raise exception '만료일은 마지막 등록일 이후여야 합니다.';
  end if;

  update public.lesson_ticket_grants set
    total_granted_count = p_total_granted_count,
    remaining_count = p_remaining_count,
    valid_until = p_valid_until
  where id = p_ticket_id;
  update public.lesson_ticket_registrations set valid_until = p_valid_until
  where id = v_latest.id;

  if p_remaining_count <> v_ticket.remaining_count then
    insert into public.lesson_ticket_adjustments (
      academy_id, lesson_ticket_grant_id, student_id, instrument_id,
      previous_remaining_count, delta_count, next_remaining_count,
      adjustment_reason, adjusted_at, adjusted_by
    ) values (
      p_academy_id, p_ticket_id, v_ticket.student_id, v_ticket.instrument_id,
      v_ticket.remaining_count, p_remaining_count - v_ticket.remaining_count,
      p_remaining_count, v_reason, now(), (select auth.uid())
    );
  end if;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.adjusted',
    'lesson_ticket_grants', p_ticket_id::text, v_reason,
    jsonb_build_object(
      'previous', jsonb_build_object('total_granted_count', v_ticket.total_granted_count,
        'remaining_count', v_ticket.remaining_count, 'valid_until', v_ticket.valid_until),
      'next', jsonb_build_object('total_granted_count', p_total_granted_count,
        'remaining_count', p_remaining_count, 'valid_until', p_valid_until)
    )
  );
  return jsonb_build_object('ticket_id', p_ticket_id,
    'total_granted_count', p_total_granted_count,
    'remaining_count', p_remaining_count, 'valid_until', p_valid_until);
end;
$$;

revoke all on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) from public, anon;
grant execute on function public.adjust_lesson_ticket(uuid, uuid, integer, integer, date, text) to authenticated;

-- 원생의 전체 회차권·결제 정보는 공개하지 않고 담당 악기 잔액만 돌려준다.
create or replace function public.get_assigned_lesson_ticket_balances(p_academy_id uuid)
returns table (student_id uuid, instrument_id text, remaining_count integer, valid_until date)
language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['teacher'::public.academy_member_role]) then
    raise exception '담당 회차권을 조회할 권한이 없습니다.';
  end if;
  return query
  select grant_row.student_id, grant_row.instrument_id,
    grant_row.remaining_count, grant_row.valid_until
  from public.lesson_ticket_grants grant_row
  join public.student_instruments instrument
    on instrument.academy_id = grant_row.academy_id
   and instrument.student_id = grant_row.student_id
   and instrument.instrument_id = grant_row.instrument_id
   and instrument.lesson_type = 'private' and instrument.active
  join public.teachers teacher
    on teacher.academy_id = instrument.academy_id
   and teacher.id = instrument.teacher_id
   and teacher.status <> 'resigned'
  join public.academy_members member
    on member.academy_id = teacher.academy_id
   and member.id = teacher.member_id
  where grant_row.academy_id = p_academy_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
    and member.role = 'teacher';
end;
$$;

revoke all on function public.get_assigned_lesson_ticket_balances(uuid) from public, anon;
grant execute on function public.get_assigned_lesson_ticket_balances(uuid) to authenticated;

-- 출결 RPC의 upsert 전 단계에서 유효기간 공백과 타 악기 선생님의 처리를 거부한다.
create function private.guard_private_ticket_attendance()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_lesson public.lesson_events%rowtype;
  v_lesson_date date;
  v_old_private boolean := false;
begin
  if tg_op = 'UPDATE' then
    select lesson_kind = 'private' into v_old_private
    from public.lesson_events
    where academy_id = old.academy_id and id = old.lesson_event_id;
  end if;
  select * into v_lesson from public.lesson_events
  where academy_id = new.academy_id and id = new.lesson_event_id;
  if tg_op = 'UPDATE' and (coalesce(v_old_private, false)
      or (found and v_lesson.lesson_kind = 'private'))
    and (old.lesson_event_id is distinct from new.lesson_event_id
      or old.student_id is distinct from new.student_id
      or old.academy_id is distinct from new.academy_id) then
    raise exception '개인레슨 출결의 수업·원생은 변경할 수 없습니다. 기존 출결을 취소한 뒤 다시 처리해 주세요.';
  end if;
  if not found or v_lesson.lesson_kind <> 'private' then
    return new;
  end if;

  if current_setting('app.private_ticket_attendance', true) is distinct from '1' then
    raise exception '개인레슨 출결은 출석 확인 기능에서 처리해 주세요.';
  end if;

  if not private.has_academy_role(new.academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
    and not exists (
      select 1 from public.teachers teacher
      join public.academy_members member on member.id = teacher.member_id
        and member.academy_id = teacher.academy_id
      where teacher.academy_id = new.academy_id
        and teacher.id = v_lesson.teacher_id
        and teacher.status <> 'resigned'
        and member.user_id = (select auth.uid())
        and member.role = 'teacher' and member.status = 'active'
    ) then
    raise exception '담당 선생님만 이 수업의 출석을 처리할 수 있습니다.';
  end if;

  if new.status = 'present' and v_lesson.counts_for_ticket then
    v_lesson_date := (v_lesson.starts_at at time zone 'Asia/Seoul')::date;
    if not exists (
      select 1 from public.lesson_ticket_registrations registration
      join public.lesson_ticket_grants grant_row
        on grant_row.academy_id = registration.academy_id
       and grant_row.id = registration.lesson_ticket_grant_id
      where grant_row.academy_id = new.academy_id
        and grant_row.student_id = new.student_id
        and grant_row.instrument_id = v_lesson.instrument_id
        and registration.registered_at <= v_lesson_date
        and registration.valid_until >= v_lesson_date
    ) then
      raise exception '수업 날짜에 사용할 수 있는 회차권이 없습니다. 등록 기간을 확인해 주세요.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_private_ticket_attendance() from public;

-- 학원 수업은 기존 직접 쓰기를 유지하고, 개인레슨만 검증된 RPC 경로로 제한한다.
alter function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz)
  set schema private;
alter function private.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz)
  rename to mark_private_lesson_attendance_impl;
revoke all on function private.mark_private_lesson_attendance_impl(uuid, uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;

create function public.mark_private_lesson_attendance(
  p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid,
  p_instrument_id text, p_status text, p_marked_at timestamptz default now()
)
returns void language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  perform set_config('app.private_ticket_attendance', '1', true);
  perform private.mark_private_lesson_attendance_impl(
    p_academy_id, p_lesson_event_id, p_student_id,
    p_instrument_id, p_status, p_marked_at);
  perform set_config('app.private_ticket_attendance', '', true);
end;
$$;
revoke all on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz)
  from public, anon;
grant execute on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz)
  to authenticated;

create trigger attendance_private_ticket_period
before insert or update on public.attendance_records
for each row execute function private.guard_private_ticket_attendance();

create function private.guard_private_ticket_attendance_delete()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  if exists (
    select 1 from public.lesson_events event
    where event.academy_id = old.academy_id
      and event.id = old.lesson_event_id
      and event.lesson_kind = 'private'
  ) and current_setting('app.private_ticket_attendance', true) is distinct from '1' then
    raise exception '개인레슨 출결은 출석 취소 기능에서 처리해 주세요.';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_private_ticket_attendance_delete() from public;

create trigger attendance_private_ticket_delete
before delete on public.attendance_records
for each row execute function private.guard_private_ticket_attendance_delete();

drop function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text);
create function public.cancel_private_lesson_attendance(
  p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid, p_instrument_id text
)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_attendance public.attendance_records%rowtype;
  v_usage public.lesson_ticket_usages%rowtype;
  v_lesson public.lesson_events%rowtype;
  v_restored boolean := false;
  v_updated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_lesson from public.lesson_events
  where academy_id = p_academy_id and id = p_lesson_event_id
    and student_id = p_student_id and instrument_id = p_instrument_id
    and lesson_kind = 'private' and status = 'scheduled';
  if not found then
    raise exception '개인레슨 일정을 찾지 못했습니다.';
  end if;
  if not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
    and not exists (
      select 1 from public.teachers teacher
      join public.academy_members member
        on member.id = teacher.member_id and member.academy_id = teacher.academy_id
      where teacher.academy_id = p_academy_id and teacher.id = v_lesson.teacher_id
        and teacher.status <> 'resigned'
        and member.user_id = (select auth.uid())
        and member.role = 'teacher' and member.status = 'active'
    ) then
    raise exception '담당 선생님만 이 수업의 출석을 취소할 수 있습니다.';
  end if;

  select * into v_attendance from public.attendance_records
  where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
    and student_id = p_student_id for update;
  if not found then
    return jsonb_build_object('cancelled', false, 'restored_ticket', false);
  end if;
  select * into v_usage from public.lesson_ticket_usages
  where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
    and student_id = p_student_id and instrument_id = p_instrument_id for update;
  if found then
    update public.lesson_ticket_grants
    set remaining_count = least(total_granted_count, remaining_count + v_usage.used_count)
    where academy_id = p_academy_id and id = v_usage.lesson_ticket_grant_id
      and remaining_count < total_granted_count;
    get diagnostics v_updated_count = row_count;
    v_restored := v_updated_count = 1;
    delete from public.lesson_ticket_usages
    where academy_id = p_academy_id and id = v_usage.id;
  end if;
  perform set_config('app.private_ticket_attendance', '1', true);
  delete from public.attendance_records
  where academy_id = p_academy_id and id = v_attendance.id;
  perform set_config('app.private_ticket_attendance', '', true);
  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'attendance.cancelled',
    'attendance_records', v_attendance.id::text, '등원 확인 취소',
    jsonb_build_object('lesson_event_id', p_lesson_event_id,
      'student_id', p_student_id, 'previous_status', v_attendance.status,
      'restored_ticket', v_restored)
  );
  return jsonb_build_object('cancelled', true, 'restored_ticket', v_restored);
end;
$$;

revoke all on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text) to authenticated;

-- 알림 보완(2026-11-28)
-- 1) 본인이 한 변경은 본인에게 푸시하지 않도록 대기열 payload에 actorId를 넣는다.
-- 2) 레슨 변경 알림 범위를 한국 시간 오늘·내일로 넓힌다.
-- 3) 방해 금지 시간(사람마다, 기본 켜짐 22:00~08:00). 판단은 앱 도메인이 하고 DB는 deliver_after만 비교한다.
-- 4) 받은 알림 기록(notification_receipts): 알림함·안 읽음 표시·미룬 푸시를 이 표 하나로 다룬다.
-- 5) 내 설정 조회에 마지막 아침 메일 발송 시각을 더한다.
-- 앱 배포 전에 적용해도 기존 앱이 깨지지 않게, 설정 저장 RPC의 새 인자는 기본값을 둔다.
-- CLI v3는 파일을 트랜잭션으로 감싸지 않아, 중간에 실패하면 이 파일 전체가 되돌아가도록 직접 감싼다.

begin;

-- 3) 방해 금지 설정
alter table public.notification_preferences
  add column quiet_hours_enabled boolean not null default true,
  add column quiet_start time not null default '22:00',
  add column quiet_end time not null default '08:00';

drop function public.get_my_notification_preferences(uuid);

create function public.get_my_notification_preferences(p_academy_id uuid)
returns table (
  email text,
  morning_email boolean,
  push_lesson_change boolean,
  push_consultation boolean,
  push_join_request boolean,
  push_morning_brief boolean,
  quiet_hours_enabled boolean,
  quiet_start text,
  quiet_end text,
  last_morning_email_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '이 작업을 할 권한이 없습니다. 알림 설정은 학원 구성원만 볼 수 있습니다.';
  end if;

  return query
  select
    (select account.email::text from auth.users account where account.id = (select auth.uid())),
    coalesce(preference.morning_email, true),
    coalesce(preference.push_lesson_change, true),
    coalesce(preference.push_consultation, true),
    coalesce(preference.push_join_request, true),
    coalesce(preference.push_morning_brief, true),
    coalesce(preference.quiet_hours_enabled, true),
    to_char(coalesce(preference.quiet_start, '22:00'::time), 'HH24:MI'),
    to_char(coalesce(preference.quiet_end, '08:00'::time), 'HH24:MI'),
    (
      select max(delivery.sent_at)
      from public.morning_brief_deliveries delivery
      where delivery.academy_id = p_academy_id
        and delivery.user_id = (select auth.uid())
        and delivery.channel = 'email'
    )
  from (select 1) as one_row
  left join public.notification_preferences preference
    on preference.academy_id = p_academy_id
   and preference.user_id = (select auth.uid());
end;
$$;

revoke all on function public.get_my_notification_preferences(uuid) from public, anon;
grant execute on function public.get_my_notification_preferences(uuid) to authenticated;

drop function public.set_my_notification_preferences(uuid, boolean, boolean, boolean, boolean, boolean);

-- 방해 금지 인자를 비우면(이전 앱) 저장된 값을 그대로 둔다.
create function public.set_my_notification_preferences(
  p_academy_id uuid,
  p_morning_email boolean,
  p_push_lesson_change boolean,
  p_push_consultation boolean,
  p_push_join_request boolean,
  p_push_morning_brief boolean,
  p_quiet_hours_enabled boolean default null,
  p_quiet_start time default null,
  p_quiet_end time default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '이 작업을 할 권한이 없습니다. 알림 설정은 학원 구성원만 바꿀 수 있습니다.';
  end if;

  if p_quiet_start is not null and p_quiet_start = p_quiet_end then
    raise exception '방해 금지 시작과 끝 시각을 다르게 정해 주세요.';
  end if;

  insert into public.notification_preferences (
    academy_id, user_id, morning_email, push_lesson_change, push_consultation,
    push_join_request, push_morning_brief, quiet_hours_enabled, quiet_start, quiet_end, updated_at
  )
  values (
    p_academy_id, (select auth.uid()),
    coalesce(p_morning_email, true), coalesce(p_push_lesson_change, true), coalesce(p_push_consultation, true),
    coalesce(p_push_join_request, true), coalesce(p_push_morning_brief, true),
    coalesce(p_quiet_hours_enabled, true), coalesce(p_quiet_start, '22:00'), coalesce(p_quiet_end, '08:00'), now()
  )
  on conflict (academy_id, user_id)
  do update set
    morning_email = excluded.morning_email,
    push_lesson_change = excluded.push_lesson_change,
    push_consultation = excluded.push_consultation,
    push_join_request = excluded.push_join_request,
    push_morning_brief = excluded.push_morning_brief,
    quiet_hours_enabled = coalesce(p_quiet_hours_enabled, public.notification_preferences.quiet_hours_enabled),
    quiet_start = coalesce(p_quiet_start, public.notification_preferences.quiet_start),
    quiet_end = coalesce(p_quiet_end, public.notification_preferences.quiet_end),
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_my_notification_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time) from public, anon;
grant execute on function public.set_my_notification_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time) to authenticated;

drop function public.list_notification_recipients(uuid);

create function public.list_notification_recipients(p_academy_id uuid)
returns table (
  user_id uuid,
  role public.academy_member_role,
  teacher_id uuid,
  email text,
  morning_email boolean,
  push_lesson_change boolean,
  push_consultation boolean,
  push_join_request boolean,
  push_morning_brief boolean,
  quiet_hours_enabled boolean,
  quiet_start text,
  quiet_end text
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    member.user_id,
    member.role,
    teacher.id,
    account.email::text,
    coalesce(preference.morning_email, true),
    coalesce(preference.push_lesson_change, true),
    coalesce(preference.push_consultation, true),
    coalesce(preference.push_join_request, true),
    coalesce(preference.push_morning_brief, true),
    coalesce(preference.quiet_hours_enabled, true),
    to_char(coalesce(preference.quiet_start, '22:00'::time), 'HH24:MI'),
    to_char(coalesce(preference.quiet_end, '08:00'::time), 'HH24:MI')
  from public.academy_members member
  left join public.teachers teacher
    on teacher.academy_id = member.academy_id and teacher.member_id = member.id
  left join public.notification_preferences preference
    on preference.academy_id = member.academy_id and preference.user_id = member.user_id
  left join auth.users account
    on account.id = member.user_id
  where member.academy_id = p_academy_id
    and member.status = 'active';
$$;

revoke all on function public.list_notification_recipients(uuid) from public, anon, authenticated;
grant execute on function public.list_notification_recipients(uuid) to service_role;

-- 1)·2) 즉시 알림 트리거: 한 사람(actorId)과 오늘·내일 범위
create or replace function private.enqueue_lesson_change_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_facts record;
begin
  if new.entity_table <> 'lesson_events'
    or new.event_type not in ('lesson_event.rescheduled', 'lesson_event.deleted') then
    return new;
  end if;

  select * into v_facts
  from private.lesson_change_facts(new.academy_id, new.entity_id, new.event_type, new.metadata);

  -- 바뀌기 전이나 후의 레슨이 한국 시간 오늘·내일이면 알린다.
  if not found
    or ((v_facts.previous_starts_at at time zone 'Asia/Seoul')::date not between v_today and v_today + 1
      and (v_facts.next_starts_at is null
        or (v_facts.next_starts_at at time zone 'Asia/Seoul')::date not between v_today and v_today + 1)) then
    return new;
  end if;

  insert into public.notification_outbox (academy_id, kind, payload)
  values (
    new.academy_id,
    'lesson_change',
    jsonb_build_object(
      'changeType', v_facts.change_type,
      'lessonKind', v_facts.lesson_kind,
      'studentName', v_facts.student_name,
      'teacherIds', to_jsonb(v_facts.teacher_ids),
      'previousStartsAt', v_facts.previous_starts_at,
      'nextStartsAt', v_facts.next_starts_at,
      'previousTeacherName', v_facts.previous_teacher_name,
      'nextTeacherName', v_facts.next_teacher_name,
      'actorId', new.actor_id
    )
  );

  return new;
end;
$$;

create or replace function private.enqueue_consultation_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.notification_outbox (academy_id, kind, payload)
  values (new.academy_id, 'consultation', jsonb_build_object('name', new.name, 'actorId', (select auth.uid())));

  return new;
end;
$$;

-- 4) 받은 알림 기록
create table public.notification_receipts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('lesson_change', 'consultation', 'join_request', 'morning_brief')),
  title text not null check (length(title) <= 200),
  body text not null check (length(body) <= 1000),
  url text not null check (url like '/%' and length(url) <= 500),
  -- 같은 사건을 다시 보내도(대기열 재시도) 알림함에 한 번만 남기는 키(대기열 사건 id, 아침 브리핑 날짜).
  source_key text not null check (length(source_key) <= 200),
  created_at timestamptz not null default now(),
  -- 이 시각부터 푸시한다. 방해 금지 중이면 끝나는 시각(앱이 계산).
  deliver_after timestamptz not null default now(),
  pushed_at timestamptz,
  read_at timestamptz,
  unique (academy_id, user_id, source_key)
);

create index notification_receipts_user_created_idx
  on public.notification_receipts (user_id, academy_id, created_at desc);

create index notification_receipts_deferred_idx
  on public.notification_receipts (deliver_after)
  where pushed_at is null;

alter table public.notification_receipts enable row level security;
revoke all on public.notification_receipts from anon, authenticated;

create or replace function public.list_my_notifications(p_academy_id uuid)
returns table (
  id uuid,
  kind text,
  title text,
  body text,
  url text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '이 작업을 할 권한이 없습니다. 알림함은 학원 구성원만 볼 수 있습니다.';
  end if;

  return query
  select receipt.id, receipt.kind, receipt.title, receipt.body, receipt.url, receipt.created_at, receipt.read_at
  from public.notification_receipts receipt
  where receipt.academy_id = p_academy_id
    and receipt.user_id = (select auth.uid())
    and receipt.created_at > now() - interval '30 days'
  order by receipt.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_my_notifications(uuid) from public, anon;
grant execute on function public.list_my_notifications(uuid) to authenticated;

create or replace function public.mark_my_notifications_read(p_academy_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '이 작업을 할 권한이 없습니다. 알림함은 학원 구성원만 볼 수 있습니다.';
  end if;

  update public.notification_receipts
  set read_at = now()
  where academy_id = p_academy_id
    and user_id = (select auth.uid())
    and read_at is null;
end;
$$;

revoke all on function public.mark_my_notifications_read(uuid) from public, anon;
grant execute on function public.mark_my_notifications_read(uuid) to authenticated;

-- 헤더 종 점 표시용. 알림함·읽음 처리와 같은 범위(지금 학원)의 최근 30일 안 읽은 알림 수.
create or replace function public.count_my_unread_notifications(p_academy_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    return 0;
  end if;

  return (
    select count(*)::integer
    from public.notification_receipts receipt
    where receipt.academy_id = p_academy_id
      and receipt.user_id = (select auth.uid())
      and receipt.read_at is null
      and receipt.created_at > now() - interval '30 days'
  );
end;
$$;

revoke all on function public.count_my_unread_notifications(uuid) from public, anon;
grant execute on function public.count_my_unread_notifications(uuid) to authenticated;

-- 때가 된 미룬 푸시를 가져가며 보낸 것으로 표시한다(두 번 보내지 않게). 보내기에 실패해도 알림함에는 남는다.
create or replace function public.claim_due_deferred_receipts(p_limit integer)
returns setof public.notification_receipts
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  return query
  update public.notification_receipts receipt
  set pushed_at = now()
  where receipt.id in (
    select due.id
    from public.notification_receipts due
    where due.pushed_at is null
      and due.deliver_after <= now()
      and due.created_at > now() - interval '30 days'
    order by due.deliver_after
    limit greatest(1, least(coalesce(p_limit, 200), 500))
    for update skip locked
  )
  returning receipt.*;
end;
$$;

revoke all on function public.claim_due_deferred_receipts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_deferred_receipts(integer) to service_role;

-- 대기열 외에 때가 된 미룬 푸시가 있어도 앱을 부른다.
create or replace function private.invoke_notification_dispatch()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if exists (
    select 1 from public.notification_outbox
    where dispatched_at is null and attempts < 5 and created_at > now() - interval '12 hours'
  ) or exists (
    select 1 from public.notification_receipts
    where pushed_at is null and deliver_after <= now() and created_at > now() - interval '30 days'
  ) then
    perform private.invoke_app_route('/api/notifications/dispatch', 10000);
  end if;
end;
$$;

-- 하루 한 번 정리에 30일 지난 받은 알림 기록을 더한다.
create or replace function private.invoke_morning_brief()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  delete from public.notification_outbox
  where dispatched_at is not null and dispatched_at < now() - interval '30 days';
  delete from public.notification_receipts where created_at < now() - interval '30 days';
  delete from public.daily_task_states where updated_at < now() - interval '90 days';
  delete from public.morning_brief_deliveries where claimed_at < now() - interval '90 days';

  perform private.invoke_app_route('/api/cron/morning-brief', 60000);
end;
$$;

notify pgrst, 'reload schema';

commit;

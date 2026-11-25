-- 즉시 알림(푸시) 발송 대기열(2026-11-19)
-- 사건이 일어나면 트리거가 notification_outbox에 적재하고, pg_cron이 1분마다(대기열이 있을 때만)
-- 앱의 발송 주소(/api/notifications/dispatch)를 부른다. 받을 사람·문구는 앱 도메인(`src/domain/notification-dispatch.ts`)이 정한다.
-- 앱 주소와 비밀값은 Supabase Vault의 `app_base_url`, `cron_secret`에서 읽는다(없으면 호출하지 않는다).

create extension if not exists pg_net;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null check (kind in ('lesson_change', 'consultation', 'join_request')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  dispatched_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index notification_outbox_pending_idx
  on public.notification_outbox (created_at)
  where dispatched_at is null;

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

-- 오늘(한국 시간) 레슨의 이동·삭제·선생님 변경. 해석은 오늘 할 일과 같은 `private.lesson_change_facts`를 쓴다.
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

  if not found
    or ((v_facts.previous_starts_at at time zone 'Asia/Seoul')::date <> v_today
      and (v_facts.next_starts_at is null or (v_facts.next_starts_at at time zone 'Asia/Seoul')::date <> v_today)) then
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
      'nextTeacherName', v_facts.next_teacher_name
    )
  );

  return new;
end;
$$;

revoke all on function private.enqueue_lesson_change_notification() from public, anon, authenticated;

create trigger audit_events_enqueue_lesson_change_notification
after insert on public.audit_events
for each row execute function private.enqueue_lesson_change_notification();

create or replace function private.enqueue_consultation_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.notification_outbox (academy_id, kind, payload)
  values (new.academy_id, 'consultation', jsonb_build_object('name', new.name));

  return new;
end;
$$;

revoke all on function private.enqueue_consultation_notification() from public, anon, authenticated;

create trigger consultations_enqueue_notification
after insert on public.consultations
for each row execute function private.enqueue_consultation_notification();

create or replace function private.enqueue_join_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status = 'pending' then
    insert into public.notification_outbox (academy_id, kind, payload)
    values (new.academy_id, 'join_request', jsonb_build_object('applicantName', new.applicant_name));
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_join_request_notification() from public, anon, authenticated;

create trigger academy_join_requests_enqueue_notification
after insert on public.academy_join_requests
for each row execute function private.enqueue_join_request_notification();

-- 발송기가 처리할 대기열을 가져간다. 12시간 지난 사건은 늦은 알림이라 보내지 않는다.
create or replace function public.claim_notification_outbox(p_limit integer)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  return query
  update public.notification_outbox outbox
  set claimed_at = now(), attempts = outbox.attempts + 1
  where outbox.id in (
    select pending.id
    from public.notification_outbox pending
    where pending.dispatched_at is null
      and pending.attempts < 5
      and pending.created_at > now() - interval '12 hours'
      and (pending.claimed_at is null or pending.claimed_at < now() - interval '5 minutes')
    order by pending.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  )
  returning outbox.*;
end;
$$;

revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

-- 오류가 없으면 발송 완료, 있으면 다음 호출에서 다시 시도하도록 잠금을 푼다.
create or replace function public.complete_notification_outbox(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.notification_outbox
  set dispatched_at = case when p_error is null then now() end,
      claimed_at = case when p_error is null then claimed_at end,
      last_error = left(p_error, 500)
  where id = p_id;
end;
$$;

revoke all on function public.complete_notification_outbox(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_notification_outbox(uuid, text) to service_role;

-- 알림·메일 받을 사람 후보(활성 구성원). 설정 행이 없으면 모두 켜진 것으로 본다.
create or replace function public.list_notification_recipients(p_academy_id uuid)
returns table (
  user_id uuid,
  role public.academy_member_role,
  teacher_id uuid,
  email text,
  morning_email boolean,
  push_lesson_change boolean,
  push_consultation boolean,
  push_join_request boolean,
  push_morning_brief boolean
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
    coalesce(preference.push_morning_brief, true)
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

-- 앱의 서버 주소를 부른다. 앱 주소·비밀값은 vault(`app_base_url`, `cron_secret`)에서 읽고, 없으면 부르지 않는다.
create or replace function private.invoke_app_route(p_path text, p_timeout_ms integer)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_base_url text;
  v_secret text;
begin
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';

  if v_base_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_base_url, '/') || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := p_timeout_ms
  );
end;
$$;

revoke all on function private.invoke_app_route(text, integer) from public, anon, authenticated;

-- pg_cron이 1분마다 부른다. 보낼 것이 없으면 아무것도 하지 않는다(오래된 행 정리는 아침 브리핑 작업이 한다).
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
  ) then
    perform private.invoke_app_route('/api/notifications/dispatch', 10000);
  end if;
end;
$$;

revoke all on function private.invoke_notification_dispatch() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'notification-dispatch') then
      perform cron.unschedule('notification-dispatch');
    end if;

    perform cron.schedule(
      'notification-dispatch',
      '* * * * *',
      'select private.invoke_notification_dispatch();'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';

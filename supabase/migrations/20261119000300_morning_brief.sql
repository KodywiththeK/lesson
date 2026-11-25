-- 아침 브리핑 메일·푸시(2026-11-19)
-- pg_cron이 매일 23:00 UTC(한국 08:00)에 앱의 /api/cron/morning-brief를 부른다.
-- 앱은 학원마다 브리핑 원천과 할 일 원천(`get_daily_task_source_for_service`)을 읽어
-- 원장·데스크에게 메일을, 아침 브리핑 푸시를 켠 사람에게 한 줄 푸시를 보낸다.
-- morning_brief_deliveries가 사람·채널별로 하루 한 번만 보내게 막는다.

create table public.morning_brief_deliveries (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  brief_date date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  error text,
  unique (academy_id, brief_date, user_id, channel)
);

alter table public.morning_brief_deliveries enable row level security;
revoke all on public.morning_brief_deliveries from anon, authenticated;

-- 보낼 자리를 먼저 잡는다. 이미 잡혀 있으면(같은 날 이미 보냄) false.
create or replace function public.claim_morning_brief_delivery(
  p_academy_id uuid,
  p_date date,
  p_user_id uuid,
  p_channel text
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.morning_brief_deliveries (academy_id, brief_date, user_id, channel)
  values (p_academy_id, p_date, p_user_id, p_channel)
  on conflict (academy_id, brief_date, user_id, channel) do nothing;

  return found;
end;
$$;

revoke all on function public.claim_morning_brief_delivery(uuid, date, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_morning_brief_delivery(uuid, date, uuid, text) to service_role;

-- 성공하면 발송 기록을 남기고, 실패하면 자리를 비워 다시 실행할 때 보낼 수 있게 한다.
create or replace function public.finish_morning_brief_delivery(
  p_academy_id uuid,
  p_date date,
  p_user_id uuid,
  p_channel text,
  p_provider_id text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_error is null then
    update public.morning_brief_deliveries
    set sent_at = now(), provider_id = p_provider_id, error = null
    where academy_id = p_academy_id and brief_date = p_date and user_id = p_user_id and channel = p_channel;
  else
    delete from public.morning_brief_deliveries
    where academy_id = p_academy_id and brief_date = p_date and user_id = p_user_id and channel = p_channel;
  end if;
end;
$$;

revoke all on function public.finish_morning_brief_delivery(uuid, date, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_morning_brief_delivery(uuid, date, uuid, text, text, text) to service_role;

create or replace function public.list_academies_for_morning_brief()
returns table (academy_id uuid)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select academy.id
  from public.academies academy
  where exists (
    select 1 from public.academy_members member
    where member.academy_id = academy.id and member.status = 'active'
  )
  order by academy.id;
$$;

revoke all on function public.list_academies_for_morning_brief() from public, anon, authenticated;
grant execute on function public.list_academies_for_morning_brief() to service_role;

create or replace function public.get_morning_brief_source_for_service(
  p_academy_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_day_start timestamptz := p_date::timestamp at time zone 'Asia/Seoul';
  v_day_end timestamptz := (p_date + 1)::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object(
    'academyName', (select academy.name from public.academies academy where academy.id = p_academy_id),
    'lessons', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'startsAt', event.starts_at,
          'studentName', student.name,
          'instrumentName', event.instrument_name,
          'teacherId', event.teacher_id,
          'teacherName', teacher.name,
          'lessonKind', case when event.lesson_kind = 'private' then 'private' else 'academy' end,
          'origin', case when event.lesson_kind = 'makeup' then 'makeup' else event.origin end
        ) order by event.starts_at, student.name), '[]'::jsonb)
      from public.lesson_events event
      join public.students student
        on student.academy_id = event.academy_id and student.id = event.student_id
      left join public.teachers teacher
        on teacher.academy_id = event.academy_id and teacher.id = event.teacher_id
      where event.academy_id = p_academy_id
        and event.status = 'scheduled'
        and event.starts_at >= v_day_start
        and event.starts_at < v_day_end
    ),
    'closures', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', closure.id,
          'title', closure.title,
          'startsOn', closure.starts_on,
          'endsOn', closure.ends_on,
          'weekday', closure.weekday,
          'active', closure.active
        )), '[]'::jsonb)
      from public.academy_closures closure
      where closure.academy_id = p_academy_id
        and closure.active
        and closure.starts_on <= p_date
        and closure.ends_on >= p_date
    ),
    'unreadMemoCount', (
      select count(*)
      from public.lesson_calendar_memos memo
      where memo.academy_id = p_academy_id
        and memo.unread
        and memo.memo_date between p_date - 30 and p_date
    ),
    'taskStates', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'taskKey', task_state.task_key,
          'state', task_state.state,
          'updatedByName', null,
          'updatedAt', task_state.updated_at
        )), '[]'::jsonb)
      from public.daily_task_states task_state
      where task_state.academy_id = p_academy_id
    )
  );
end;
$$;

revoke all on function public.get_morning_brief_source_for_service(uuid, date) from public, anon, authenticated;
grant execute on function public.get_morning_brief_source_for_service(uuid, date) to service_role;

-- 하루 한 번: 오래된 기록을 정리한 뒤 앱의 아침 브리핑 주소를 부른다.
-- 정리 대상: 보낸 지 30일 지난 즉시 알림, 90일 지난 할 일 상태(원천이 사라진 키가 쌓이지 않게), 90일 지난 발송 기록.
create or replace function private.invoke_morning_brief()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  delete from public.notification_outbox
  where dispatched_at is not null and dispatched_at < now() - interval '30 days';
  delete from public.daily_task_states where updated_at < now() - interval '90 days';
  delete from public.morning_brief_deliveries where claimed_at < now() - interval '90 days';

  perform private.invoke_app_route('/api/cron/morning-brief', 60000);
end;
$$;

revoke all on function private.invoke_morning_brief() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'morning-brief') then
      perform cron.unschedule('morning-brief');
    end if;

    perform cron.schedule('morning-brief', '0 23 * * *', 'select private.invoke_morning_brief();');
  end if;
end;
$$;

notify pgrst, 'reload schema';

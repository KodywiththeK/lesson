-- 내 알림 설정과 푸시 구독(2026-11-19)
-- - notification_preferences: 사람마다 아침 메일·푸시 항목을 켜고 끈다. 행이 없으면 모두 켜진 것으로 본다.
-- - push_subscriptions: 기기(브라우저)마다 하나. 발송은 서버(service_role)만 읽는다.
-- 두 테이블 모두 브라우저 직접 접근을 막고 본인 것만 다루는 RPC로 읽고 쓴다.
-- CLI v3는 파일을 트랜잭션으로 감싸지 않아, 중간에 실패하면 이 파일 전체가 되돌아가도록 직접 감싼다.

begin;

create table public.notification_preferences (
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  morning_email boolean not null default true,
  push_lesson_change boolean not null default true,
  push_consultation boolean not null default true,
  push_join_request boolean not null default true,
  push_morning_brief boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 2048),
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  user_agent text check (user_agent is null or length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index push_subscriptions_academy_user_idx on public.push_subscriptions (academy_id, user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.get_my_notification_preferences(p_academy_id uuid)
returns table (
  email text,
  morning_email boolean,
  push_lesson_change boolean,
  push_consultation boolean,
  push_join_request boolean,
  push_morning_brief boolean
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
    coalesce(preference.push_morning_brief, true)
  from (select 1) as one_row
  left join public.notification_preferences preference
    on preference.academy_id = p_academy_id
   and preference.user_id = (select auth.uid());
end;
$$;

revoke all on function public.get_my_notification_preferences(uuid) from public, anon;
grant execute on function public.get_my_notification_preferences(uuid) to authenticated;

create or replace function public.set_my_notification_preferences(
  p_academy_id uuid,
  p_morning_email boolean,
  p_push_lesson_change boolean,
  p_push_consultation boolean,
  p_push_join_request boolean,
  p_push_morning_brief boolean
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

  insert into public.notification_preferences (
    academy_id, user_id, morning_email, push_lesson_change, push_consultation,
    push_join_request, push_morning_brief, updated_at
  )
  values (
    p_academy_id, (select auth.uid()),
    coalesce(p_morning_email, true), coalesce(p_push_lesson_change, true), coalesce(p_push_consultation, true),
    coalesce(p_push_join_request, true), coalesce(p_push_morning_brief, true), now()
  )
  on conflict (academy_id, user_id)
  do update set
    morning_email = excluded.morning_email,
    push_lesson_change = excluded.push_lesson_change,
    push_consultation = excluded.push_consultation,
    push_join_request = excluded.push_join_request,
    push_morning_brief = excluded.push_morning_brief,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_my_notification_preferences(uuid, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_my_notification_preferences(uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- 같은 기기를 다른 계정이 쓰면 구독을 현재 계정으로 옮긴다(이전 계정에게 알림이 가지 않게).
create or replace function public.save_push_subscription(
  p_academy_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '이 작업을 할 권한이 없습니다. 알림은 학원 구성원만 받을 수 있습니다.';
  end if;

  insert into public.push_subscriptions (academy_id, user_id, endpoint, p256dh, auth, user_agent)
  values (p_academy_id, (select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500))
  on conflict (endpoint)
  do update set
    academy_id = excluded.academy_id,
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    created_at = now();
end;
$$;

revoke all on function public.save_push_subscription(uuid, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(uuid, text, text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint
    and user_id = (select auth.uid());
end;
$$;

revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;

notify pgrst, 'reload schema';

commit;

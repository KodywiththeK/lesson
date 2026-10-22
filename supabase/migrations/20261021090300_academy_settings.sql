-- 학원 설정(2026-10-22 제품 결정). 학원마다 다른 운영 규정을 한 행에 모은다.
--
-- 지금은 회차권 환불 규정 하나만 담고, 설정이 늘면 같은 테이블에 컬럼을 더한다.
--   none                    환불 불가(기본값). 삭제해도 수입 내역은 그대로 남는다.
--   proportional_until_half 부여 회수의 절반 이하를 썼을 때만 남은 회수 비례 환불.
--   proportional_always     사용 횟수와 상관없이 남은 회수 비례 환불.
--
-- 읽기는 원장만, 쓰기는 원장 전용 RPC만 한다(브라우저 직접 쓰기 권한은 열지 않는다).
-- 설정 행이 없는 학원은 기본값(환불 불가)으로 본다.

create table if not exists public.academy_settings (
  academy_id uuid primary key references public.academies (id) on delete cascade,
  lesson_ticket_refund_policy text not null default 'none'
    check (lesson_ticket_refund_policy in ('none', 'proportional_until_half', 'proportional_always')),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.academy_settings enable row level security;

grant select on public.academy_settings to authenticated;

create policy "academy_settings_select_owner"
on public.academy_settings for select to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

-- 서버 안에서 쓰는 규정 조회. 설정 행이 없으면 환불 불가다.
create or replace function private.lesson_ticket_refund_policy(p_academy_id uuid)
returns text
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(
    (select settings.lesson_ticket_refund_policy
     from public.academy_settings settings
     where settings.academy_id = p_academy_id),
    'none'
  );
$$;

revoke all on function private.lesson_ticket_refund_policy(uuid) from public, anon, authenticated;

create or replace function public.set_lesson_ticket_refund_policy(
  p_academy_id uuid,
  p_policy text
)
returns public.academy_settings
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_previous text;
  v_settings public.academy_settings%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 환불 규정은 원장만 바꿀 수 있습니다.';
  end if;

  if p_policy is null or p_policy not in ('none', 'proportional_until_half', 'proportional_always') then
    raise exception '지원하지 않는 환불 규정입니다.';
  end if;

  v_previous := private.lesson_ticket_refund_policy(p_academy_id);

  insert into public.academy_settings (academy_id, lesson_ticket_refund_policy, updated_by, updated_at)
  values (p_academy_id, p_policy, (select auth.uid()), now())
  on conflict (academy_id) do update set
    lesson_ticket_refund_policy = excluded.lesson_ticket_refund_policy,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_settings;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'academy_settings.lesson_ticket_refund_policy_changed',
    'academy_settings', p_academy_id::text,
    jsonb_build_object('from', v_previous, 'to', p_policy)
  );

  return v_settings;
end;
$$;

revoke all on function public.set_lesson_ticket_refund_policy(uuid, text) from public, anon;
grant execute on function public.set_lesson_ticket_refund_policy(uuid, text) to authenticated;

notify pgrst, 'reload schema';

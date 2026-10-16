-- 상담 기록은 보호자 연락처 성격의 개인정보이므로 원장·데스크만 다루고,
-- 접수일로부터 1년이 지나면 자동으로 완전 삭제한다(앱 조회도 같은 기준으로 한 번 더 거른다).
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null,
  age integer,
  instrument_names text[] not null default '{}',
  phone text not null,
  school text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultations_name_check
    check (char_length(btrim(name)) between 1 and 50),
  constraint consultations_age_check
    check (age is null or age between 0 and 150),
  constraint consultations_phone_check
    check (char_length(phone) <= 30
      and char_length(regexp_replace(phone, '\D', '', 'g')) >= 4),
  constraint consultations_school_check
    check (school is null or char_length(school) <= 100),
  constraint consultations_memo_check
    check (memo is null or char_length(memo) <= 2000),
  constraint consultations_academy_id_id_key unique (academy_id, id)
);

create index consultations_academy_created_idx
on public.consultations (academy_id, created_at desc);

create trigger consultations_set_updated_at
before update on public.consultations
for each row execute function private.set_updated_at();

alter table public.consultations enable row level security;

-- 접수일(created_at)을 고쳐 보관 기간을 늘리거나 다른 학원으로 옮기지 못하도록 쓰기는 컬럼 단위로만 연다.
revoke all on public.consultations from public, anon, authenticated;
grant select, delete on public.consultations to authenticated;
grant insert (academy_id, name, age, instrument_names, phone, school, memo)
  on public.consultations to authenticated;
grant update (name, age, instrument_names, phone, school, memo)
  on public.consultations to authenticated;

create policy "consultations_select_owner_desk"
on public.consultations for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "consultations_insert_owner_desk"
on public.consultations for insert
to authenticated
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "consultations_update_owner_desk"
on public.consultations for update
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "consultations_delete_owner_desk"
on public.consultations for delete
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

-- 보관 기간 1년은 src/domain/consultation.ts의 CONSULTATION_RETENTION_YEARS와 같은 값이다.
create function public.delete_expired_consultations(p_now timestamptz default now())
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.consultations
  where created_at < p_now - interval '1 year';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- 앱 사용자가 아니라 정리 작업(postgres, service_role)만 실행한다.
revoke all on function public.delete_expired_consultations(timestamptz) from public, anon, authenticated;
grant execute on function public.delete_expired_consultations(timestamptz) to service_role;

do $$
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    if exists (
      select 1
      from cron.job
      where jobname = 'lesson-delete-expired-consultations'
    ) then
      perform cron.unschedule('lesson-delete-expired-consultations');
    end if;

    perform cron.schedule(
      'lesson-delete-expired-consultations',
      '0 18 * * *',
      'select public.delete_expired_consultations();'
    );
  end if;
end;
$$;

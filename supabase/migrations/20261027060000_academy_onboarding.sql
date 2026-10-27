alter table public.profiles add column phone text;
alter table public.profiles add constraint profiles_phone_mobile_check
  check (phone is null or phone ~ '^01[016789][0-9]{7,8}$');

create table private.academy_join_secrets (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  join_code_hash text not null unique,
  rotated_at timestamptz not null default now()
);

create table private.academy_join_invites (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz
);
create index academy_join_invites_academy_idx
  on private.academy_join_invites(academy_id, created_at desc);

create table public.academy_join_requests (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  applicant_name text not null,
  applicant_phone text not null,
  source text not null check (source in ('invite', 'code')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (length(btrim(applicant_name)) between 1 and 50),
  check (applicant_phone ~ '^01[016789][0-9]{7,8}$')
);
create unique index academy_join_requests_one_pending
  on public.academy_join_requests(academy_id, user_id) where status = 'pending';
create index academy_join_requests_owner_queue
  on public.academy_join_requests(academy_id, status, created_at desc);
create index academy_join_requests_user_idx
  on public.academy_join_requests(user_id, created_at desc);

alter table public.academy_join_requests enable row level security;
alter table private.academy_join_secrets enable row level security;
alter table private.academy_join_invites enable row level security;
grant select on public.academy_join_requests to authenticated;
create policy academy_join_requests_select_self_or_owner
on public.academy_join_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_academy_role(academy_id, array['owner'::public.academy_member_role])
);
create policy profiles_select_academy_owner
on public.profiles for select to authenticated
using (exists (
  select 1 from public.academy_members m
  where m.user_id = profiles.id and m.status in ('active', 'disabled')
    and private.has_academy_role(m.academy_id, array['owner'::public.academy_member_role])
));

-- 가입과 권한 변경은 검사와 감사 기록을 포함한 RPC에서만 수행한다.
revoke insert, update on public.academy_members from authenticated;
revoke insert on public.academies from authenticated;
create unique index teachers_member_id_unique
  on public.teachers(member_id) where member_id is not null;

create function private.guard_teacher_member_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.member_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.member_id is not distinct from old.member_id then
      return new;
    end if;
  end if;
  if not private.has_academy_role(
    new.academy_id, array['owner'::public.academy_member_role]
  ) then
    raise exception '선생님 계정 연결은 원장만 변경할 수 있습니다.';
  end if;
  if new.member_id is not null then
    if not exists (
      select 1 from public.academy_members m
      where m.id = new.member_id and m.academy_id = new.academy_id
        and m.role = 'teacher' and m.status = 'active'
    ) then
      raise exception '활성 선생님 멤버십이 필요합니다.';
    end if;
    if new.status <> 'employed' then
      raise exception '재직 중인 선생님 기록만 연결할 수 있습니다.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_teacher_member_link() from public;
create trigger teachers_guard_member_link
before insert or update of member_id on public.teachers
for each row execute function private.guard_teacher_member_link();

create function private.disable_teacher_member_on_leave()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('on_leave', 'resigned') and new.member_id is not null then
    update public.academy_members
    set status = 'disabled'
    where id = new.member_id and academy_id = new.academy_id
      and role = 'teacher' and status = 'active';
    insert into public.audit_events
      (academy_id, actor_id, event_type, entity_table, entity_id)
    values
      (new.academy_id, auth.uid(), 'academy_member.disabled_by_teacher_status',
       'academy_members', new.member_id::text);
  end if;
  return new;
end;
$$;
revoke all on function private.disable_teacher_member_on_leave() from public;
create trigger teachers_disable_member_on_leave
after update of status on public.teachers
for each row when (old.status is distinct from new.status)
execute function private.disable_teacher_member_on_leave();

create function private.assert_academy_owner(p_academy_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_academy_role(
    p_academy_id, array['owner'::public.academy_member_role]
  ) then
    raise exception '원장 권한이 필요합니다.';
  end if;
end;
$$;
revoke all on function private.assert_academy_owner(uuid) from public;

create function private.save_join_profile(p_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[[:space:]-]', '', 'g');
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if length(v_name) not between 1 and 50
    or v_phone !~ '^01[016789][0-9]{7,8}$' then
    raise exception '이름과 국내 휴대폰 번호를 확인해 주세요.';
  end if;
  insert into public.profiles(id, display_name, phone)
  values (auth.uid(), v_name, v_phone)
  on conflict (id) do update
  set display_name = excluded.display_name, phone = excluded.phone;
end;
$$;
revoke all on function private.save_join_profile(text, text) from public;

create function public.create_academy_with_owner(
  p_academy_name text, p_name text, p_phone text
)
returns table(academy_id uuid, join_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_academy_id uuid;
  v_code text;
begin
  if length(btrim(coalesce(p_academy_name, ''))) not between 1 and 100 then
    raise exception '학원명을 확인해 주세요.';
  end if;
  perform private.save_join_profile(p_name, p_phone);
  insert into public.academies(name, created_by)
  values (btrim(p_academy_name), auth.uid()) returning id into v_academy_id;
  insert into public.academy_members(academy_id, user_id, role, status)
  values (v_academy_id, auth.uid(), 'owner', 'active');
  v_code := upper(encode(extensions.gen_random_bytes(12), 'hex'));
  insert into private.academy_join_secrets(academy_id, join_code_hash)
  values (v_academy_id, encode(extensions.digest(v_code, 'sha256'), 'hex'));
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (v_academy_id, auth.uid(), 'academy.created', 'academies', v_academy_id::text);
  return query select v_academy_id, v_code;
end;
$$;

create function public.rotate_academy_join_code(p_academy_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  perform private.assert_academy_owner(p_academy_id);
  v_code := upper(encode(extensions.gen_random_bytes(12), 'hex'));
  insert into private.academy_join_secrets(academy_id, join_code_hash, rotated_at)
  values (p_academy_id, encode(extensions.digest(v_code, 'sha256'), 'hex'), now())
  on conflict (academy_id) do update
  set join_code_hash = excluded.join_code_hash, rotated_at = excluded.rotated_at;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (p_academy_id, auth.uid(), 'academy_join_code.rotated', 'academies', p_academy_id::text);
  return v_code;
end;
$$;

create function public.create_academy_join_invite(p_academy_id uuid)
returns table(invite_id uuid, invite_token text)
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_invite_id uuid;
begin
  perform private.assert_academy_owner(p_academy_id);
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.academy_join_invites
    (academy_id, token_hash, created_by, expires_at)
  values
    (p_academy_id, encode(extensions.digest(v_token, 'sha256'), 'hex'),
     auth.uid(), now() + interval '7 days')
  returning id into v_invite_id;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (p_academy_id, auth.uid(), 'academy_invite.created', 'academy_join_invites', v_invite_id::text);
  return query select v_invite_id, v_token;
end;
$$;

create function public.revoke_academy_join_invite(p_academy_id uuid, p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_academy_owner(p_academy_id);
  update private.academy_join_invites set revoked_at = now()
  where id = p_invite_id and academy_id = p_academy_id
    and revoked_at is null and consumed_at is null;
  if not found then raise exception '취소할 초대를 찾지 못했습니다.'; end if;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (p_academy_id, auth.uid(), 'academy_invite.revoked', 'academy_join_invites', p_invite_id::text);
end;
$$;

create function public.list_academy_join_invites(p_academy_id uuid)
returns table(id uuid, created_at timestamptz, expires_at timestamptz,
  consumed_at timestamptz, revoked_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_academy_owner(p_academy_id);
  return query select i.id, i.created_at, i.expires_at, i.consumed_at, i.revoked_at
  from private.academy_join_invites i
  where i.academy_id = p_academy_id
  order by i.created_at desc;
end;
$$;

create function public.submit_academy_join_request(
  p_source text, p_secret text, p_name text, p_phone text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_academy_id uuid;
  v_invite_id uuid;
  v_request_id uuid;
  v_hash text := encode(extensions.digest(
    case when p_source = 'code' then upper(btrim(coalesce(p_secret, '')))
      else coalesce(p_secret, '') end, 'sha256'), 'hex');
begin
  if p_source = 'invite' then
    select id, academy_id into v_invite_id, v_academy_id
    from private.academy_join_invites
    where token_hash = v_hash and consumed_at is null and revoked_at is null
      and expires_at > now()
    for update;
  elsif p_source = 'code' then
    select academy_id into v_academy_id
    from private.academy_join_secrets where join_code_hash = v_hash;
  else
    raise exception '올바른 가입 방법이 아닙니다.';
  end if;
  if v_academy_id is null then raise exception '초대 또는 학원 코드를 확인해 주세요.'; end if;
  if exists (select 1 from public.academy_members
    where academy_id = v_academy_id and user_id = auth.uid()) then
    raise exception '이미 이 학원에 등록된 계정입니다.';
  end if;
  perform private.save_join_profile(p_name, p_phone);
  insert into public.academy_join_requests
    (academy_id, user_id, applicant_name, applicant_phone, source)
  values
    (v_academy_id, auth.uid(), btrim(p_name),
     regexp_replace(p_phone, '[[:space:]-]', '', 'g'), p_source)
  returning id into v_request_id;
  if v_invite_id is not null then
    update private.academy_join_invites set consumed_at = now() where id = v_invite_id;
  end if;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (v_academy_id, auth.uid(), 'academy_join.requested', 'academy_join_requests', v_request_id::text);
  return v_request_id;
end;
$$;

create function public.withdraw_academy_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_academy_id uuid;
begin
  update public.academy_join_requests
  set status = 'withdrawn', decided_at = now()
  where id = p_request_id and user_id = auth.uid() and status = 'pending'
  returning academy_id into v_academy_id;
  if v_academy_id is null then raise exception '철회할 신청이 없습니다.'; end if;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (v_academy_id, auth.uid(), 'academy_join.withdrawn', 'academy_join_requests', p_request_id::text);
end;
$$;

create function public.list_my_academy_join_requests()
returns table(id uuid, academy_id uuid, academy_name text, status text,
  membership_status public.academy_member_status, created_at timestamptz)
language sql security definer set search_path = '' as $$
  select r.id, r.academy_id, a.name, r.status, m.status, r.created_at
  from public.academy_join_requests r
  join public.academies a on a.id = r.academy_id
  left join public.academy_members m
    on m.academy_id = r.academy_id and m.user_id = r.user_id
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

create function public.list_owner_academy_join_requests(p_academy_id uuid)
returns table(id uuid, applicant_name text, applicant_phone text,
  source text, status text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_academy_owner(p_academy_id);
  return query
  select r.id, r.applicant_name, r.applicant_phone,
    r.source, r.status, r.created_at
  from public.academy_join_requests r
  where r.academy_id = p_academy_id
  order by r.created_at desc;
end;
$$;

create function public.list_academy_staff(p_academy_id uuid)
returns table(member_id uuid, display_name text, phone text,
  role public.academy_member_role, status public.academy_member_status,
  teacher_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_academy_owner(p_academy_id);
  return query
  select m.id, p.display_name, p.phone, m.role, m.status, t.id
  from public.academy_members m
  join public.profiles p on p.id = m.user_id
  left join public.teachers t on t.member_id = m.id and t.academy_id = m.academy_id
  where m.academy_id = p_academy_id and m.role in ('desk', 'teacher')
  order by p.display_name, m.id;
end;
$$;

create function public.review_academy_join_request(
  p_request_id uuid, p_approve boolean,
  p_role public.academy_member_role default null, p_teacher_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.academy_join_requests%rowtype;
  v_member_id uuid;
begin
  select * into v_request from public.academy_join_requests
  where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception '처리할 대기 신청이 없습니다.';
  end if;
  perform private.assert_academy_owner(v_request.academy_id);
  if p_approve then
    if p_role is null or p_role not in ('desk', 'teacher') then
      raise exception '직원 역할만 지정할 수 있습니다.';
    end if;
    if (p_role = 'teacher') <> (p_teacher_id is not null) then
      raise exception '선생님 역할에는 인사 기록을 지정해야 합니다.';
    end if;
    if p_role = 'teacher' and not exists (
      select 1 from public.teachers
      where id = p_teacher_id and academy_id = v_request.academy_id
        and status = 'employed' and member_id is null and archived_at is null
    ) then
      raise exception '연결할 재직 선생님 기록을 확인해 주세요.';
    end if;
    insert into public.academy_members(academy_id, user_id, role, status)
    values (v_request.academy_id, v_request.user_id, p_role, 'active')
    returning id into v_member_id;
    if p_role = 'teacher' then
      update public.teachers set member_id = v_member_id
      where id = p_teacher_id and academy_id = v_request.academy_id
        and member_id is null and status = 'employed' and archived_at is null;
      if not found then raise exception '선생님 기록이 이미 연결되었습니다.'; end if;
    end if;
  end if;
  update public.academy_join_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now()
  where id = p_request_id;
  insert into public.audit_events
    (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values
    (v_request.academy_id, auth.uid(),
     case when p_approve then 'academy_join.approved' else 'academy_join.rejected' end,
     'academy_join_requests', p_request_id::text,
     case when p_approve then jsonb_build_object('role', p_role) else '{}'::jsonb end);
  return v_member_id;
end;
$$;

create function public.set_academy_staff_active(p_member_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member public.academy_members%rowtype;
begin
  select * into v_member from public.academy_members where id = p_member_id for update;
  if not found or v_member.role = 'owner' then raise exception '직원 멤버십을 찾지 못했습니다.'; end if;
  perform private.assert_academy_owner(v_member.academy_id);
  if p_active and v_member.role = 'teacher' and not exists (
    select 1 from public.teachers where member_id = p_member_id
      and academy_id = v_member.academy_id and status = 'employed' and archived_at is null
  ) then raise exception '재직 선생님 기록을 확인해 주세요.'; end if;
  update public.academy_members
  set status = case when p_active then 'active'::public.academy_member_status
    else 'disabled'::public.academy_member_status end
  where id = p_member_id;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
  values (v_member.academy_id, auth.uid(),
    case when p_active then 'academy_member.activated' else 'academy_member.disabled' end,
    'academy_members', p_member_id::text);
end;
$$;

create function public.set_academy_staff_role(
  p_member_id uuid, p_role public.academy_member_role, p_teacher_id uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member public.academy_members%rowtype;
begin
  select * into v_member from public.academy_members where id = p_member_id for update;
  if not found or v_member.role = 'owner' or v_member.status <> 'active'
    or p_role is null or p_role not in ('desk', 'teacher') then
    raise exception '변경할 활성 직원 역할을 확인해 주세요.';
  end if;
  perform private.assert_academy_owner(v_member.academy_id);
  if (p_role = 'teacher') <> (p_teacher_id is not null) then
    raise exception '선생님 역할에는 인사 기록을 지정해야 합니다.';
  end if;
  if p_role = 'teacher' and not exists (
    select 1 from public.teachers
    where id = p_teacher_id and academy_id = v_member.academy_id
      and status = 'employed' and archived_at is null
      and (member_id is null or member_id = p_member_id)
  ) then raise exception '연결할 재직 선생님 기록을 확인해 주세요.'; end if;
  update public.teachers set member_id = null
  where academy_id = v_member.academy_id and member_id = p_member_id
    and (p_role = 'desk' or id <> p_teacher_id);
  update public.academy_members set role = p_role where id = p_member_id;
  if p_role = 'teacher' then
    update public.teachers set member_id = p_member_id
    where academy_id = v_member.academy_id and id = p_teacher_id
      and (member_id is null or member_id = p_member_id)
      and status = 'employed' and archived_at is null;
    if not found then raise exception '선생님 기록이 이미 연결되었습니다.'; end if;
  end if;
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values (v_member.academy_id, auth.uid(), 'academy_member.role_changed',
    'academy_members', p_member_id::text,
    jsonb_build_object('from', v_member.role, 'to', p_role));
end;
$$;

revoke all on function public.create_academy_with_owner(text, text, text) from public;
revoke all on function public.rotate_academy_join_code(uuid) from public;
revoke all on function public.create_academy_join_invite(uuid) from public;
revoke all on function public.revoke_academy_join_invite(uuid, uuid) from public;
revoke all on function public.list_academy_join_invites(uuid) from public;
revoke all on function public.submit_academy_join_request(text, text, text, text) from public;
revoke all on function public.withdraw_academy_join_request(uuid) from public;
revoke all on function public.list_my_academy_join_requests() from public;
revoke all on function public.list_owner_academy_join_requests(uuid) from public;
revoke all on function public.list_academy_staff(uuid) from public;
revoke all on function public.review_academy_join_request(uuid, boolean, public.academy_member_role, uuid) from public;
revoke all on function public.set_academy_staff_active(uuid, boolean) from public;
revoke all on function public.set_academy_staff_role(uuid, public.academy_member_role, uuid) from public;
grant execute on function public.create_academy_with_owner(text, text, text) to authenticated;
grant execute on function public.rotate_academy_join_code(uuid) to authenticated;
grant execute on function public.create_academy_join_invite(uuid) to authenticated;
grant execute on function public.revoke_academy_join_invite(uuid, uuid) to authenticated;
grant execute on function public.list_academy_join_invites(uuid) to authenticated;
grant execute on function public.submit_academy_join_request(text, text, text, text) to authenticated;
grant execute on function public.withdraw_academy_join_request(uuid) to authenticated;
grant execute on function public.list_my_academy_join_requests() to authenticated;
grant execute on function public.list_owner_academy_join_requests(uuid) to authenticated;
grant execute on function public.list_academy_staff(uuid) to authenticated;
grant execute on function public.review_academy_join_request(uuid, boolean, public.academy_member_role, uuid) to authenticated;
grant execute on function public.set_academy_staff_active(uuid, boolean) to authenticated;
grant execute on function public.set_academy_staff_role(uuid, public.academy_member_role, uuid) to authenticated;

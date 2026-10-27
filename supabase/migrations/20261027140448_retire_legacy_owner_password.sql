-- 카카오 연결을 확인한 데모 원장이 카카오로 다시 로그인한 뒤에만
-- 공개된 데모 비밀번호 해시를 제거한다. auth.users 행과 학원 데이터는 보존한다.
create function public.retire_legacy_owner_password()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id constant uuid := '11111111-1111-1111-1111-111111111111';
  v_academy_id constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  if auth.uid() is distinct from v_owner_id then
    raise exception '기존 원장 계정에서만 사용할 수 있습니다.';
  end if;

  -- 연결을 시작한 이메일 세션에서는 실행하지 않는다. 일반 카카오 로그인을 새로 마쳐야 한다.
  if not coalesce((auth.jwt() -> 'amr') @> '[{"method":"oauth"}]'::jsonb, false) then
    raise exception '로그아웃한 뒤 카카오로 다시 로그인해 주세요.';
  end if;

  if not exists (
    select 1 from public.academies a
    join public.academy_members m on m.academy_id = a.id
    where a.id = v_academy_id and a.created_by = v_owner_id
      and m.user_id = v_owner_id and m.role = 'owner' and m.status = 'active'
  ) then
    raise exception '기존 학원의 활성 원장 권한을 확인하지 못했습니다.';
  end if;

  if not exists (
    select 1 from auth.identities i
    where i.user_id = v_owner_id and i.provider = 'kakao'
  ) then
    raise exception '같은 계정에 연결된 카카오 인증을 확인하지 못했습니다.';
  end if;

  perform 1 from auth.users u where u.id = v_owner_id for update;
  if not found then
    raise exception '기존 원장 계정을 확인하지 못했습니다.';
  end if;

  update auth.users
  set encrypted_password = null, updated_at = now()
  where id = v_owner_id and encrypted_password is not null;

  if found then
    insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
    values (v_academy_id, v_owner_id, 'auth.legacy_password_retired', 'auth.users', v_owner_id::text);
  end if;

  return true;
end;
$$;

revoke all on function public.retire_legacy_owner_password() from public;
revoke all on function public.retire_legacy_owner_password() from anon;
grant execute on function public.retire_legacy_owner_password() to authenticated;

-- 화면이 해시 제거 완료 여부를 추측하지 않고 DB에서 확인하게 한다.
create function public.legacy_owner_password_removed()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id constant uuid := '11111111-1111-1111-1111-111111111111';
  v_removed boolean;
begin
  if auth.uid() is distinct from v_owner_id then
    raise exception '기존 원장 계정에서만 사용할 수 있습니다.';
  end if;

  select u.encrypted_password is null into v_removed
  from auth.users u where u.id = v_owner_id;
  if not found then
    raise exception '기존 원장 계정을 확인하지 못했습니다.';
  end if;
  return v_removed;
end;
$$;

revoke all on function public.legacy_owner_password_removed() from public;
revoke all on function public.legacy_owner_password_removed() from anon;
grant execute on function public.legacy_owner_password_removed() to authenticated;

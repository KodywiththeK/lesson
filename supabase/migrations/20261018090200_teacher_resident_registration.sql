-- 선생님 주민등록번호 암호화 저장·원장 전용 열람.
--
-- 제품 결정(2026-10-16)
--   - 저장은 암호화하고, 원문 열람은 원장만 한다. 화면 표시는 항상 마스킹('900101-1******')이다.
--   - 암호화 키는 Supabase Vault의 'teacher_rrn_key' 비밀에서 읽고, 코드·migration·브라우저에 키를 두지 않는다.
--   - 원문은 teachers.resident_registration_encrypted_ref(pgp_sym_encrypt 결과를 base64로 인코딩한 text)에,
--     마스킹 값은 teachers.resident_registration_masked에 저장한다.
--   - 저장·열람은 모두 audit_events에 사실만 남긴다(원문·마스킹 값·이름 같은 개인정보는 metadata에 넣지 않는다).
--
-- 적용 환경 의존성
--   - pgcrypto는 20260820142318_tenant_core_schema.sql에서 extensions 스키마에 만들었다.
--   - Vault(vault 스키마, supabase_vault 확장)가 없는 환경에서도 이 migration 전체가 실패하지 않도록 키 생성은 방어한다.
--     키를 만들지 못하면 NOTICE만 남기고, 저장·열람 함수는 호출 때 "암호화 키가 설정되지 않았습니다" 예외를 낸다.

-- 1) Vault 키: 없을 때만 만든다. 이미 있으면 절대 덮어쓰지 않는다(덮어쓰면 기존 암호문을 풀 수 없다).
do $$
begin
  if to_regnamespace('vault') is null then
    raise notice 'vault 스키마가 없어 teacher_rrn_key를 만들지 않았습니다. Vault를 켠 뒤 키를 직접 만들어 주세요.';
    return;
  end if;

  begin
    if exists (select 1 from vault.decrypted_secrets where name = 'teacher_rrn_key') then
      return;
    end if;

    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'teacher_rrn_key',
      '선생님 주민등록번호 암호화 키'
    );
  exception
    when others then
      raise notice 'teacher_rrn_key를 만들지 못했습니다(%). Vault 권한과 pgcrypto를 확인한 뒤 키를 직접 만들어 주세요.', sqlerrm;
  end;
end;
$$;

-- 2) 암호화 키 읽기. 함수 소유자 권한으로만 쓰이며 어떤 API 역할도 직접 실행할 수 없다.
create or replace function private.read_teacher_resident_registration_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  begin
    select secret.decrypted_secret
    into v_key
    from vault.decrypted_secrets secret
    where secret.name = 'teacher_rrn_key';
  exception
    when undefined_table or invalid_schema_name or insufficient_privilege then
      v_key := null;
  end;

  if v_key is null or v_key = '' then
    raise exception '주민등록번호 암호화 키가 설정되지 않았습니다. 관리자에게 Vault의 teacher_rrn_key 설정을 요청해 주세요.';
  end if;

  return v_key;
end;
$$;

-- 3) 저장: 원장 전용. 서버에서도 형식·생년월일·성별 자리를 다시 검증한다.
create or replace function public.set_teacher_resident_registration(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_resident_registration text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_resident_registration, ''), '[^0-9]', '', 'g');
  v_gender text;
  v_century integer;
  v_masked text;
  v_key text;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '주민등록번호는 원장만 등록·수정할 수 있습니다.';
  end if;

  if p_teacher_id is null or length(v_digits) <> 13 then
    raise exception '주민등록번호는 숫자 13자리(######-#######)로 입력해 주세요.';
  end if;

  v_gender := substr(v_digits, 7, 1);
  v_century := case
    when v_gender in ('1', '2', '5', '6') then 1900
    when v_gender in ('3', '4', '7', '8') then 2000
    else null
  end;

  if v_century is null then
    raise exception '주민등록번호 성별 자리(뒤 첫 숫자)는 1~8이어야 합니다.';
  end if;

  begin
    perform make_date(
      v_century + substr(v_digits, 1, 2)::integer,
      substr(v_digits, 3, 2)::integer,
      substr(v_digits, 5, 2)::integer
    );
  exception
    when others then
      raise exception '주민등록번호 앞 6자리가 올바른 생년월일이 아닙니다.';
  end;

  perform 1
  from public.teachers teacher
  where teacher.academy_id = p_academy_id
    and teacher.id = p_teacher_id
  for update;

  if not found then
    raise exception '주민등록번호를 저장할 선생님을 찾지 못했습니다.';
  end if;

  v_key := private.read_teacher_resident_registration_key();
  v_masked := substr(v_digits, 1, 6) || '-' || v_gender || '******';

  update public.teachers
  set
    resident_registration_encrypted_ref = encode(
      extensions.pgp_sym_encrypt(substr(v_digits, 1, 6) || '-' || substr(v_digits, 7), v_key),
      'base64'
    ),
    resident_registration_masked = v_masked
  where academy_id = p_academy_id
    and id = p_teacher_id;

  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    reason,
    metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'teacher.resident_registration_saved',
    'teachers',
    p_teacher_id::text,
    null,
    jsonb_build_object('field', 'resident_registration')
  );

  return v_masked;
end;
$$;

-- 4) 열람: 원장 전용. 호출마다 열람 사실만 audit_events에 남긴다.
create or replace function public.reveal_teacher_resident_registration(
  p_academy_id uuid,
  p_teacher_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_found boolean;
  v_plain text;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '주민등록번호 원문은 원장만 볼 수 있습니다.';
  end if;

  select teacher.resident_registration_encrypted_ref, true
  into v_ref, v_found
  from public.teachers teacher
  where teacher.academy_id = p_academy_id
    and teacher.id = p_teacher_id;

  if v_found is distinct from true then
    raise exception '주민등록번호를 볼 선생님을 찾지 못했습니다.';
  end if;

  if v_ref is null or v_ref = '' then
    raise exception '등록된 주민등록번호가 없습니다.';
  end if;

  begin
    v_plain := extensions.pgp_sym_decrypt(
      decode(v_ref, 'base64'),
      private.read_teacher_resident_registration_key()
    );
  exception
    when others then
      if sqlerrm like '주민등록번호 암호화 키가 설정되지 않았습니다%' then
        raise;
      end if;

      raise exception '주민등록번호를 복호화하지 못했습니다. 암호화 키가 바뀌었는지 관리자에게 문의해 주세요.';
  end;

  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    reason,
    metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'teacher.resident_registration_revealed',
    'teachers',
    p_teacher_id::text,
    null,
    jsonb_build_object('field', 'resident_registration')
  );

  return v_plain;
end;
$$;

-- 5) 주민등록번호 컬럼은 위 RPC(함수 소유자 권한)로만 바꾼다.
-- teachers 쓰기 RLS는 원장·데스크 모두에게 열려 있으므로, API 역할(authenticated·anon)의 직접 insert/update로
-- 암호문이나 마스킹 값을 바꾸지 못하게 막는다.
create or replace function private.guard_teacher_resident_registration_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (
      new.resident_registration_encrypted_ref is distinct from
        case when tg_op = 'UPDATE' then old.resident_registration_encrypted_ref end
      or new.resident_registration_masked is distinct from
        case when tg_op = 'UPDATE' then old.resident_registration_masked end
    ) then
    raise exception '주민등록번호는 전용 입력 기능으로만 저장할 수 있습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists teachers_guard_resident_registration on public.teachers;

create trigger teachers_guard_resident_registration
before insert or update on public.teachers
for each row execute function private.guard_teacher_resident_registration_columns();

revoke all on function private.read_teacher_resident_registration_key() from public;
revoke all on function private.read_teacher_resident_registration_key() from anon;
revoke all on function private.read_teacher_resident_registration_key() from authenticated;

revoke all on function private.guard_teacher_resident_registration_columns() from public;
revoke all on function private.guard_teacher_resident_registration_columns() from anon;

revoke all on function public.set_teacher_resident_registration(uuid, uuid, text) from public;
revoke all on function public.set_teacher_resident_registration(uuid, uuid, text) from anon;
grant execute on function public.set_teacher_resident_registration(uuid, uuid, text) to authenticated;

revoke all on function public.reveal_teacher_resident_registration(uuid, uuid) from public;
revoke all on function public.reveal_teacher_resident_registration(uuid, uuid) from anon;
grant execute on function public.reveal_teacher_resident_registration(uuid, uuid) to authenticated;

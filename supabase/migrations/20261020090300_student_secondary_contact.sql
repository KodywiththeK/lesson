-- 두 번째 연락처는 원생 등록·수정과 같은 트랜잭션에서 처리한다.
revoke delete on public.student_contacts from authenticated;

create function public.register_student_with_contacts(
  p_academy_id uuid,
  p_name text,
  p_registered_on date,
  p_age integer,
  p_grade text,
  p_school text,
  p_occupation text,
  p_contact_relationship text,
  p_contact_phone text,
  p_secondary_contact jsonb,
  p_enrollments jsonb
)
returns uuid
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_student_id uuid;
  v_relationship text := nullif(btrim(coalesce(p_secondary_contact ->> 'relationship', '')), '');
  v_phone text := nullif(btrim(coalesce(p_secondary_contact ->> 'phone', '')), '');
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생을 등록할 권한이 없습니다.';
  end if;

  if p_secondary_contact is not null and jsonb_typeof(p_secondary_contact) <> 'object' then
    raise exception '두 번째 연락처를 다시 확인해 주세요.';
  end if;
  if (v_relationship is null) <> (v_phone is null)
    or (v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) < 4) then
    raise exception '두 번째 연락처의 구분과 번호를 함께 입력해 주세요.';
  end if;

  v_student_id := public.register_student_with_enrollments(
    p_academy_id, p_name, p_registered_on, p_age, p_grade, p_school,
    p_occupation, p_contact_relationship, p_contact_phone, p_enrollments
  );

  if v_relationship is not null then
    insert into public.student_contacts (
      academy_id, student_id, relationship, phone, phone_last4, created_at
    ) values (
      p_academy_id, v_student_id, v_relationship, v_phone,
      right(regexp_replace(v_phone, '\D', '', 'g'), 4), clock_timestamp()
    );
  end if;

  return v_student_id;
end;
$$;

revoke all on function public.register_student_with_contacts(
  uuid, text, date, integer, text, text, text, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.register_student_with_contacts(
  uuid, text, date, integer, text, text, text, text, text, jsonb, jsonb
) to authenticated;

create function public.update_student_with_contacts(
  p_academy_id uuid,
  p_student_id uuid,
  p_name text,
  p_basic jsonb,
  p_instruments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_result jsonb;
  v_secondary_id uuid;
  v_relationship text;
  v_phone text;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생 정보를 수정할 권한이 없습니다.';
  end if;

  if p_basic is not null then
    v_relationship := nullif(btrim(coalesce(p_basic ->> 'secondary_contact_relationship', '')), '');
    v_phone := nullif(btrim(coalesce(p_basic ->> 'secondary_contact_phone', '')), '');
    if (v_relationship is null) <> (v_phone is null)
      or (v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) < 4) then
      raise exception '두 번째 연락처의 구분과 번호를 함께 입력해 주세요.';
    end if;
  end if;

  v_result := public.update_student_with_enrollments(
    p_academy_id, p_student_id, p_name, p_basic, p_instruments
  );

  if p_basic is null
    or (not (p_basic ? 'secondary_contact_relationship')
      and not (p_basic ? 'secondary_contact_phone')) then
    return v_result;
  end if;

  select id into v_secondary_id
  from public.student_contacts
  where academy_id = p_academy_id and student_id = p_student_id
  order by created_at, id
  offset 1 limit 1;

  if v_relationship is null then
    if v_secondary_id is not null then
      delete from public.student_contacts
      where academy_id = p_academy_id and student_id = p_student_id and id = v_secondary_id;
    end if;
  elsif v_secondary_id is null then
    insert into public.student_contacts (
      academy_id, student_id, relationship, phone, phone_last4, created_at
    ) values (
      p_academy_id, p_student_id, v_relationship, v_phone,
      right(regexp_replace(v_phone, '\D', '', 'g'), 4), clock_timestamp()
    );
  else
    update public.student_contacts
    set relationship = v_relationship,
        phone = v_phone,
        phone_last4 = right(regexp_replace(v_phone, '\D', '', 'g'), 4)
    where academy_id = p_academy_id and student_id = p_student_id and id = v_secondary_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

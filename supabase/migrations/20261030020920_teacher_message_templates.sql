create table public.teacher_message_templates (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, id)
);
create index teacher_message_templates_academy_idx on public.teacher_message_templates (academy_id, created_at, id) where active;
alter table public.teacher_message_templates enable row level security;
revoke all on public.teacher_message_templates from public, anon, authenticated;
grant select on public.teacher_message_templates to authenticated;
create policy teacher_message_templates_owner_read on public.teacher_message_templates for select to authenticated
  using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create function public.save_teacher_message_template(p_academy_id uuid, p_id uuid, p_title text, p_content text)
returns public.teacher_message_templates language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_result public.teacher_message_templates%rowtype; v_field text;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '문자 템플릿은 원장만 관리할 수 있습니다.';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or length(p_title) > 100
    or nullif(btrim(coalesce(p_content, '')), '') is null or length(p_content) > 10000 then
    raise exception '템플릿 이름과 내용을 확인해 주세요.';
  end if;
  for v_field in select matches[1] from regexp_matches(p_content, '\{([^{}]+)\}', 'g') matches loop
    if v_field not in ('선생님', '월', '악기', '수업횟수', '정산총액', '원천징수액', '실수령액', '학생별내역') then
      raise exception '지원하지 않는 변수가 있습니다: %', v_field;
    end if;
  end loop;
  if p_id is null then
    insert into public.teacher_message_templates (academy_id, title, content)
      values (p_academy_id, btrim(p_title), p_content) returning * into v_result;
  else
    update public.teacher_message_templates set title = btrim(p_title), content = p_content, updated_at = now()
      where academy_id = p_academy_id and id = p_id and active returning * into v_result;
    if not found then raise exception '수정할 템플릿을 찾지 못했습니다.'; end if;
  end if;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id)
    values (p_academy_id, (select auth.uid()), 'teacher_message_template.updated', 'teacher_message_templates', v_result.id::text);
  return v_result;
end;
$$;
revoke all on function public.save_teacher_message_template(uuid, uuid, text, text) from public, anon;
grant execute on function public.save_teacher_message_template(uuid, uuid, text, text) to authenticated;

create function public.archive_teacher_message_template(p_academy_id uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '문자 템플릿은 원장만 관리할 수 있습니다.';
  end if;
  update public.teacher_message_templates set active = false, updated_at = now()
    where academy_id = p_academy_id and id = p_id and active;
  if not found then raise exception '삭제할 템플릿을 찾지 못했습니다.'; end if;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id)
    values (p_academy_id, (select auth.uid()), 'teacher_message_template.archived', 'teacher_message_templates', p_id::text);
end;
$$;
revoke all on function public.archive_teacher_message_template(uuid, uuid) from public, anon;
grant execute on function public.archive_teacher_message_template(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';

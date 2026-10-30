-- 과거 snapshot의 소개 할인은 추정하지 않는다. NULL은 당시 구성을 모른다는 뜻이다.
alter table public.fixed_income_snapshots add column referral_discount_applied integer
  check (referral_discount_applied is null or referral_discount_applied >= 0);

create function private.record_snapshot_referral_discount() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_instrument public.student_instruments%rowtype; v_referral integer;
begin
  select * into v_instrument from public.student_instruments
    where academy_id = new.academy_id and id = new.student_instrument_id
      and student_id = new.student_id and instrument_id = new.instrument_id;
  if not found then return new; end if;
  v_referral := case when to_char(v_instrument.referral_discount_month, 'YYYY-MM') = new.month
    then least(v_instrument.referral_discount_amount, v_instrument.final_monthly_fee) else 0 end;
  if new.lesson_fee = v_instrument.lesson_fee
    and new.discount_total = v_instrument.discount_total + v_referral
    and new.amount = v_instrument.final_monthly_fee - v_referral then
    new.referral_discount_applied := v_referral;
  end if;
  return new;
end;
$$;
revoke all on function private.record_snapshot_referral_discount() from public, anon, authenticated;
create trigger fixed_income_snapshot_referral_capture before insert on public.fixed_income_snapshots
  for each row execute function private.record_snapshot_referral_discount();

-- 월 생성은 학생 행을 먼저 잠가 원생 수정과 동일한 순서를 사용한다.
alter function public.ensure_monthly_fixed_income_snapshots(uuid, text) set schema private;
alter function private.ensure_monthly_fixed_income_snapshots(uuid, text) rename to ensure_monthly_fixed_income_snapshots_without_student_lock;
revoke all on function private.ensure_monthly_fixed_income_snapshots_without_student_lock(uuid, text) from public, anon, authenticated;
create function public.ensure_monthly_fixed_income_snapshots(p_academy_id uuid, p_month text)
returns setof public.fixed_income_snapshots language plpgsql security definer
set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role]) then
    raise exception '월별 수강료 조회 권한이 없습니다.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  perform 1 from public.students where academy_id = p_academy_id and status = 'enrolled'
    order by id for update;
  return query select * from private.ensure_monthly_fixed_income_snapshots_without_student_lock(p_academy_id, p_month);
end;
$$;
revoke all on function public.ensure_monthly_fixed_income_snapshots(uuid, text) from public, anon;
grant execute on function public.ensure_monthly_fixed_income_snapshots(uuid, text) to authenticated;

create function private.student_discount_snapshot_sync() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_today_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_referral_changed boolean;
  v_snapshot public.fixed_income_snapshots%rowtype;
  v_recurring integer;
  v_referral integer;
  v_label text;
begin
  if old.lesson_type <> 'academy' or new.lesson_type <> 'academy' or
    (old.discount_total is not distinct from new.discount_total
     and old.discount_label is not distinct from new.discount_label
     and old.discount_kinds is not distinct from new.discount_kinds
     and old.referral_discount_month is not distinct from new.referral_discount_month
     and old.referral_discount_amount is not distinct from new.referral_discount_amount) then
    return new;
  end if;
  v_referral_changed := old.referral_discount_month is distinct from new.referral_discount_month
    or old.referral_discount_amount is distinct from new.referral_discount_amount
    or ('referral' = any(old.discount_kinds)) is distinct from ('referral' = any(new.discount_kinds));

  for v_snapshot in select * from public.fixed_income_snapshots
    where academy_id = new.academy_id and student_id = new.student_id
      and student_instrument_id = new.id and instrument_id = new.instrument_id
      and status in ('unpaid', 'overdue')
      and (month = v_today_month or (v_referral_changed and month in
        (to_char(old.referral_discount_month, 'YYYY-MM'), to_char(new.referral_discount_month, 'YYYY-MM'))))
    order by month, id for update
  loop
    -- 같은 잠금을 기다리는 입금이 먼저 완료되면 READ COMMITTED에서 잠금 후 재검사한다.
    if v_snapshot.status not in ('unpaid', 'overdue') then continue; end if;
    if v_snapshot.referral_discount_applied is null then
      perform set_config('app.discount_snapshot_warning', '1', true);
      continue;
    end if;
    v_recurring := case when v_snapshot.month = v_today_month then new.discount_total
      else v_snapshot.discount_total - v_snapshot.referral_discount_applied end;
    v_referral := case when to_char(new.referral_discount_month, 'YYYY-MM') = v_snapshot.month
      then least(new.referral_discount_amount, greatest(v_snapshot.lesson_fee - v_recurring, 0)) else 0 end;
    v_label := case when v_snapshot.month = v_today_month then new.discount_label else v_snapshot.discount_label end;
    if v_referral = 0 then
      v_label := nullif(array_to_string(array_remove(string_to_array(v_label, ', '), '지인 소개 할인'), ', '), '');
    elsif v_snapshot.month <> v_today_month and (v_label is null or not ('지인 소개 할인' = any(string_to_array(v_label, ', ')))) then
      v_label := concat_ws(', ', v_label, '지인 소개 할인');
    end if;
    update public.fixed_income_snapshots set discount_total = v_recurring + v_referral,
      amount = greatest(v_snapshot.lesson_fee - v_recurring - v_referral, 0),
      discount_label = v_label, referral_discount_applied = v_referral
    where id = v_snapshot.id and academy_id = new.academy_id and status in ('unpaid', 'overdue');
    insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
    values (new.academy_id, (select auth.uid()), 'tuition.discount_synced', 'fixed_income_snapshots', v_snapshot.id::text,
      jsonb_build_object('month', v_snapshot.month, 'previous_amount', v_snapshot.amount,
        'amount', greatest(v_snapshot.lesson_fee - v_recurring - v_referral, 0)));
  end loop;
  return new;
end;
$$;
revoke all on function private.student_discount_snapshot_sync() from public, anon, authenticated;
create trigger student_discount_snapshot_sync after update of discount_total, discount_label, discount_kinds,
  referral_discount_month, referral_discount_amount on public.student_instruments
  for each row execute function private.student_discount_snapshot_sync();

alter function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb) set schema private;
alter function private.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb) rename to update_student_with_contacts_without_discount_notice;
revoke all on function private.update_student_with_contacts_without_discount_notice(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
create function public.update_student_with_contacts(p_academy_id uuid, p_student_id uuid, p_name text, p_basic jsonb, p_instruments jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '원생 정보를 수정할 권한이 없습니다.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  perform set_config('app.discount_snapshot_warning', '', true);
  v_result := private.update_student_with_contacts_without_discount_notice(p_academy_id, p_student_id, p_name, p_basic, p_instruments);
  return v_result || jsonb_build_object('discount_snapshot_warning', current_setting('app.discount_snapshot_warning', true) = '1');
end;
$$;
revoke all on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';

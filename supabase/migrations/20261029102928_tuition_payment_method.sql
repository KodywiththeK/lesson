alter table public.fixed_income_snapshots add column payment_method text
  check (payment_method is null or payment_method in ('card', 'cash', 'transfer', 'remote'));
revoke insert, update, delete on public.fixed_income_snapshots from authenticated;

alter function public.mark_fixed_income_snapshot_paid(uuid, uuid, date) set schema private;
alter function private.mark_fixed_income_snapshot_paid(uuid, uuid, date) rename to mark_fixed_income_snapshot_paid_without_method;
revoke all on function private.mark_fixed_income_snapshot_paid_without_method(uuid, uuid, date) from public, anon, authenticated;

create function public.mark_fixed_income_snapshot_paid(
  p_academy_id uuid, p_snapshot_id uuid, p_paid_at date, p_payment_method text
) returns public.fixed_income_snapshots language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_snapshot public.fixed_income_snapshots%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '수강료 입금 처리 권한이 없습니다.';
  end if;
  if p_payment_method is null or p_payment_method not in ('card', 'cash', 'transfer', 'remote') then
    raise exception '결제 방식을 선택해 주세요.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  v_snapshot := private.mark_fixed_income_snapshot_paid_without_method(p_academy_id, p_snapshot_id, p_paid_at);
  update public.fixed_income_snapshots set payment_method = p_payment_method
    where academy_id = p_academy_id and id = p_snapshot_id returning * into v_snapshot;
  return v_snapshot;
end;
$$;
revoke all on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text) from public, anon;
grant execute on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text) to authenticated;

alter function public.mark_fixed_income_snapshot_unpaid(uuid, uuid) set schema private;
alter function private.mark_fixed_income_snapshot_unpaid(uuid, uuid) rename to mark_fixed_income_snapshot_unpaid_without_method;
revoke all on function private.mark_fixed_income_snapshot_unpaid_without_method(uuid, uuid) from public, anon, authenticated;
create function public.mark_fixed_income_snapshot_unpaid(p_academy_id uuid, p_snapshot_id uuid)
returns public.fixed_income_snapshots language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_snapshot public.fixed_income_snapshots%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '수강료 입금 취소 권한이 없습니다.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  v_snapshot := private.mark_fixed_income_snapshot_unpaid_without_method(p_academy_id, p_snapshot_id);
  update public.fixed_income_snapshots set payment_method = null
    where academy_id = p_academy_id and id = p_snapshot_id returning * into v_snapshot;
  return v_snapshot;
end;
$$;
revoke all on function public.mark_fixed_income_snapshot_unpaid(uuid, uuid) from public, anon;
grant execute on function public.mark_fixed_income_snapshot_unpaid(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';

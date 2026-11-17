-- 옛 4인자 입금 RPC 정리.
-- 20261117000000_card_fee에서 6인자 입금 RPC(카드 수수료 기록)를 더하면서 배포 전환 기간용으로 4인자를 남겼다.
-- 4인자가 public에 남아 있으면 직접 호출로 "카드사 선택 필수" 검사를 건너뛸 수 있으므로,
-- 본문을 그대로 private으로 옮겨(이름 변경) 앱에서 부를 수 없게 하고 6인자가 옮긴 함수를 부르게 한다.
-- 새 앱(6인자 사용)이 배포된 뒤에 적용한다.

begin;

alter function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text) set schema private;
alter function private.mark_fixed_income_snapshot_paid(uuid, uuid, date, text)
  rename to mark_fixed_income_snapshot_paid_without_card_fee;
revoke all on function private.mark_fixed_income_snapshot_paid_without_card_fee(uuid, uuid, date, text)
  from public, anon, authenticated;

alter function public.mark_lesson_ticket_paid(uuid, uuid, date, text) set schema private;
alter function private.mark_lesson_ticket_paid(uuid, uuid, date, text)
  rename to mark_lesson_ticket_paid_without_card_fee;
revoke all on function private.mark_lesson_ticket_paid_without_card_fee(uuid, uuid, date, text)
  from public, anon, authenticated;

-- 수강료 입금 + 카드 수수료. 권한·잠금·검증은 옮긴 private 함수가 한다.
create or replace function public.mark_fixed_income_snapshot_paid(
  p_academy_id uuid, p_snapshot_id uuid, p_paid_at date, p_payment_method text,
  p_card_fee_rate_id uuid, p_card_fee_amount integer
) returns public.fixed_income_snapshots language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_snapshot public.fixed_income_snapshots%rowtype;
begin
  v_snapshot := private.mark_fixed_income_snapshot_paid_without_card_fee(p_academy_id, p_snapshot_id, p_paid_at, p_payment_method);
  perform private.record_card_fee(
    p_academy_id, v_snapshot.paid_ledger_entry_id, p_payment_method, p_card_fee_rate_id, p_card_fee_amount);
  return v_snapshot;
end;
$$;
revoke all on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text, uuid, integer) from public, anon;
grant execute on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text, uuid, integer) to authenticated;

-- 회차권 입금 + 카드 수수료. 데스크도 쓰므로 회차권 원장 가드 설정을 켜고 수입과 같은 source로 기록한다.
create or replace function public.mark_lesson_ticket_paid(
  p_academy_id uuid, p_ticket_id uuid, p_paid_on date, p_payment_method text,
  p_card_fee_rate_id uuid, p_card_fee_amount integer
) returns public.lesson_ticket_grants language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_income_id uuid;
begin
  v_ticket := private.mark_lesson_ticket_paid_without_card_fee(p_academy_id, p_ticket_id, p_paid_on, p_payment_method);
  select ledger_entry_id into v_income_id from public.lesson_ticket_registrations
  where academy_id = p_academy_id and lesson_ticket_grant_id = v_ticket.id
    and not is_service and refunded_at is null and ledger_entry_id is not null
  order by registered_at desc, created_at desc limit 1;
  perform set_config('app.ledger_rpc', 'lesson-ticket', true);
  perform private.record_card_fee(p_academy_id, v_income_id, p_payment_method, p_card_fee_rate_id, p_card_fee_amount);
  perform set_config('app.ledger_rpc', '', true);
  return v_ticket;
end;
$$;
revoke all on function public.mark_lesson_ticket_paid(uuid, uuid, date, text, uuid, integer) from public, anon;
grant execute on function public.mark_lesson_ticket_paid(uuid, uuid, date, text, uuid, integer) to authenticated;

commit;

notify pgrst, 'reload schema';

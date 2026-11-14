import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000300_lesson_ticket_payment_status.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("회차권 입금 상태 migration 계약", () => {
  it("환불·취소된 회차권은 다음 등록일 검사와 선생님 잔여 조회에서 빼고 쓸 수 없는 '등록'도 잔여에 넣지 않는다", () => {
    expect(body("private.register_lesson_ticket_impl")).toContain("grant_row.payment_status not in ('refunded', 'cancelled')");
    expect(body("public.get_assigned_lesson_ticket_balances")).toContain("grant_row.payment_status in ('payment-pending', 'paid')");
  });

  it("회차권에 상태 5개·납입일·결제 방식을 두고 기존 회차권은 입금완료·등록일 납입일로 채운다", () => {
    expect(sql).toContain("add column payment_status text not null default 'paid'");
    expect(sql).toContain("check (payment_status in ('registered', 'payment-pending', 'paid', 'refunded', 'cancelled'))");
    expect(sql).toContain("add column due_on date");
    expect(sql).toContain("update public.lesson_ticket_grants set due_on = registered_at where due_on is null");
    expect(sql).toContain("alter column due_on set not null");
    expect(sql).toContain("alter column payment_status set default 'registered'");
    expect(sql).toContain("payment_method text check (payment_method in ('card', 'cash', 'transfer', 'remote'))");
    expect(sql).toContain("grant select (payment_status, due_on, payment_method, legacy_merged) on public.lesson_ticket_grants to authenticated");
  });

  it("납입일 없이 만드는 회차권은 등록일을 납입일로 채운다", () => {
    expect(sql).toContain("before insert on public.lesson_ticket_grants");
    expect(sql).toContain("new.due_on := coalesce(new.due_on, new.registered_at)");
  });

  it("예약·출석에 쓸 수 있는 회차는 입금대기·입금완료 회차권뿐이다(등록 상태는 사용 불가)", () => {
    const fn = body("private.private_lesson_grant_available_count");

    expect(fn).toContain("grant_row.payment_status not in ('payment-pending', 'paid') then 0");
  });

  it("새 등록 RPC는 유료 회차권을 수입 기록 없이 '등록'으로 시작하고 서비스는 바로 입금완료다", () => {
    const impl = body("private.register_lesson_ticket_impl");
    const register = body("public.register_lesson_ticket");

    expect(impl).toContain("app.defer_ticket_payment");
    expect(impl).toMatch(/v_defer[\s\S]*'registered'/);
    expect(register).toContain("p_due_on date");
    expect(register).toContain("set_config('app.defer_ticket_payment', '1', true)");
    expect(register).toContain("coalesce(p_due_on, p_registered_at)");
  });

  it("입금 처리·입금대기 시작·입금 취소는 원장·데스크가 상태 전이 규칙대로만 할 수 있다", () => {
    const start = body("public.start_lesson_ticket_payment_wait");
    const pay = body("public.mark_lesson_ticket_paid");
    const cancel = body("public.cancel_lesson_ticket_payment");

    for (const fn of [start, pay, cancel]) {
      expect(fn).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
      expect(fn).toContain("for update");
    }
    expect(start).toContain("payment_status <> 'registered'");
    expect(pay).toContain("payment_status <> 'payment-pending'");
    expect(cancel).toContain("payment_status <> 'paid'");
  });

  it("여러 유료 구매가 합쳐진 이전 회차권은 표시해 두고 입금 취소를 거부한다", () => {
    expect(sql).toContain("add column legacy_merged boolean not null default false");
    expect(sql).toMatch(/set legacy_merged = true[\s\S]*not registration\.is_service and registration\.refunded_at is null\) > 1/);
    expect(body("public.cancel_lesson_ticket_payment")).toContain("if v_ticket.legacy_merged then");
  });

  it("입금 처리는 입금일·결제 방식을 받아 수입 행을 만들고, 입금 취소는 그 행을 지운다", () => {
    const pay = body("public.mark_lesson_ticket_paid");
    const cancel = body("public.cancel_lesson_ticket_payment");

    expect(pay).toContain("p_payment_method not in ('card', 'cash', 'transfer', 'remote')");
    expect(pay).toContain("insert into public.ledger_entries");
    expect(pay).toContain("set_config('app.ledger_rpc', 'lesson-ticket', true)");
    expect(pay).toContain("ledger_entry_id = v_ledger_id");
    expect(cancel).toContain("delete from public.ledger_entries");
    expect(cancel).toContain("ledger_entry_id = null");
  });

  it("세 RPC는 감사 이벤트를 남기고 로그인 사용자에게만 실행 권한을 준다", () => {
    for (const [name, signature] of [
      ["start_lesson_ticket_payment_wait", "(uuid, uuid)"],
      ["mark_lesson_ticket_paid", "(uuid, uuid, date, text)"],
      ["cancel_lesson_ticket_payment", "(uuid, uuid)"],
    ]) {
      expect(sql).toContain(`revoke all on function public.${name}${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${name}${signature} to authenticated;`);
    }
    expect(sql).toContain("'lesson_ticket.payment_waiting'");
    expect(sql).toContain("'lesson_ticket.paid'");
    expect(sql).toContain("'lesson_ticket.payment_cancelled'");
  });
});

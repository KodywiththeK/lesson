import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000400_lesson_ticket_refund_cancel_status.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("회차권 환불·취소 상태 migration 계약", () => {
  const fn = () => body("private.delete_lesson_ticket_without_history");

  it("환불·취소는 회차권을 지우지 않고 상태로 남기며 잔여는 0으로 만든다", () => {
    expect(fn()).not.toContain("private.delete_lesson_ticket_impl(");
    expect(fn()).not.toContain("delete from public.lesson_ticket_grants");
    expect(fn()).toContain("payment_status = case when p_mode = 'refund' then 'refunded' else 'cancelled' end");
    expect(fn()).toContain("remaining_count = 0");
  });

  it("이미 끝난 회차권, 등록 상태 환불, 사용한 회차권 취소, 예약이 남은 회차권은 거부한다", () => {
    expect(fn()).toContain("이미 환불되었거나 취소된 회차권입니다.");
    expect(fn()).toContain("등록 상태인 회차권은 환불이 아니라 취소로 처리해 주세요.");
    expect(fn()).toContain("사용한 유료 회차가 있어 취소할 수 없습니다. 환불로 처리해 주세요.");
    expect(fn()).toContain("private.private_lesson_grant_reserved_count(p_ticket_id) > 0");
  });

  it("수입은 입금완료 회차권의 환불·취소에서만 바꾸고 입금대기 환불은 규정 금액만 기록한다", () => {
    expect(fn()).toContain("v_grant.payment_status = 'paid'");
    expect(fn()).toContain("set_config('app.ledger_rpc', 'lesson-ticket', true)");
    expect(fn()).toContain("'ledger_changed'");
  });

  it("서비스가 섞인 옛 회차권은 유료분 정리 뒤 입금완료·결제 방식 없음으로 맞춘다", () => {
    expect(fn()).toContain("payment_status = 'paid', payment_method = null");
  });

  it("등록 이력 조회는 학원 범위로 한정한다", () => {
    expect(fn()).toContain("where academy_id = p_academy_id and lesson_ticket_grant_id = p_ticket_id");
  });

  it("외상 정산 기록은 더 이상 건드리지 않는다", () => {
    expect(fn()).not.toContain("private_lesson_credits");
  });

  it("새 외상 예정 일정은 DB에서 막는다", () => {
    expect(sql).toContain("before insert or update of credit_authorized on public.lesson_events");
    expect(sql).toContain("when (new.credit_authorized)");
    expect(sql).toContain("외상 예정 등록은 미입금 회차권으로 바뀌었습니다.");
  });

  it("상태 전환은 감사 이벤트로 남긴다", () => {
    expect(fn()).toContain("'lesson_ticket.refunded'");
    expect(fn()).toContain("'lesson_ticket.cancelled'");
  });
});

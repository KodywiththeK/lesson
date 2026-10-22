import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021090400_lesson_ticket_delete_refund.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function", start + 10);

  return sql.slice(start, next === -1 ? undefined : next);
}

describe("원장 쓰기 트리거의 회차권 예외", () => {
  const trigger = body("private.require_finance_owner_for_ledger");

  it("원장이 아니어도 통과하는 길은 회차권 RPC가 켠 트랜잭션 설정 + 회차권 수입 행 + 원장·데스크일 때뿐이다", () => {
    expect(trigger).toContain("coalesce(current_setting('app.ledger_rpc', true), '') = 'lesson-ticket'");
    expect(trigger).toContain("new.source = 'lesson-ticket'");
    expect(trigger).toContain("old.source = 'lesson-ticket'");
    expect(trigger).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
    expect(trigger).toContain("수입 관리 권한이 없습니다.");
  });

  it("설정이 없을 때(NULL) 조건이 NULL이 되어 가드가 풀리지 않도록 NULL을 빈 문자열로 맞춘다", () => {
    expect(trigger).not.toMatch(/(?<!coalesce\()current_setting\('app\.ledger_rpc', true\) = /);
    expect(trigger).toContain("coalesce(current_setting('app.ledger_rpc', true), '')");
  });

  it("그 설정은 트랜잭션 안에서만 유효하게(is_local = true) 켜고 회차권 RPC 세 곳에서만 쓴다", () => {
    expect(sql.match(/set_config\('app\.ledger_rpc', 'lesson-ticket', true\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toMatch(/set_config\('app\.ledger_rpc', 'lesson-ticket', false\)/);
    for (const name of ["public.register_lesson_ticket", "public.delete_lesson_ticket"]) {
      expect(body(name)).toContain("set_config('app.ledger_rpc', 'lesson-ticket', true)");
    }
  });
});

describe("회차권 등록 — 데스크도 결제 금액을 입력할 수 있다", () => {
  const register = body("public.register_lesson_ticket");

  it("결제 금액 입력을 원장 전용으로 막던 검사를 없앤다", () => {
    expect(register).not.toContain("결제 금액은 원장만");
    expect(register).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
  });

  it("수입 행 삽입 직전에 설정을 켜고 직후에 끈다", () => {
    const setIndex = register.indexOf("set_config('app.ledger_rpc', 'lesson-ticket', true)");
    const insertIndex = register.indexOf("insert into public.ledger_entries");
    const resetIndex = register.indexOf("set_config('app.ledger_rpc', '', true)");

    expect(setIndex).toBeGreaterThan(-1);
    expect(setIndex).toBeLessThan(insertIndex);
    expect(resetIndex).toBeGreaterThan(insertIndex);
  });

  it("기존 시그니처 그대로 다시 정의한다(오버로드 충돌 없음)", () => {
    expect(register).toContain("p_paid_amount integer default 0");
  });
});

describe("환불 계산과 미리보기", () => {
  it("환불액은 결제 합계 × 남은 회수 / 부여 회수를 원 단위 반올림한다", () => {
    const quote = body("private.lesson_ticket_refund_quote");

    expect(quote).toContain("'proportional_always'");
    expect(quote).toContain("'proportional_until_half'");
    expect(quote).toContain("used_count * 2 <= p_total");
    expect(quote).toContain("round(");
  });

  it("미리보기는 원장·데스크만 부르고 결제 금액 없이 서버가 계산한 값만 돌려준다", () => {
    const preview = body("public.get_lesson_ticket_refund_preview");
    const context = body("private.lesson_ticket_refund_context");

    expect(preview).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
    expect(preview).toContain("private.lesson_ticket_refund_context(");
    expect(preview).toContain("'can_delete_as_mistake'");
    expect(preview).toContain("'refund_amount'");
    expect(context).toContain("lesson_ticket_usages");
    expect(context).toContain("이미 삭제되었거나 찾을 수 없습니다");
  });

  it("미리보기와 삭제가 같은 판단 함수를 쓰고 사용 이력 조회에 맞는 인덱스를 둔다", () => {
    expect(body("public.delete_lesson_ticket")).toContain("private.lesson_ticket_refund_context(");
    expect(sql).toContain("create index if not exists lesson_ticket_usages_grant_idx");
    expect(sql).toContain("revoke all on function private.lesson_ticket_refund_context(uuid, uuid) from public, anon, authenticated");
  });
});

describe("회차권 삭제 RPC", () => {
  const remove = body("public.delete_lesson_ticket");

  it("원장·데스크만 호출하고 회차권 행을 잠근 뒤 처리한다", () => {
    expect(remove).toContain("security definer");
    expect(remove).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
    expect(remove).toContain("for update");
    expect(remove).toContain("p_mode not in ('refund', 'mistake')");
  });

  it("잘못 등록은 사용 이력이 있으면 거부하고 연결된 수입 기록까지 지운다", () => {
    expect(remove).toContain("사용한 회차권은 잘못 등록으로 삭제할 수 없습니다. 환불 처리로 삭제해 주세요.");
    expect(remove).toContain("delete from public.ledger_entries");
    expect(remove).toContain("source = 'lesson-ticket'");
    expect(remove).toContain("registration.ledger_entry_id");
  });

  it("환불 처리는 학원 규정으로 환불액을 정해 가장 최근 결제부터 수입 행을 줄이고 0원이 되면 지운다", () => {
    expect(remove).toContain("order by registered_at desc");
    expect(remove).toContain("update public.ledger_entries");
    expect(remove).toContain("amount = amount - v_reduce");
  });

  it("전액 감액 행은 줄이기 전에 먼저 지워 줄인 금액으로 다시 비교하지 않는다", () => {
    const deleteIndex = remove.indexOf("and amount <= v_reduce");
    const updateIndex = remove.indexOf("set amount = amount - v_reduce");

    expect(deleteIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeLessThan(updateIndex);
    expect(remove).toContain("and amount > v_reduce");
  });

  it("회차권을 지워 등록·조정·사용 이력이 함께 정리되고 감사 기록에 방식·규정·환불액을 남긴다", () => {
    expect(remove).toContain("delete from public.lesson_ticket_grants");
    expect(remove).toContain("insert into public.audit_events");
    expect(remove).toContain("'lesson_ticket.deleted'");
    expect(remove).toContain("'refund_amount'");
    expect(remove).toContain("'policy'");
    expect(remove).toContain("'mode'");
  });

  it("함수 실행 권한만 로그인 사용자에게 열고 브라우저 직접 삭제 권한은 열지 않는다", () => {
    for (const signature of [
      "public.get_lesson_ticket_refund_preview(uuid, uuid)",
      "public.delete_lesson_ticket(uuid, uuid, text)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public, anon`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
    }
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*on public\.(lesson_ticket_grants|ledger_entries)/);
  });
});

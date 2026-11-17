import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync("supabase/migrations/20261117000100_lesson_ticket_due_on_later.sql", "utf8");

function body(name: string) {
  const text = sql();
  const start = text.indexOf(`function ${name}(`);
  expect(start, `${name} 정의`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf("$$;", start));
}

describe("회차권 납입일 미정 DB 경계", () => {
  it("납입일을 비워 둘 수 있고, 새 등록 RPC는 납입일이 없으면 미정으로 남긴다", () => {
    expect(sql()).toContain("alter table public.lesson_ticket_grants alter column due_on drop not null");
    const register = body("public.register_lesson_ticket");
    expect(register).toContain("if p_due_on is null and v_result ? 'ticket_id' then");
    expect(register).toContain("set due_on = null");
    expect(register).toContain("payment_status = 'registered'");
  });

  it("납입일 입력·수정은 원장·데스크가 입금 전 회차권에만 하고 감사 기록을 남긴다", () => {
    const setDueOn = body("public.set_lesson_ticket_due_on");
    expect(setDueOn).toContain("'desk'::public.academy_member_role");
    expect(setDueOn).toContain("for update");
    expect(setDueOn).toContain("payment_status not in ('registered', 'payment-pending')");
    expect(setDueOn).toContain("'lesson_ticket.due_on_changed'");
    expect(sql()).toContain("grant execute on function public.set_lesson_ticket_due_on(uuid, uuid, date) to authenticated");
  });
});

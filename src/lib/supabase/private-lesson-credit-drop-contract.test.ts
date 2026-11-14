import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000600_drop_private_lesson_credit.sql"),
  "utf8",
).toLocaleLowerCase();

function functionBodies() {
  return sql.split("create or replace function").slice(1).map((chunk) => chunk.slice(0, chunk.indexOf("\n$$;")));
}

describe("외상 기능 물리 삭제 migration 계약", () => {
  it("외상 데이터가 남아 있으면 지우지 않고 멈춘다", () => {
    expect(sql).toContain("select count(*) into v_events from public.lesson_events where credit_authorized;");
    expect(sql).toContain("select count(*) into v_credits from public.private_lesson_credits;");
    expect(sql).toContain("외상 데이터가 남아 있어 삭제를 멈춥니다");
  });

  it("외상 표·칸·함수·트리거를 지운다", () => {
    expect(sql).toContain("drop trigger if exists private_ticket_credit_attach on public.lesson_ticket_usages;");
    expect(sql).toContain("drop trigger if exists lesson_events_reject_credit on public.lesson_events;");
    expect(sql).toContain("drop function if exists public.get_private_lesson_credit_balances(uuid);");
    expect(sql).toContain("drop function if exists private.settle_private_lesson_credits(uuid, uuid, text);");
    expect(sql).toContain("drop table if exists public.private_lesson_credits;");
    expect(sql).toContain("alter table public.lesson_events drop column if exists credit_authorized;");
  });

  it("칸을 지우기 전에 외상을 참조하던 함수를 모두 외상 없이 다시 정의한다", () => {
    const bodies = functionBodies();

    expect(bodies).toHaveLength(10);
    for (const body of bodies) {
      expect(body).not.toMatch(/credit/);
    }
    expect(sql.indexOf("create or replace function")).toBeLessThan(sql.indexOf("drop column if exists credit_authorized"));
  });
});

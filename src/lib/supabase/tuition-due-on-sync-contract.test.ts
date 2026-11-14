import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000100_student_registered_on_due_on_sync.sql"),
  "utf8",
).toLocaleLowerCase();

describe("최초 등록일 수정 시 납입일 갱신 migration 계약", () => {
  it("원생의 최초 등록일(registered_on)이 바뀔 때만 동작하는 trigger다", () => {
    expect(sql).toContain("after update of registered_on on public.students");
    expect(sql).toContain("old.registered_on is not distinct from new.registered_on");
  });

  it("입금 전(미입금·미납) 수강료의 이번 달 이후 납입일만 다시 계산하고 입금 완료와 지난달은 건드리지 않는다", () => {
    expect(sql).toContain("status in ('unpaid', 'overdue')");
    expect(sql).toContain("month >= v_today_month");
    expect(sql).not.toContain("status = 'paid'");
  });

  it("납입일은 등록일의 일을 그 달에 적용하고 그 달에 없는 날이면 다음 달 1일로 계산한다(생성 규칙과 같다)", () => {
    expect(sql).toContain("extract(day from new.registered_on)");
    expect(sql).toContain("month_end + 1");
    expect(sql).toContain("make_date(");
  });

  it("변경은 감사 이벤트로 남기고 trigger 함수는 외부에서 실행할 수 없다", () => {
    expect(sql).toContain("'tuition.due_on_synced'");
    expect(sql).toContain(
      "revoke all on function private.student_registered_on_due_on_sync() from public, anon, authenticated;",
    );
  });

  it("이미 적용된 migration을 고치지 않고 새 migration으로만 추가한다", () => {
    expect(sql).not.toContain("drop function");
    expect(sql).not.toContain("create or replace function public.ensure_monthly_fixed_income_snapshots");
  });
});

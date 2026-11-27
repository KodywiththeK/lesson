import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261128000000_notification_improvements.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.search(new RegExp(`create (or replace )?function ${name.replace(".", "\\.")}\\(`));
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);

  return sql.slice(start, sql.indexOf("\n$$;", start));
}

describe("알림 보완 migration 계약", () => {
  it("파일 전체를 한 트랜잭션으로 감싼다", () => {
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql.trimEnd()).toMatch(/commit;$/);
  });

  it("방해 금지는 기본 켜짐 22:00~08:00이고 설정 저장의 새 인자는 기본값이 있어 이전 앱도 동작한다", () => {
    expect(sql).toContain("add column quiet_hours_enabled boolean not null default true");
    expect(sql).toContain("add column quiet_start time not null default '22:00'");
    expect(sql).toContain("add column quiet_end time not null default '08:00'");
    const fn = body("public.set_my_notification_preferences");
    expect(fn).toContain("p_quiet_hours_enabled boolean default null");
    expect(fn).toContain("coalesce(p_quiet_start, public.notification_preferences.quiet_start)");
  });

  it("레슨 변경 알림은 한국 시간 오늘·내일 레슨이고 변경한 사람을 담는다", () => {
    const fn = body("private.enqueue_lesson_change_notification");
    expect(fn).toContain("not between v_today and v_today + 1");
    expect(fn).toContain("'actorid', new.actor_id");
    expect(body("private.enqueue_consultation_notification")).toContain("'actorid', (select auth.uid())");
  });

  it("받은 알림 기록은 브라우저 직접 접근을 막고 본인 것만 RPC로 읽고 읽음 처리한다", () => {
    expect(sql).toContain("alter table public.notification_receipts enable row level security");
    expect(sql).toContain("revoke all on public.notification_receipts from anon, authenticated");
    for (const name of ["public.list_my_notifications", "public.mark_my_notifications_read", "public.count_my_unread_notifications"]) {
      expect(body(name)).toContain("user_id = (select auth.uid())");
    }
    expect(body("public.list_my_notifications")).toContain("interval '30 days'");
    expect(body("public.count_my_unread_notifications")).toContain("receipt.academy_id = p_academy_id");
    expect(sql).toContain("unique (academy_id, user_id, source_key)");
  });

  it("미룬 푸시는 서버만 가져가며 가져갈 때 보낸 것으로 표시하고, 발송 호출 조건과 정리에 포함한다", () => {
    expect(body("public.claim_due_deferred_receipts")).toContain("set pushed_at = now()");
    expect(sql).toContain("grant execute on function public.claim_due_deferred_receipts(integer) to service_role");
    expect(sql).not.toContain("claim_due_deferred_receipts(integer) to authenticated");
    expect(body("private.invoke_notification_dispatch")).toContain("from public.notification_receipts");
    expect(body("private.invoke_morning_brief")).toContain("delete from public.notification_receipts");
  });

  it("내 설정 조회는 마지막 아침 메일 발송 시각을 본인 기록에서만 읽는다", () => {
    const fn = body("public.get_my_notification_preferences");
    expect(fn).toContain("last_morning_email_at");
    expect(fn).toContain("delivery.user_id = (select auth.uid())");
    expect(fn).toContain("delivery.channel = 'email'");
  });
});

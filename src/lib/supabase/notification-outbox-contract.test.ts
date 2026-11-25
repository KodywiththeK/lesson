import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261119000200_notification_outbox.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("알림 발송 대기열 migration 계약", () => {
  it("대기열은 세 종류 사건만 받고 브라우저에서는 읽거나 쓸 수 없다", () => {
    expect(sql).toContain("create table public.notification_outbox");
    expect(sql).toContain("check (kind in ('lesson_change', 'consultation', 'join_request'))");
    expect(sql).toContain("alter table public.notification_outbox enable row level security");
    expect(sql).toContain("revoke all on public.notification_outbox from anon, authenticated");
  });

  it("레슨 변경은 감사 기록 트리거로, 한국 시간 오늘 레슨에 닿을 때만 적재한다", () => {
    const fn = body("private.enqueue_lesson_change_notification");

    expect(sql).toContain("after insert on public.audit_events");
    expect(fn).toContain("new.event_type not in ('lesson_event.rescheduled', 'lesson_event.deleted')");
    expect(fn).toContain("(now() at time zone 'asia/seoul')::date");
    expect(fn).toContain("'teacherids'");
  });

  it("상담 등록과 대기 중 가입 요청도 트리거로 적재한다", () => {
    expect(sql).toContain("after insert on public.consultations");
    expect(sql).toContain("after insert on public.academy_join_requests");
    expect(body("private.enqueue_join_request_notification")).toContain("new.status = 'pending'");
  });

  it("발송기는 잠금 건너뛰기로 대기열을 가져가고 다섯 번까지만 다시 시도한다", () => {
    const fn = body("public.claim_notification_outbox");

    expect(fn).toContain("for update skip locked");
    expect(fn).toContain("attempts < 5");
    expect(fn).toContain("dispatched_at is null");
  });

  it("서버 전용 RPC는 service_role에게만 연다", () => {
    for (const signature of [
      "public.claim_notification_outbox(integer)",
      "public.complete_notification_outbox(uuid, text)",
      "public.list_notification_recipients(uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function ${signature} to service_role`);
    }
  });

  it("받는 사람 목록은 활성 구성원과 연결된 선생님·설정 기본값·이메일을 함께 준다", () => {
    const fn = body("public.list_notification_recipients");

    expect(fn).toContain("member.status = 'active'");
    expect(fn).toContain("teacher.member_id = member.id");
    expect(fn).toContain("coalesce(preference.push_lesson_change, true)");
    expect(fn).toContain("left join auth.users account");
  });

  it("1분마다 대기열이 있을 때만 앱 발송 주소를 부르고, 주소·비밀값은 vault에서 읽는다", () => {
    const fn = body("private.invoke_notification_dispatch");
    const invoker = body("private.invoke_app_route");

    expect(invoker).toContain("vault.decrypted_secrets");
    expect(invoker).toContain("net.http_post");
    expect(fn).toContain("private.invoke_app_route('/api/notifications/dispatch'");
    expect(fn).not.toContain("delete from");
    expect(sql).toContain("'notification-dispatch'");
    expect(sql).toContain("'* * * * *'");
  });
});

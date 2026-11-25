import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261119000300_morning_brief.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("아침 브리핑 migration 계약", () => {
  it("발송 기록은 학원·날짜·사람·채널당 한 행이라 같은 날 두 번 보내지 않는다", () => {
    expect(sql).toContain("create table public.morning_brief_deliveries");
    expect(sql).toContain("unique (academy_id, brief_date, user_id, channel)");
    expect(sql).toContain("check (channel in ('email', 'push'))");
    expect(sql).toContain("alter table public.morning_brief_deliveries enable row level security");
    expect(sql).toContain("revoke all on public.morning_brief_deliveries from anon, authenticated");
  });

  it("발송 자리 잡기는 이미 있으면 false를 돌려준다", () => {
    const fn = body("public.claim_morning_brief_delivery");

    expect(fn).toContain("on conflict (academy_id, brief_date, user_id, channel) do nothing");
    expect(fn).toContain("return found");
  });

  it("브리핑 원천은 한국 시간 오늘 예정 레슨·휴원·읽지 않은 메모·할 일 상태를 준다", () => {
    const fn = body("public.get_morning_brief_source_for_service");

    expect(fn).toContain("event.status = 'scheduled'");
    expect(fn).toContain("p_date::timestamp at time zone 'asia/seoul'");
    expect(fn).toContain("from public.academy_closures");
    expect(fn).toContain("memo.unread");
    expect(fn).toContain("from public.daily_task_states");
  });

  it("서버 전용 RPC는 service_role에게만 연다", () => {
    for (const signature of [
      "public.get_morning_brief_source_for_service(uuid, date)",
      "public.list_academies_for_morning_brief()",
      "public.claim_morning_brief_delivery(uuid, date, uuid, text)",
      "public.finish_morning_brief_delivery(uuid, date, uuid, text, text, text)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function ${signature} to service_role`);
    }
  });

  it("매일 23:00 UTC(한국 08:00)에 앱의 아침 브리핑 주소를 vault 비밀값으로 부른다", () => {
    const fn = body("private.invoke_morning_brief");

    expect(fn).toContain("private.invoke_app_route('/api/cron/morning-brief', 60000)");
    expect(sql).toContain("'morning-brief'");
    expect(sql).toContain("'0 23 * * *'");
  });

  it("하루 한 번 오래된 알림·할 일 상태·발송 기록을 정리한다", () => {
    const fn = body("private.invoke_morning_brief");

    expect(fn).toContain("delete from public.notification_outbox");
    expect(fn).toContain("delete from public.daily_task_states where updated_at < now() - interval '90 days'");
    expect(fn).toContain("delete from public.morning_brief_deliveries");
  });
});

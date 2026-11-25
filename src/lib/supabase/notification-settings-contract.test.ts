import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261119000100_notification_settings.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("알림 설정 migration 계약", () => {
  it("알림 설정은 학원·사람당 한 행이고 모든 항목이 켜진 상태가 기본이다", () => {
    expect(sql).toContain("create table public.notification_preferences");
    expect(sql).toContain("primary key (academy_id, user_id)");
    for (const column of [
      "morning_email boolean not null default true",
      "push_lesson_change boolean not null default true",
      "push_consultation boolean not null default true",
      "push_join_request boolean not null default true",
      "push_morning_brief boolean not null default true",
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("푸시 구독은 기기 주소(endpoint)당 한 행이다", () => {
    expect(sql).toContain("create table public.push_subscriptions");
    expect(sql).toContain("endpoint text not null unique");
    expect(sql).toContain("check (endpoint like 'https://%' and length(endpoint) <= 2048)");
  });

  it("두 테이블 모두 RLS를 켜고 브라우저 직접 접근을 막아 RPC로만 다룬다", () => {
    for (const table of ["notification_preferences", "push_subscriptions"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
    }
    expect(sql).not.toContain("create policy");
  });

  it("내 설정 조회는 활성 구성원 본인 것만, 행이 없으면 기본값과 로그인 이메일을 돌려준다", () => {
    const fn = body("public.get_my_notification_preferences");

    expect(fn).toContain("private.is_active_academy_member(p_academy_id)");
    expect(fn).toContain("preference.user_id = (select auth.uid())");
    expect(fn).toContain("coalesce(preference.morning_email, true)");
    expect(fn).toContain("from auth.users");
  });

  it("내 설정 저장은 본인 행만 upsert한다", () => {
    const fn = body("public.set_my_notification_preferences");

    expect(fn).toContain("private.is_active_academy_member(p_academy_id)");
    expect(fn).toContain("(select auth.uid())");
    expect(fn).toContain("on conflict (academy_id, user_id)");
  });

  it("구독 저장은 같은 기기를 다른 계정이 쓰면 현재 계정으로 옮기고, 삭제는 본인 구독만 지운다", () => {
    const save = body("public.save_push_subscription");
    const remove = body("public.delete_push_subscription");

    expect(save).toContain("on conflict (endpoint)");
    expect(save).toContain("user_id = excluded.user_id");
    expect(remove).toContain("user_id = (select auth.uid())");
  });
});

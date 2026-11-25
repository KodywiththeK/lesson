import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261119000000_daily_tasks.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("오늘 할 일 migration 계약", () => {
  it("상태는 학원·할 일 키당 한 행이고 답변 대기·완료 두 가지뿐이다", () => {
    expect(sql).toContain("create table public.daily_task_states");
    expect(sql).toContain("primary key (academy_id, task_key)");
    expect(sql).toContain("check (state in ('waiting_reply', 'done'))");
  });

  it("상태 테이블은 RLS를 켜고 브라우저 직접 접근을 막아 RPC로만 읽고 쓴다", () => {
    expect(sql).toContain("alter table public.daily_task_states enable row level security");
    expect(sql).toContain("revoke all on public.daily_task_states from anon, authenticated");
    expect(sql).not.toContain("create policy");
  });

  it("화면용 원천 RPC는 역할로 범위를 정하고 금액은 원장 범위에서만 채운다", () => {
    const fn = body("public.get_daily_task_source");
    const source = body("private.daily_task_source");

    expect(fn).toContain("private.daily_task_source(p_academy_id, p_date, 'owner')");
    expect(fn).toContain("private.daily_task_source(p_academy_id, p_date, 'desk')");
    expect(fn).toContain("private.daily_task_source(p_academy_id, p_date, 'teacher')");
    expect(source).toContain("v_with_amounts boolean := p_scope = 'owner'");
    expect(source.match(/case when v_with_amounts then/g)).toHaveLength(3);
  });

  it("선생님 범위는 담당 학생만 받고 수납·상담·교재는 비운다", () => {
    const source = body("private.daily_task_source");

    expect(source.match(/not v_is_teacher or private.teacher_can_access_student/g)).toHaveLength(2);
    expect(source).toContain("if not v_is_teacher then");
  });

  it("미처리 결석은 보강·패스 기록이 없는 결석만 고르고 한국 시간으로 오늘까지 본다", () => {
    const source = body("private.daily_task_source");

    expect(source).toContain("record.status = 'absent'");
    expect(source).toContain("from public.absence_resolutions resolution");
    expect(source).toContain("p_date::timestamp at time zone 'asia/seoul'");
  });

  it("레슨 변경은 이동·삭제 감사 기록 중 오늘 레슨에 닿는 것만 고른다", () => {
    const source = body("private.daily_task_source");

    expect(source).toContain("audit.event_type in ('lesson_event.rescheduled', 'lesson_event.deleted')");
    expect(source).toContain("cross join lateral private.lesson_change_facts(");
    expect(source).toContain("facts.previous_starts_at >= v_day_start");
    expect(source).toContain("facts.next_starts_at >= v_day_start");
  });

  it("서버용 원천 RPC는 service_role에게만 열고 원장·데스크 범위만 받는다", () => {
    expect(sql).toContain(
      "revoke all on function public.get_daily_task_source_for_service(uuid, date, text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.get_daily_task_source_for_service(uuid, date, text) to service_role",
    );
    expect(body("public.get_daily_task_source_for_service")).toContain("p_scope not in ('owner', 'desk')");
  });

  it("레슨 변경 해석은 한 함수가 맡고 uuid 열을 그대로 비교해 색인을 쓴다", () => {
    const facts = body("private.lesson_change_facts");

    expect(facts).toContain("source_event.id = p_entity_id::uuid");
    expect(facts).toContain("moved_event.id = (p_metadata->>'moved_lesson_event_id')::uuid");
    expect(facts).not.toContain("id::text");
  });

  it("상태 RPC는 원장·데스크만 쓰고(선생님은 보기만), null이면 상태를 지워 되돌린다", () => {
    const fn = body("public.set_daily_task_state");

    expect(fn).toContain(
      "private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])",
    );
    expect(fn).not.toContain("'teacher'");
    expect(fn).toContain("if p_state is null then");
    expect(fn).toContain("on conflict (academy_id, task_key)");
  });
});

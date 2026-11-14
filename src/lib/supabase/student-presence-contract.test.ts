import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000200_student_presence.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("등하원 현황 migration 계약", () => {
  it("학생·날짜당 한 행이고 하원은 등원 이후여야 한다", () => {
    expect(sql).toContain("create table public.student_presence");
    expect(sql).toContain("unique (academy_id, student_id, presence_date)");
    expect(sql).toContain("check (left_at is null or left_at >= arrived_at)");
    expect(sql).toContain("arrived_at timestamptz not null");
  });

  it("RLS를 켜고 브라우저의 직접 읽기·쓰기 권한을 회수해 RPC로만 접근하게 한다", () => {
    expect(sql).toContain("alter table public.student_presence enable row level security");
    expect(sql).toContain("revoke all on public.student_presence from anon, authenticated");
    expect(sql).not.toContain("create policy");
  });

  it("updated_at은 공용 trigger로 갱신한다", () => {
    expect(sql).toContain("before update on public.student_presence");
    expect(sql).toContain("private.set_updated_at()");
  });

  it("기록 RPC는 원장·데스크만 허용하고 오늘(서울) 날짜에만 기록한다", () => {
    const fn = body("public.record_student_presence");

    expect(fn).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
    expect(fn).not.toContain("'teacher'");
    expect(fn).toContain("(now() at time zone 'asia/seoul')::date");
    expect(fn).toContain("등하원은 오늘 날짜에만 기록할 수 있습니다.");
  });

  it("기록 RPC 동작은 도메인 규칙과 같다(등원 먼저, 하원 취소 먼저)", () => {
    const fn = body("public.record_student_presence");

    for (const action of ["'arrive'", "'leave'", "'cancel-arrive'", "'cancel-leave'"]) {
      expect(fn).toContain(action);
    }
    expect(fn).toContain("등원을 먼저 기록해 주세요.");
    expect(fn).toContain("하원 기록을 먼저 취소해 주세요.");
    expect(fn).toContain("on conflict (academy_id, student_id, presence_date) do nothing");
  });

  it("목록 RPC는 그날 예정된 학원·개인·보강 일정의 학생을 합치고 삭제·취소 일정은 뺀다", () => {
    const fn = body("public.list_daily_student_presence");

    expect(fn).toContain("event.status = 'scheduled'");
    // 날짜를 컬럼 변환 없이 범위로 비교해 (academy_id, starts_at) 인덱스를 쓴다.
    expect(fn).toContain("event.starts_at >= (p_date::timestamp at time zone 'asia/seoul')");
    expect(fn).toContain("event.starts_at < ((p_date + 1)::timestamp at time zone 'asia/seoul')");
    expect(fn).toContain("array_agg(distinct");
    expect(fn).toContain("public.student_presence");
  });

  it("선생님은 담당 원생만 읽고 원장·데스크는 전체를 읽는다", () => {
    const fn = body("public.list_daily_student_presence");

    expect(fn).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role, 'teacher'::public.academy_member_role]");
    expect(fn).toContain("private.teacher_can_access_student(");
    expect(fn).toContain("v_is_teacher");
  });

  it("두 RPC 모두 로그인 사용자에게만 실행 권한을 준다", () => {
    for (const signature of [
      "public.record_student_presence(uuid, uuid, date, text)",
      "public.list_daily_student_presence(uuid, date)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated;`);
    }
  });
});

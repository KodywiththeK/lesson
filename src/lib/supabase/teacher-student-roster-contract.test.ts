import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 이 migration 파일 하나의 계약만 확인한다(이전 migration의 같은 문자열 때문에 통과하는 일을 막는다).
const migrationSql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261018120000_teacher_student_roster.sql"),
  "utf8",
).toLocaleLowerCase();

describe("선생님 담당 원생 조회 migration 계약", () => {
  it("담당 원생 명단은 선생님 역할만 호출하고 담당 원생만 돌려준다", () => {
    expect(migrationSql).toContain("create or replace function public.list_students_for_teacher");
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("array['teacher'::public.academy_member_role]");
    expect(migrationSql).toContain("private.teacher_can_access_student(");
  });

  it("명단에는 이름·악기·요일만 담고 학교·나이·수강료·연락처·출석 코드는 담지 않는다", () => {
    const rpcBody = migrationSql.slice(
      migrationSql.indexOf("create or replace function public.list_students_for_teacher"),
      migrationSql.indexOf("revoke all on function public.list_students_for_teacher"),
    );

    expect(rpcBody).toContain("student_name");
    expect(rpcBody).toContain("instrument_names");
    expect(rpcBody).toContain("weekdays");
    for (const sensitive of ["school", "age", "occupation", "attendance_code", "lesson_fee", "final_monthly_fee", "phone"]) {
      expect(rpcBody).not.toMatch(new RegExp(`\\b${sensitive}\\b`));
    }
  });

  it("재원 중이고 보관되지 않은 원생의 활성 수강 정보만 명단에 올린다", () => {
    expect(migrationSql).toContain("student.status = 'enrolled'");
    expect(migrationSql).toContain("student.archived_at is null");
    expect(migrationSql).toContain("instrument.active");
  });

  it("앱 사용자에게만 실행 권한을 주고 anon에게는 주지 않는다", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.list_students_for_teacher(uuid) from public, anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.list_students_for_teacher(uuid) to authenticated",
    );
  });

  it("선생님은 수강 정보 표(수강료·할인 포함)를 직접 읽지 못하게 owner·desk 전용으로 좁힌다", () => {
    expect(migrationSql).toContain(
      'drop policy if exists "student_instruments_select_allowed_members" on public.student_instruments',
    );
    expect(migrationSql).toContain('create policy "student_instruments_select_owner_desk"');
    expect(migrationSql).toContain(
      'drop policy if exists "student_instrument_weekly_schedules_select_allowed_members" on public.student_instrument_weekly_schedules',
    );
    expect(migrationSql).toContain('create policy "student_instrument_weekly_schedules_select_owner_desk"');
    const instrumentPolicy = migrationSql.slice(
      migrationSql.indexOf('create policy "student_instruments_select_owner_desk"'),
    );
    expect(instrumentPolicy.slice(0, instrumentPolicy.indexOf(");") + 2)).not.toContain(
      "teacher_can_access_student",
    );
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 이 migration의 계약만 확인한다. 여러 migration을 합친 schema-contract.test.ts와 달리
// 이전 정의에 같은 문자열이 있어서 통과하는 일을 막기 위해 파일 하나만 읽는다.
const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261018080000_student_status_and_edit_fixes.sql",
  ),
  "utf8",
).toLocaleLowerCase();

describe("원생 휴원·퇴원·수정 보정 migration 계약", () => {
  it("재원 복귀 시 정기 레슨 시리즈를 다시 만들고 그 달 일정을 생성한다", () => {
    expect(migrationSql).toContain("create or replace function public.update_student_status");
    expect(migrationSql).toContain("if p_status = 'enrolled' then");
    expect(migrationSql).toContain("insert into public.lesson_series");
    expect(migrationSql).toContain("from public.student_instrument_weekly_schedules");
    expect(migrationSql).toContain("public.ensure_monthly_academy_lesson_events(");
  });

  it("복귀 시 이미 활성 시리즈가 있는 수강 정보는 중복으로 만들지 않는다", () => {
    expect(migrationSql).toMatch(/not exists \(\s*select 1\s*from public\.lesson_series/);
  });

  it("같은 상태로의 재처리를 거부하고 처리 시각은 서버 시각을 쓴다", () => {
    expect(migrationSql).toContain("v_changed_at timestamptz := now()");
    expect(migrationSql).toContain("이미 해당 상태입니다");
    expect(migrationSql).not.toContain("p_changed_at,\n    (select auth.uid())");
  });

  it("전환할 때 반대 상태의 처리 시각을 정리한다", () => {
    expect(migrationSql).toMatch(/when p_status = 'suspended' then v_changed_at/);
    expect(migrationSql).toMatch(/withdrawn_at = case\s+when p_status = 'withdrawn' then v_changed_at\s+else null/);
  });

  it("원생 수정은 요일별 시간을 저장하고 시리즈를 요일 단위로 다시 만든다", () => {
    expect(migrationSql).toContain(
      "drop function if exists public.update_student_profile_from_date(",
    );
    expect(migrationSql).toContain("p_weekly_schedules jsonb default null");
    expect(migrationSql).toContain("delete from public.student_instrument_weekly_schedules");
    expect(migrationSql).toContain("insert into public.student_instrument_weekly_schedules");
    expect(migrationSql).toContain("array[v_schedule ->> 'weekday']");
  });

  it("원생 수정은 학원 수업의 선생님과 시간, 최종 수강료를 서버에서도 검증한다", () => {
    expect(migrationSql).toContain("학원 수업은 담당 선생님과 모든 수강 요일의 시작·종료 시간이 필요합니다.");
    expect(migrationSql).toContain("최종 수강료가 레슨비에서 할인액을 뺀 금액과 다릅니다.");
  });

  it("복수 악기 원생의 다른 악기 배정을 건드리지 않고 해당 악기 배정만 바꾼다", () => {
    expect(migrationSql).toContain("instrument_name = v_existing_instrument_name");
    expect(migrationSql).not.toContain(
      "update public.student_teacher_assignments\n  set\n    teacher_id = p_teacher_id,\n    instrument_name = p_instrument_name\n  where academy_id = p_academy_id\n    and student_id = p_student_id\n    and active;",
    );
  });

  it("담당 선생님을 A→B→A로 바꿔도 비활성 배정을 다시 켜서 unique 위반 없이 저장한다", () => {
    expect(migrationSql).toContain(
      "on conflict (academy_id, student_id, teacher_id, instrument_name)",
    );
    expect(migrationSql).toMatch(/do update\s+set active = true/);
  });

  it("같은 악기를 다른 수업 유형으로 수강 중이면 그 수강의 담당 배정은 끄지 않는다", () => {
    expect(migrationSql).toContain("other.id <> v_existing_student_instrument_id");
    expect(migrationSql).toContain("other.teacher_id = student_teacher_assignments.teacher_id");
  });

  it("예전 4인자 상태 변경 함수가 남아 새 규칙을 우회하지 않게 지운다", () => {
    expect(migrationSql).toContain(
      "drop function if exists public.update_student_status(uuid, uuid, text, timestamptz)",
    );
  });

  it("휴원·퇴원 원생은 수정해도 정기 시리즈를 새로 만들지 않는다", () => {
    expect(migrationSql).toContain("v_student_status = 'enrolled'");
  });

  it("보관 만료 처리 함수는 앱 사용자가 직접 실행하지 못하게 한다", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.archive_expired_people(timestamptz) from public, anon, authenticated",
    );
  });

  it("새 함수 시그니처에 권한을 다시 부여한다", () => {
    expect(migrationSql).toContain("grant execute on function public.update_student_profile_from_date(");
    expect(migrationSql).toContain("grant execute on function public.update_student_status(");
  });
});

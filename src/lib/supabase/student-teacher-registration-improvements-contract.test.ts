import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261024233825_student_teacher_registration_improvements.sql",
  ),
  "utf8",
).toLocaleLowerCase();

describe("원생·선생님 등록 개선 migration 계약", () => {
  it("출생연도와 개인레슨 월 횟수·수업 길이를 저장한다", () => {
    expect(migrationSql).toContain("add column if not exists birth_year integer");
    expect(migrationSql).toContain("add column if not exists sessions_per_month integer");
    expect(migrationSql).toContain("add column if not exists lesson_duration_minutes integer");
    expect(migrationSql).toContain("private.validate_student_demographics");
    expect(migrationSql).toContain("private.validate_private_lesson_settings");
    expect(migrationSql).toContain("v_weekday_count = 1 and v_sessions <> 4");
    expect(migrationSql).toContain("v_weekday_count = 2 and v_sessions <> 8");
  });

  it("출석 ID 충돌은 새 공개 등록 RPC에서 제한 횟수만큼 재시도한다", () => {
    expect(migrationSql).toContain("exception when unique_violation");
    expect(migrationSql).toContain("students_academy_attendance_code_key");
    expect(migrationSql).toContain("v_attempt >= 5");
    expect(migrationSql).toContain(
      "revoke all on function public.register_student_with_contacts(\n  uuid, text, date, integer, text",
    );
  });

  it("선생님 비율은 기존 이상값을 임의 보정하지 않고 10% 단위로 제한한다", () => {
    expect(migrationSql).toContain("migration을 중단합니다");
    expect(migrationSql).toContain("teacher_salary_settings_ratio_step_check");
    expect(migrationSql).toContain("mod(p_ratio_teacher_share, 10) <> 0");
  });

  it("공개 wrapper만 인증 사용자가 직접 실행하고 모든 원생 하위 쓰기 RPC는 우회할 수 없다", () => {
    expect(migrationSql).toContain(
      "revoke all on function private.validate_private_lesson_settings(jsonb)\n  from public, anon, authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb)\n  to authenticated",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.register_student_with_enrollments(\n  uuid, text, date, integer, text, text, text, text, text, jsonb\n) from public, anon, authenticated",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.update_student_with_enrollments(uuid, uuid, text, jsonb, jsonb)\n  from public, anon, authenticated",
    );
    expect(migrationSql).toMatch(
      /revoke all on function public\.update_student_basic_info\([\s\S]*?\) from public, anon, authenticated/,
    );
    expect(migrationSql).toMatch(
      /revoke all on function public\.update_student_profile_from_date\([\s\S]*?\) from public, anon, authenticated/,
    );
    expect(migrationSql).toContain(
      "revoke insert, update on public.students from authenticated",
    );
    expect(migrationSql).toContain(
      "revoke insert, update on public.student_instruments from authenticated",
    );
    expect(migrationSql).toContain(
      "alter function public.update_student_status(uuid, uuid, text, timestamptz, text)\n  security definer",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.update_student_status(uuid, uuid, text, timestamptz, text)\n  from public, anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.update_student_status(uuid, uuid, text, timestamptz, text)\n  to authenticated",
    );
  });

  it("선생님 계약기간은 기본·급여 검증 모두에서 선택 입력이고 invoker RPC가 helper를 실행할 수 있다", () => {
    expect(migrationSql).toContain(
      "create or replace function private.validate_teacher_base_payload(",
    );
    expect(migrationSql).toContain(
      "if p_contract_start_on is not null\n    and p_contract_end_on is not null",
    );
    expect(migrationSql).toContain(
      "revoke all on function private.validate_teacher_profile_payload(\n  text, text, date, date, text, integer, integer, integer\n) from public, anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function private.validate_teacher_profile_payload(\n  text, text, date, date, text, integer, integer, integer\n) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function private.validate_teacher_base_payload(\n  text, text, date, date\n) to authenticated",
    );
  });

  it("비율제 사전 검증 블록은 유효한 plpgsql 문장으로 닫힌다", () => {
    expect(migrationSql).toContain("migration을 중단합니다.';\n  end if;\nend;\n$$;");
  });

  it("함수 반환형 선언을 한 번만 작성한다", () => {
    expect(migrationSql).not.toMatch(/returns jsonb\s+returns jsonb/);
  });
});

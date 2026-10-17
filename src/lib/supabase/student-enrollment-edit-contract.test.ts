import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 이 migration의 계약만 확인한다. 여러 migration을 합친 schema-contract.test.ts와 달리
// 이전 정의에 같은 문자열이 있어서 통과하는 일을 막기 위해 파일 하나만 읽는다.
const migrationSql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261020090000_student_enrollment_edit.sql"),
  "utf8",
).toLocaleLowerCase();

/** `create or replace function <name>(` 부터 다음 함수 정의 직전까지의 본문. */
function functionBody(name: string) {
  const start = migrationSql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const next = migrationSql.indexOf("create or replace function ", start + 10);

  return migrationSql.slice(start, next === -1 ? undefined : next);
}

describe("수강 시작·종료일 컬럼 migration 계약", () => {
  it("student_instruments에 started_on과 ended_on을 추가한다", () => {
    expect(migrationSql).toContain("alter table public.student_instruments");
    expect(migrationSql).toMatch(/add column if not exists started_on date/);
    expect(migrationSql).toMatch(/add column if not exists ended_on date/);
  });

  it("월 수강료 snapshot은 시작·종료 달을 기준으로 악기를 고른다", () => {
    const body = functionBody("public.ensure_monthly_fixed_income_snapshots");

    // 시작일이 없는 기존 수강은 원생 등록일을 시작일로 본다.
    expect(body).toMatch(/coalesce\(instrument\.started_on, student\.registered_on\) <= month_end/);
    // 종료일이 있으면 종료한 달까지 만들고, 없으면 active만 본다.
    expect(body).toMatch(/coalesce\(instrument\.ended_on >= month_start, instrument\.active\)/);
    expect(body).toContain("on conflict (academy_id, month, student_id, instrument_id) do nothing");
    expect(body).toContain("월별 수강료 조회 권한이 없습니다.");
    expect(body).toContain("referral_applied");
  });

  it("같은 달에 같은 악기 수강이 둘이면(월 중간 종료 후 재추가) 늦게 시작한 수강이 월 수강료 한 건을 정한다", () => {
    const body = functionBody("public.ensure_monthly_fixed_income_snapshots");

    expect(body).toMatch(
      /order by coalesce\(instrument\.started_on, student\.registered_on\) desc, instrument\.created_at desc, instrument\.id desc\s+on conflict/,
    );
  });

  it("시작하기 전에 종료한 수강(종료일이 시작일보다 앞섬)은 어느 달에도 월 수강료를 만들지 않는다", () => {
    const body = functionBody("public.ensure_monthly_fixed_income_snapshots");

    expect(body).toMatch(
      /coalesce\(instrument\.started_on, student\.registered_on\) <= coalesce\(instrument\.ended_on, month_end\)/,
    );
  });
});

describe("활성 수강 한정 unique migration 계약", () => {
  it("이전 unique 제약을 이름 대신 컬럼 집합으로 찾아 지운다", () => {
    expect(migrationSql).toMatch(/do \$\$/);
    expect(migrationSql).toMatch(/from pg_constraint/);
    expect(migrationSql).toMatch(/conrelid = 'public\.student_instruments'::regclass/);
    expect(migrationSql).toMatch(/contype = 'u'/);
    expect(migrationSql).toMatch(/alter table public\.student_instruments drop constraint/);
  });

  it("같은 악기·수업 형태의 수강은 활성 행끼리만 중복을 막아 종료한 수강이 새 수강과 공존한다", () => {
    expect(migrationSql).toMatch(
      /create unique index (if not exists )?student_instruments_active_enrollment_key\s+on public\.student_instruments \(academy_id, student_id, instrument_id, lesson_type\)\s+where active/,
    );
  });
});

describe("수강 한 건 추가 내부 함수 계약", () => {
  const body = () => functionBody("private.insert_student_enrollment");

  it("앱 사용자가 직접 실행할 수 없다", () => {
    expect(migrationSql).toMatch(
      /revoke all on function private\.insert_student_enrollment\([^)]*\)\s+from public, anon, authenticated/,
    );
  });

  it("수강 중인 같은 악기·수업 형태가 있으면 거부하고, 종료한 수강은 덮어쓰지 않고 새 수강을 추가한다", () => {
    expect(body()).toContain("이미 수강 중인 악기와 수업 형태입니다.");
    expect(body()).toMatch(/and active\s+for update/);
    // 종료한 행을 되살리거나 시작·종료일을 덮어쓰는 update가 없다.
    expect(body()).not.toMatch(/update public\.student_instruments/);
    expect(body()).not.toMatch(/ended_on = null/);
    expect(body()).toMatch(/insert into public\.student_instruments \(/);
  });

  it("종료한 수강을 다시 추가할 때 시작일이 가장 최근 종료일 다음 날보다 앞서면 거부해 이전 시리즈와 일정이 겹치지 않게 한다", () => {
    expect(body()).toContain("종료한 수강은 종료일(%) 다음 날부터 다시 시작할 수 있습니다.");
    expect(body()).toMatch(/select max\(ended_on\)/);
    expect(body()).toMatch(/v_last_ended_on is not null\s+and v_started_on <= v_last_ended_on/);
  });

  it("수업 형태가 비어 있어도 허용값 검사를 통과하지 못한다", () => {
    expect(body()).toMatch(/coalesce\(v_lesson_type, ''\) not in \('academy', 'private'\)/);
  });

  it("요일·시간·학원 수업 필수값·할인·최종 수강료를 서버에서 검증한다", () => {
    expect(body()).toContain("수강 요일을 확인해 주세요.");
    expect(body()).toContain("시작 시간과 종료 시간을 함께 입력해 주세요.");
    expect(body()).toContain("종료 시간은 시작 시간보다 늦어야 합니다.");
    expect(body()).toContain("같은 요일이 두 번 선택되었습니다.");
    expect(body()).toContain("학원 수업은 담당 선생님과 모든 수강 요일의 시작·종료 시간이 필요합니다.");
    expect(body()).toContain("지원하지 않는 할인 종류입니다.");
    expect(body()).toContain("최종 수강료가 레슨비에서 할인액을 뺀 금액과 다릅니다. 금액을 다시 확인해 주세요.");
  });

  it("담당 배정은 다시 켜고, 재원 중인 원생에게만 시작일부터 정기 시리즈를 만든다", () => {
    expect(body()).toMatch(/on conflict \(academy_id, student_id, teacher_id, instrument_name\)\s+do update set active = true/);
    expect(body()).toMatch(/p_student_status = 'enrolled'/);
    expect(body()).toMatch(/v_started_on,\s+true\s+\)/);
  });
});

describe("수강 종료 내부 함수 계약", () => {
  const body = () => functionBody("private.end_student_enrollment");

  it("앱 사용자가 직접 실행할 수 없다", () => {
    expect(migrationSql).toMatch(
      /revoke all on function private\.end_student_enrollment\([^)]*\)\s+from public, anon, authenticated/,
    );
  });

  it("수강을 지우지 않고 비활성으로 바꾸며 종료일을 남긴다", () => {
    expect(body()).toMatch(/set\s+active = false,\s+ended_on = p_today/);
    expect(body()).not.toMatch(/delete from public\.student_instruments/);
    expect(body()).toContain("이미 종료된 수강입니다.");
    expect(body()).toContain("종료할 수강 정보를 찾지 못했습니다.");
  });

  it("정기 시리즈를 닫고 오늘 이후 출석 기록이 없는 정기 일정만 취소한다", () => {
    expect(body()).toMatch(/update public\.lesson_series\s+set\s+active = false/);
    expect(body()).toMatch(/event\.origin = 'regular'/);
    expect(body()).toMatch(/event\.status = 'scheduled'/);
    expect(body()).toMatch(/not exists \(\s+select 1\s+from public\.attendance_records attendance/);
    expect(body()).toContain("'cancelled'");
  });

  it("같은 선생님·악기의 다른 수강이 남아 있으면 담당 배정을 끄지 않는다", () => {
    expect(body()).toMatch(/update public\.student_teacher_assignments\s+set active = false/);
    expect(body()).toMatch(/and not exists \(\s+select 1\s+from public\.student_instruments other/);
  });

  it("남은 정기 외 예정 일정 건수를 돌려준다", () => {
    expect(body()).toMatch(/returns integer/);
    expect(body()).toMatch(/select count\(\*\)/);
  });
});

describe("update_student_with_enrollments RPC 계약", () => {
  const body = () => functionBody("public.update_student_with_enrollments");

  it("owner·desk만 실행하고 anon·public 권한은 없다", () => {
    expect(body()).toContain("security definer");
    expect(body()).toMatch(/private\.has_academy_role\(\s+p_academy_id,\s+array\['owner'::public\.academy_member_role, 'desk'::public\.academy_member_role\]/);
    expect(body()).toContain("원생 정보를 수정할 권한이 없습니다.");
    expect(migrationSql).toMatch(
      /revoke all on function public\.update_student_with_enrollments\([^)]*\)\s+from public, anon;/,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.update_student_with_enrollments\([^)]*\)\s+to authenticated;/,
    );
  });

  it("기본 정보와 수강 변경을 한 함수(한 트랜잭션) 안에서 처리한다", () => {
    expect(body()).toContain("public.update_student_basic_info(");
    expect(body()).toContain("public.update_student_profile_from_date(");
    expect(body()).toContain("private.insert_student_enrollment(");
    expect(body()).toContain("private.end_student_enrollment(");
    // 함수 안에서 commit/rollback을 직접 호출하거나 savepoint 예외 삼킴이 있으면 원자성이 깨진다.
    expect(body()).not.toMatch(/\bcommit\b/);
    expect(body()).not.toMatch(/exception\s+when/);
  });

  it("종료 → 수정 → 추가 순서로 처리해 종료한 악기 조합을 같은 호출에서 다시 추가할 수 있다", () => {
    const endAt = body().indexOf("private.end_student_enrollment(");
    const updateAt = body().indexOf("public.update_student_profile_from_date(");
    const addAt = body().indexOf("private.insert_student_enrollment(");

    expect(endAt).toBeGreaterThan(0);
    expect(updateAt).toBeGreaterThan(endAt);
    expect(addAt).toBeGreaterThan(updateAt);
  });

  it("악기 코드를 제자리에서 바꾸려는 요청과 종료된 수강 수정을 거부한다", () => {
    expect(body()).toContain("악기는 바꿀 수 없습니다. 기존 악기를 종료하고 새 악기를 추가해 주세요.");
    expect(body()).toContain("종료된 수강은 수정할 수 없습니다.");
  });

  it("수업 형태를 바꿔 수강 중인 같은 악기·수업 형태와 겹치는 경우만 한국어로 거부한다(종료한 수강은 충돌이 아니다)", () => {
    expect(body()).toContain("같은 악기·수업 형태의 수강 정보가 이미 있어 수업 형태를 바꿀 수 없습니다.");
    expect(body()).toMatch(/and other\.active\s+and other\.instrument_id = v_stored\.instrument_id/);
  });

  it("이번 저장에서 악기를 종료했는데 활성 악기가 남지 않으면 전체를 되돌리고, 종료가 없는 저장(이름·기본 정보만)은 막지 않는다", () => {
    expect(body()).toContain("수강 중인 악기는 최소 1개 있어야 합니다. 모두 종료하려면 휴원·퇴원 처리를 해 주세요.");
    expect(body()).toMatch(/count\(\*\)[\s\S]*instrument\.active/);
    expect(body()).toMatch(/if jsonb_array_length\(v_ended\) > 0 and v_active_count < 1 then/);
  });

  it("수정 항목은 요일 목록과 할인 종류 형식을 서버에서 확인한다", () => {
    expect(body()).toMatch(/jsonb_typeof\(v_item -> 'weekly_schedules'\) is distinct from 'array'/);
    expect(body()).toMatch(/jsonb_typeof\(v_item -> 'discount_kinds'\) = 'array'/);
    expect(body()).toContain("수강 요일 정보를 확인해 주세요.");
  });

  it("지원하지 않는 변경 종류는 거부하고 결과로 추가·종료 정보를 돌려준다", () => {
    expect(body()).toContain("지원하지 않는 수강 변경입니다.");
    expect(body()).toMatch(/returns jsonb/);
    expect(body()).toContain("'added'");
    expect(body()).toContain("'ended'");
    expect(body()).toContain("remaining_event_count");
  });

  it("추가한 수강의 시작 달 정기 일정을 만든다", () => {
    expect(body()).toContain("public.ensure_monthly_academy_lesson_events(");
  });
});

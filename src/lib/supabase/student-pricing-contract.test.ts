import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 이 migration의 계약만 확인한다. 여러 migration을 합친 schema-contract.test.ts와 달리
// 이전 정의에 같은 문자열이 있어서 통과하는 일을 막기 위해 파일 하나만 읽는다.
const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261018110000_student_pricing_age_discount.sql",
  ),
  "utf8",
).toLocaleLowerCase();

/** `create or replace function <name>(` 부터 다음 함수 정의 직전까지의 본문. */
function functionBody(name: string) {
  const start = migrationSql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const next = migrationSql.indexOf("create or replace function ", start + 10);

  return migrationSql.slice(start, next === -1 ? undefined : next);
}

describe("원생 나이 기준 연도 migration 계약", () => {
  it("students에 age_as_of_year를 추가하고 나이가 있는 기존 행은 created_at(KST) 연도로 채운다", () => {
    expect(migrationSql).toContain("alter table public.students");
    expect(migrationSql).toMatch(/add column if not exists age_as_of_year integer/);
    expect(migrationSql).toMatch(
      /update public\.students\s+set age_as_of_year = extract\(year from created_at at time zone 'asia\/seoul'\)::integer\s+where age is not null\s+and age_as_of_year is null/,
    );
  });

  it("등록 RPC는 나이를 입력받으면 age_as_of_year를 서버의 현재 KST 연도로 저장한다", () => {
    const body = functionBody("public.register_student_with_enrollments");

    expect(body).toContain("v_current_year integer := extract(year from (now() at time zone 'asia/seoul'))::integer");
    expect(body).toMatch(/age_as_of_year/);
    expect(body).toMatch(/case when p_age is null then null else v_current_year end/);
  });

  it("기본 정보 수정 RPC도 나이를 입력받으면 age_as_of_year를 서버의 현재 KST 연도로 저장한다", () => {
    const body = functionBody("public.update_student_basic_info");

    expect(body).toMatch(/age_as_of_year = case when p_age is null then null else v_current_year end/);
  });
});

describe("원생 할인 종류 migration 계약", () => {
  it("student_instruments에 할인 종류와 지인 소개 할인 달·금액 컬럼을 추가한다", () => {
    expect(migrationSql).toContain("alter table public.student_instruments");
    expect(migrationSql).toMatch(/add column if not exists discount_kinds text\[\] not null default '\{\}'/);
    expect(migrationSql).toMatch(/add column if not exists referral_discount_month date/);
    expect(migrationSql).toMatch(
      /add column if not exists referral_discount_amount integer not null default 0\s+check \(referral_discount_amount >= 0\)/,
    );
  });

  it("할인 종류는 허용된 값만 저장할 수 있다", () => {
    expect(migrationSql).toContain("discount_kinds <@ array['sibling', 'multi_instrument', 'referral']::text[]");
  });

  it.each(["public.register_student_with_enrollments", "public.update_student_profile_from_date"])(
    "%s는 할인 종류 값과 지인 소개 달·금액의 짝을 서버에서 검증한다",
    (name) => {
      const body = functionBody(name);

      expect(body).toContain("지원하지 않는 할인 종류입니다.");
      expect(body).toContain("지인 소개 할인은 소개한 달을 함께 선택해야 합니다.");
      expect(body).toContain("지인 소개 할인을 선택하지 않았다면 소개 할인액은 0원이어야 합니다.");
    },
  );

  it.each(["public.register_student_with_enrollments", "public.update_student_profile_from_date"])(
    "%s는 최종 수강료가 레슨비에서 매달 할인액을 뺀 금액(0 미만이면 0)과 같은지 확인한다",
    (name) => {
      const body = functionBody(name);

      expect(body).toContain("최종 수강료가 레슨비에서 할인액을 뺀 금액과 다릅니다.");
      expect(body).toMatch(/<>\s*greatest\(\s*(coalesce\(p_lesson_fee, 0\) - coalesce\(p_discount_total, 0\)|v_lesson_fee - v_discount_total), 0\)/);
    },
  );

  it("소개 달은 항상 그 달 1일로 맞춰 저장한다", () => {
    expect(migrationSql).toContain("date_trunc('month'");
  });

  it("수정 RPC는 할인 종류를 보내지 않은 호출에서 기존 할인 종류를 유지한다", () => {
    const body = functionBody("public.update_student_profile_from_date");

    expect(body).toContain("p_discount_kinds text[] default null");
    expect(body).toMatch(/discount_kinds = coalesce\(p_discount_kinds, discount_kinds\)/);
  });
});

describe("원생 수정 RPC 시그니처 교체 계약", () => {
  it("이전 시그니처를 먼저 지워 오버로드가 남지 않게 한다", () => {
    const dropIndex = migrationSql.indexOf("drop function if exists public.update_student_profile_from_date(");
    const createIndex = migrationSql.indexOf("create or replace function public.update_student_profile_from_date(");

    expect(dropIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThan(dropIndex);
    expect(migrationSql).toContain(
      "uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date, jsonb\n);",
    );
  });

  it("새 인자 네 개를 기본값이 있는 인자로 추가한다", () => {
    expect(migrationSql).toContain("p_discount_kinds text[] default null");
    expect(migrationSql).toContain("p_referral_discount_month date default null");
    expect(migrationSql).toContain("p_referral_discount_amount integer default null");
    expect(migrationSql).toContain("p_discount_label text default null");
  });

  it("수정 RPC는 할인 종류를 보낸 호출에서만 표시용 할인 라벨을 함께 갱신한다", () => {
    const body = functionBody("public.update_student_profile_from_date");

    expect(body).toMatch(
      /discount_label = case\s+when p_discount_kinds is null then discount_label\s+else nullif\(btrim\(coalesce\(p_discount_label, ''\)\), ''\)\s+end/,
    );
  });

  it("교체한 함수의 실행 권한을 로그인 사용자에게만 준다", () => {
    expect(migrationSql).toMatch(
      /revoke all on function public\.update_student_profile_from_date\([^)]*jsonb, text\[\], date, integer, text\s*\) from public, anon;/,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.update_student_profile_from_date\([^)]*jsonb, text\[\], date, integer, text\s*\) to authenticated;/,
    );
  });
});

describe("원생 기본 정보 수정 RPC 계약", () => {
  const body = () => functionBody("public.update_student_basic_info");

  it("지정한 인자 순서로 security definer 함수를 만든다", () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.update_student_basic_info\(\s*p_academy_id uuid,\s*p_student_id uuid,\s*p_registered_on date,\s*p_age integer,\s*p_grade text,\s*p_school text,\s*p_occupation text,\s*p_contact_relationship text,\s*p_contact_phone text\s*\)/,
    );
    expect(body()).toContain("security definer");
    expect(body()).toContain("set search_path = public, private, pg_temp");
  });

  it("로그인과 owner·desk 권한을 확인하고 한국어로 거부한다", () => {
    expect(body()).toContain("(select auth.uid()) is null");
    expect(body()).toContain("private.has_academy_role(");
    expect(body()).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
    expect(body()).toContain("원생 기본 정보를 수정할 권한이 없습니다.");
  });

  it("등록일·나이·연락처를 한국어 메시지로 검증한다", () => {
    expect(body()).toContain("등록일을 입력해 주세요.");
    expect(body()).toContain("나이는 0 이상이어야 합니다.");
    expect(body()).toContain("연락처 번호를 입력해 주세요.");
    expect(body()).toContain("원생을 찾지 못했습니다. 목록을 새로고침해 주세요.");
  });

  it("등록일·나이·학년·학교·직업을 수정하지만 출석 코드는 바꾸지 않는다", () => {
    expect(body()).toContain("registered_on = p_registered_on");
    expect(body()).toContain("grade = nullif(btrim(coalesce(p_grade, '')), '')");
    expect(body()).toContain("school = nullif(btrim(coalesce(p_school, '')), '')");
    expect(body()).toContain("occupation = nullif(btrim(coalesce(p_occupation, '')), '')");
    expect(body()).not.toContain("attendance_code");
  });

  it("연락처 번호가 바뀌면 phone_last4도 함께 갱신하고 연락처가 없으면 새로 만든다", () => {
    expect(body()).toContain("phone_last4 = nullif(v_phone_last4, '')");
    expect(body()).toContain("update public.student_contacts");
    expect(body()).toContain("insert into public.student_contacts");
    expect(body()).toContain("order by created_at, id");
  });

  it("실행 권한을 로그인 사용자에게만 준다", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.update_student_basic_info(uuid, uuid, date, integer, text, text, text, text, text) from public, anon;",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.update_student_basic_info(uuid, uuid, date, integer, text, text, text, text, text) to authenticated;",
    );
  });
});

describe("월 수강료 snapshot 지인 소개 할인 계약", () => {
  const body = () => functionBody("public.ensure_monthly_fixed_income_snapshots");

  it("기존 권한 검사와 월 형식 검사, 반환 형식, 중복 방지를 유지한다", () => {
    expect(body()).toContain("returns setof public.fixed_income_snapshots");
    expect(body()).toContain("array['owner'::public.academy_member_role]");
    expect(body()).toContain("월별 수강료 조회 권한이 없습니다.");
    expect(body()).toContain("월 형식은 yyyy-mm이어야 합니다.");
    expect(body()).toContain("on conflict (academy_id, month, student_id, instrument_id) do nothing");
  });

  it("소개 달과 같은 달에만 소개 할인액을 amount에서 추가로 빼고 discount_total에 더한다", () => {
    expect(body()).toContain("instrument.referral_discount_month = month_start");
    expect(body()).toContain("instrument.final_monthly_fee - applied.referral_applied");
    expect(body()).toContain("instrument.discount_total + applied.referral_applied");
  });

  it("소개 할인이 최종 수강료보다 커도 amount가 음수가 되지 않게 최종 수강료까지만 뺀다", () => {
    expect(body()).toContain("least(instrument.referral_discount_amount, instrument.final_monthly_fee)");
  });

  it("할인 라벨은 소개 할인이 적용되지 않는 달에는 지인 소개 할인을 빼고 나머지는 저장된 라벨을 그대로 쓴다", () => {
    expect(body()).toContain("'referral' = any (instrument.discount_kinds) and applied.referral_applied = 0");
    expect(body()).toContain("array_remove(string_to_array(instrument.discount_label, ', '), '지인 소개 할인')");
    expect(body()).toContain("else instrument.discount_label");
  });

  it("이미 만든 월 snapshot을 덮어쓰거나 지우지 않는다", () => {
    expect(body()).not.toContain("on conflict (academy_id, month, student_id, instrument_id) do update");
    expect(body()).not.toContain("delete from public.fixed_income_snapshots");
    expect(migrationSql).not.toMatch(/update public\.fixed_income_snapshots/);
  });
});

describe("파괴적 작업 금지", () => {
  it("테이블이나 원생 데이터를 지우지 않는다", () => {
    expect(migrationSql).not.toMatch(/drop table/);
    expect(migrationSql).not.toMatch(/delete from public\.students/);
    expect(migrationSql).not.toMatch(/truncate/);
  });
});

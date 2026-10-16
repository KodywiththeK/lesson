import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(fileName: string) {
  return readFileSync(path.join(process.cwd(), "supabase/migrations", fileName), "utf8").toLocaleLowerCase();
}

/** `create or replace function <name>` 한 개의 본문(다음 create 직전까지)을 잘라 낸다. */
function sliceFunction(sql: string, name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function", start + 10);

  return sql.slice(start, next === -1 ? undefined : next);
}

const ownerOnly = "array['owner'::public.academy_member_role]";

describe("시급제 서버 재계산 (20261018090000)", () => {
  const sql = readMigration("20261018090000_hourly_payroll_from_work_schedule.sql");
  const pay = sliceFunction(sql, "public.mark_salary_settlement_paid");

  it("시급은 출근 요일·시간(teacher_work_schedules)을 그 달 날짜에 펼쳐 계약 기간 안의 정수 분으로 다시 계산한다", () => {
    expect(pay).toContain("from public.teacher_work_schedules");
    expect(pay).toContain("contract_start_on");
    expect(pay).toContain("contract_end_on");
    expect(pay).toContain("greatest((p_month || '-01')::date, v_contract_start)");
    expect(pay).toContain("least(");
    expect(pay).toContain("generate_series(v_period_start::timestamp, v_period_end::timestamp, interval '1 day')");
    expect(pay).toContain("array['월', '화', '수', '목', '금', '토', '일']");
    expect(pay).toContain("extract(isodow from");
    expect(pay).toContain("floor(v_setting.hourly_rate::numeric * v_scheduled_minutes / 60)::integer");
    expect(pay).toContain("시급 급여가 출근 일정 계산과 다릅니다");
  });

  it("출근 요일이 없거나 시간이 비어 있으면 한국어 안내로 거부한다", () => {
    expect(pay).toContain("v_schedule_count = 0");
    expect(pay).toContain("출근 요일·시간을 설정해 주세요");
    expect(pay).toContain("v_unset_time_count > 0");
    expect(pay).toContain("출근 시간을 설정해 주세요");
  });

  it("시급제는 등원 수업 시간을 더하지 않고, 수업 목록 일치 검사는 비율제에만 남긴다", () => {
    expect(pay).not.toContain("v_worked_minutes");
    expect(pay).not.toContain("ends_at - event.starts_at");
    expect(pay).toContain("elsif p_pay_type = 'hourly' then");
    expect(pay).toContain("else\n    if v_provided_ids <> v_expected_ids then");
    expect(pay).toContain("case when p_pay_type = 'ratio' then v_provided_ids else '{}'::uuid[] end");
  });

  it("기존 보호는 그대로 유지한다: owner 전용, 월·선생님 advisory lock, 같은 달 중복 거부, 세금 검증, 월급·비율 검사", () => {
    expect(pay).toContain(ownerOnly);
    expect(pay).toContain("급여 지급 확정 권한이 없습니다");
    expect(pay).toContain("pg_advisory_xact_lock");
    expect(pay).toContain("이미 지급 완료된 급여입니다");
    expect(pay).toContain("p_net_pay <> p_base_pay - p_withholding_tax");
    expect(pay).toContain("* 33 / 1000");
    expect(pay).toContain("원천징수액이 계산과 다릅니다");
    expect(pay).toContain("월급이 설정 금액과 다릅니다");
    expect(pay).toContain("등원 기록이 없어 비율제 급여를 확정할 수 없습니다");
    expect(pay).toContain("security definer");
    expect(pay).toContain("set search_path = public, private, pg_temp");
    expect(pay).toContain("insert into public.ledger_entries");
    expect(pay).toContain("insert into public.salary_settlements");
  });

  it("anon·public 실행 권한을 회수하고 authenticated에만 부여한다", () => {
    const signature =
      "public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date)";

    expect(sql).toContain(`revoke all on function ${signature} from public`);
    expect(sql).toContain(`revoke all on function ${signature} from anon`);
    expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
  });
});

describe("선생님 등록·수정 RPC의 급여 설정 원장 전용 (20261018090100)", () => {
  const sql = readMigration("20261018090100_teacher_profile_owner_only_salary.sql");
  const register = sliceFunction(sql, "public.register_teacher_with_profile");
  const update = sliceFunction(sql, "public.update_teacher_profile");

  it("급여 인자가 하나라도 있으면 원장만 허용하고 아니면 한국어 예외로 전체를 거부한다", () => {
    for (const body of [register, update]) {
      expect(body).toContain("p_pay_type is not null");
      expect(body).toContain("or p_monthly_salary is not null");
      expect(body).toContain("or p_hourly_rate is not null");
      expect(body).toContain("or p_ratio_teacher_share is not null");
      expect(body).toContain(`if v_has_salary and not private.has_academy_role(`);
      expect(body).toContain(ownerOnly);
    }

    expect(register).toContain("급여 설정은 원장만 등록할 수 있습니다");
    expect(update).toContain("급여 설정은 원장만 수정할 수 있습니다");
  });

  it("급여 인자가 없으면 급여 설정과 salary_type을 건드리지 않는다", () => {
    expect(register).toContain("coalesce(p_pay_type, 'monthly')");
    expect(update).toContain("salary_type = coalesce(p_pay_type, salary_type)");

    for (const body of [register, update]) {
      expect(body).toMatch(/if v_has_salary then\s+perform private\.replace_teacher_salary_setting/);
      expect(body).toContain("private.validate_teacher_base_payload");
    }
  });

  it("owner·desk 모두 기본 정보를 쓸 수 있고 teacher는 거부한다", () => {
    const ownerDesk = "array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]";

    expect(register).toContain(ownerDesk);
    expect(register).toContain("선생님을 등록할 권한이 없습니다");
    expect(update).toContain(ownerDesk);
    expect(update).toContain("선생님 정보를 수정할 권한이 없습니다");
  });

  it("함수는 기존처럼 security invoker(RLS 유지)이고 anon·public 권한을 회수한다", () => {
    expect(sql).not.toContain("security definer");

    const flat = sql.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");

    for (const signature of [
      "public.register_teacher_with_profile(uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb)",
      "public.update_teacher_profile(uuid, uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb)",
    ]) {
      expect(flat).toContain(`revoke all on function ${signature} from public`);
      expect(flat).toContain(`revoke all on function ${signature} from anon`);
      expect(flat).toContain(`grant execute on function ${signature} to authenticated`);
    }
  });
});

describe("선생님 주민등록번호 암호화 저장·열람 (20261018090200)", () => {
  const sql = readMigration("20261018090200_teacher_resident_registration.sql");
  const save = sliceFunction(sql, "public.set_teacher_resident_registration");
  const reveal = sliceFunction(sql, "public.reveal_teacher_resident_registration");
  const readKey = sliceFunction(sql, "private.read_teacher_resident_registration_key");

  it("저장은 원장 전용이며 Vault 키로 pgp_sym_encrypt 암호화하고 마스킹 값을 함께 저장한다", () => {
    expect(save).toContain("security definer");
    expect(save).toContain("set search_path = ''");
    expect(save).toContain(ownerOnly);
    expect(save).toContain("주민등록번호는 원장만 등록·수정할 수 있습니다");
    expect(save).toContain("extensions.pgp_sym_encrypt(");
    expect(save).toContain("resident_registration_encrypted_ref = encode(");
    expect(save).toContain("resident_registration_masked = v_masked");
    expect(save).toContain("'******'");
    expect(save).toContain("private.read_teacher_resident_registration_key()");
  });

  it("저장은 서버에서도 13자리·성별 자리·생년월일을 다시 검증한다", () => {
    expect(save).toContain("length(v_digits) <> 13");
    expect(save).toContain("주민등록번호는 숫자 13자리(######-#######)로 입력해 주세요");
    expect(save).toContain("주민등록번호 성별 자리(뒤 첫 숫자)는 1~8이어야 합니다");
    expect(save).toContain("make_date(");
    expect(save).toContain("주민등록번호 앞 6자리가 올바른 생년월일이 아닙니다");
  });

  it("열람은 원장 전용이며 복호화 원문을 돌려주고 호출마다 열람 사실만 audit에 남긴다", () => {
    expect(reveal).toContain("security definer");
    expect(reveal).toContain("set search_path = ''");
    expect(reveal).toContain(ownerOnly);
    expect(reveal).toContain("주민등록번호 원문은 원장만 볼 수 있습니다");
    expect(reveal).toContain("extensions.pgp_sym_decrypt(");
    expect(reveal).toContain("insert into public.audit_events");
    expect(reveal).toContain("'teacher.resident_registration_revealed'");
    expect(reveal).toContain("등록된 주민등록번호가 없습니다");
    expect(reveal).toContain("return v_plain");
  });

  it("audit metadata에는 원문·마스킹 값 같은 개인정보를 넣지 않는다", () => {
    for (const body of [save, reveal]) {
      expect(body).toContain("jsonb_build_object('field', 'resident_registration')");
      const auditStart = body.indexOf("insert into public.audit_events");
      const audit = body.slice(auditStart, body.indexOf(");", body.indexOf("values (", auditStart)));
      expect(audit).not.toContain("v_plain,");
      expect(audit).not.toContain("v_digits");
      expect(audit).not.toContain("v_masked");
    }

    expect(save).toContain("'teacher.resident_registration_saved'");
  });

  it("키는 Vault의 teacher_rrn_key에서만 읽고 없으면 한국어 예외를 낸다", () => {
    expect(readKey).toContain("from vault.decrypted_secrets");
    expect(readKey).toContain("name = 'teacher_rrn_key'");
    expect(readKey).toContain("주민등록번호 암호화 키가 설정되지 않았습니다");
    expect(readKey).toContain("undefined_table or invalid_schema_name or insufficient_privilege");
  });

  it("Vault 키는 없을 때만 만들고 vault 스키마가 없어도 migration이 실패하지 않는다", () => {
    expect(sql).toContain("to_regnamespace('vault') is null");
    expect(sql).toContain("from vault.decrypted_secrets where name = 'teacher_rrn_key'");
    expect(sql).toContain("vault.create_secret(");
    expect(sql).toContain("extensions.gen_random_bytes(32)");
    expect(sql).toContain("exception\n    when others then\n      raise notice");
    // 이미 있는 키를 덮어쓰거나 삭제하지 않는다.
    expect(sql).not.toContain("update vault");
    expect(sql).not.toContain("delete from vault");
  });

  it("주민등록번호 컬럼은 API 역할의 직접 insert·update로 바꿀 수 없다", () => {
    expect(sql).toContain("create or replace function private.guard_teacher_resident_registration_columns");
    expect(sql).toContain("current_user in ('authenticated', 'anon')");
    expect(sql).toContain("new.resident_registration_encrypted_ref is distinct from");
    expect(sql).toContain("new.resident_registration_masked is distinct from");
    expect(sql).toContain("before insert or update on public.teachers");
  });

  it("새 함수는 public·anon 권한을 회수하고 키 읽기 함수는 authenticated도 실행할 수 없다", () => {
    for (const signature of [
      "public.set_teacher_resident_registration(uuid, uuid, text)",
      "public.reveal_teacher_resident_registration(uuid, uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public`);
      expect(sql).toContain(`revoke all on function ${signature} from anon`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
    }

    const key = "private.read_teacher_resident_registration_key()";

    for (const role of ["public", "anon", "authenticated"]) {
      expect(sql).toContain(`revoke all on function ${key} from ${role}`);
    }

    expect(sql).not.toContain(`grant execute on function ${key}`);
  });

  it("급여 금액만 오고 급여 형태가 없으면 DB 제약 오류 대신 한국어로 안내한다", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261018090100_teacher_profile_owner_only_salary.sql"),
      "utf8",
    );

    expect(sql).toContain("if v_has_salary and p_pay_type is null then");
    expect(sql).toContain("급여 형태를 선택해 주세요.");
  });
});

import { describe, expect, it } from "vitest";

import { toUserMessage } from "./user-message";

describe("toUserMessage", () => {
  it.each([
    ["not allowed", "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요."],
    ["permission denied for table ledger_entries", "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요."],
    [
      'new row violates row-level security policy for table "vendors"',
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    ],
    ["student not found", "원생 정보를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요."],
    ["withdrawn student not found", "원생 정보를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요."],
    ["Failed to fetch", "네트워크 연결을 확인한 뒤 다시 시도해 주세요."],
    ["JWT expired", "로그인이 만료되었습니다. 다시 로그인해 주세요."],
    [
      'duplicate key value violates unique constraint "vendors_pkey"',
      "이미 등록된 내용입니다. 목록을 확인해 주세요.",
    ],
    [
      "NEXT_PUBLIC_SUPABASE_URL 환경변수가 필요합니다.",
      "서비스 연결 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.",
    ],
    [
      "Supabase client 상태를 만들지 못했습니다.",
      "서비스 연결 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.",
    ],
    [
      'new row for relation "ledger_entries" violates check constraint "ledger_entries_amount_check"',
      "금액은 1원 이상이어야 합니다.",
    ],
    ["integer out of range", "금액이 너무 큽니다. 21억 원 미만으로 입력해 주세요."],
    [
      'value "3000000000" is out of range for type integer',
      "금액이 너무 큽니다. 21억 원 미만으로 입력해 주세요.",
    ],
    ['invalid input syntax for type date: "2026-13-45"', "날짜를 확인해 주세요."],
    [
      "JSON object requested, multiple (or no) rows returned",
      "대상을 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
    ],
    ["PGRST116", "대상을 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요."],
    ["수입 관리 권한이 없습니다.", "수입 관리 권한이 없습니다. 원장에게 문의해 주세요."],
    [
      "입출금 내역을 수정하지 못했습니다: 수입 관리 권한이 없습니다.",
      "수입 관리 권한이 없습니다. 원장에게 문의해 주세요.",
    ],
  ])("영문·내부 오류 '%s'를 사용자 문구로 바꾼다", (raw, expected) => {
    expect(toUserMessage(new Error(raw))).toBe(expected);
  });

  it("한글 접두사가 붙은 래핑 오류도 원인 부분을 번역한다", () => {
    expect(toUserMessage(new Error("개인레슨 출결을 저장하지 못했습니다: permission denied for table x"))).toBe(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
  });

  it("회차권 소진 오류는 내부 악기 코드를 숨기고 다음 행동을 안내한다", () => {
    expect(
      toUserMessage(new Error("개인레슨 출결을 저장하지 못했습니다: 사용 가능한 violin 회차권이 없습니다.")),
    ).toBe("사용할 수 있는 회차권이 없습니다. 회차권 메뉴에서 등록하거나 유효기간을 확인해 주세요.");
  });

  it("아직 적용되지 않은 DB 함수를 부르면 영문 원문 대신 적용이 필요하다고 안내한다", () => {
    expect(
      toUserMessage(
        new Error(
          "수강료 미납 처리에 실패했습니다: Could not find the function public.mark_fixed_income_snapshot_overdue(p_academy_id, p_snapshot_id) in the schema cache",
        ),
      ),
    ).toBe("이 기능에 필요한 데이터베이스 변경이 아직 적용되지 않았습니다. 관리자에게 문의해 주세요.");
    expect(toUserMessage(new Error("PGRST202"))).toBe(
      "이 기능에 필요한 데이터베이스 변경이 아직 적용되지 않았습니다. 관리자에게 문의해 주세요.",
    );
    expect(toUserMessage(new Error("column lesson_events.time_unspecified does not exist"))).toBe(
      "이 기능에 필요한 데이터베이스 변경이 아직 적용되지 않았습니다. 관리자에게 문의해 주세요.",
    );
  });

  it("이미 사용자에게 읽히는 한글 검증 메시지는 그대로 보여 준다", () => {
    expect(toUserMessage(new Error("선택한 선생님의 해당 시간에 이미 개인레슨이 있습니다."))).toBe(
      "선택한 선생님의 해당 시간에 이미 개인레슨이 있습니다.",
    );
  });

  it("알 수 없는 영문 원인이 붙은 한글 래핑 오류는 원인을 숨기고 재시도를 안내한다", () => {
    expect(toUserMessage(new Error("거래처를 저장하지 못했습니다: weird internal 500"))).toBe(
      "거래처를 저장하지 못했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.",
    );
  });

  it("알 수 없는 오류나 Error가 아닌 값은 일반 안내로 바꾼다", () => {
    const generic = "일시적인 문제가 발생했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.";
    expect(toUserMessage(new Error("kaboom"))).toBe(generic);
    expect(toUserMessage("kaboom")).toBe(generic);
    expect(toUserMessage(undefined)).toBe(generic);
  });
});

import { describe, expect, it } from "vitest";

import {
  formatResidentRegistrationInput,
  maskResidentRegistration,
  validateResidentRegistration,
} from "./teacher-resident-registration";

describe("formatResidentRegistrationInput", () => {
  it("숫자만 남기고 앞 6자리 뒤에 하이픈을 자동으로 붙인다", () => {
    expect(formatResidentRegistrationInput("9001011234567")).toBe("900101-1234567");
  });

  it("6자리까지는 하이픈 없이 두어 지우기 쉽게 한다", () => {
    expect(formatResidentRegistrationInput("900101")).toBe("900101");
    expect(formatResidentRegistrationInput("9001011")).toBe("900101-1");
  });

  it("이미 하이픈이 있거나 숫자가 아닌 문자가 섞여도 13자리까지만 정리한다", () => {
    expect(formatResidentRegistrationInput("900101-1234567")).toBe("900101-1234567");
    expect(formatResidentRegistrationInput(" 90 0101-12a34567999 ")).toBe("900101-1234567");
    expect(formatResidentRegistrationInput("")).toBe("");
  });
});

describe("validateResidentRegistration", () => {
  it("######-####### 형식의 유효한 번호는 하이픈 정규화된 값으로 통과한다", () => {
    expect(validateResidentRegistration("900101-1234567")).toEqual({
      ok: true,
      normalized: "900101-1234567",
    });
    expect(validateResidentRegistration("9001011234567")).toEqual({
      ok: true,
      normalized: "900101-1234567",
    });
  });

  it("숫자 13자리가 아니면 형식 안내를 돌려준다", () => {
    expect(validateResidentRegistration("900101-123456")).toEqual({
      ok: false,
      code: "format",
      reason: "주민등록번호는 숫자 13자리(######-#######)로 입력해 주세요.",
    });
    expect(validateResidentRegistration("abc")).toMatchObject({ ok: false });
  });

  it("생년월일 6자리가 실제 날짜가 아니면 거부한다", () => {
    const invalidDate = {
      ok: false,
      code: "birth-date",
      reason: "주민등록번호 앞 6자리가 올바른 생년월일이 아닙니다.",
    };

    expect(validateResidentRegistration("901301-1234567")).toEqual(invalidDate);
    expect(validateResidentRegistration("900230-1234567")).toEqual(invalidDate);
    expect(validateResidentRegistration("900100-1234567")).toEqual(invalidDate);
  });

  it("윤년 2월 29일은 성별 자리로 정해지는 출생 연도로 판정한다(1996·2000년 허용, 1997·1900년 거부)", () => {
    expect(validateResidentRegistration("000229-3234567").ok).toBe(true);
    expect(validateResidentRegistration("960229-1234567").ok).toBe(true);
    expect(validateResidentRegistration("970229-1234567").ok).toBe(false);
    expect(validateResidentRegistration("000229-1234567").ok).toBe(false);
  });

  it("성별 자리는 1~4(내국인)·5~8(외국인)만 허용한다", () => {
    for (const gender of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      expect(validateResidentRegistration(`900101-${gender}234567`).ok, gender).toBe(true);
    }

    for (const gender of ["0", "9"]) {
      expect(validateResidentRegistration(`900101-${gender}234567`), gender).toEqual({
        ok: false,
        code: "gender",
        reason: "주민등록번호 성별 자리(뒤 첫 숫자)는 1~8이어야 합니다.",
      });
    }
  });
});

describe("maskResidentRegistration", () => {
  it("앞 6자리와 성별 자리만 남기고 나머지는 *로 가린다", () => {
    expect(maskResidentRegistration("900101-1234567")).toBe("900101-1******");
    expect(maskResidentRegistration("9001011234567")).toBe("900101-1******");
  });

  it("13자리가 아닌 값은 가릴 수 없으므로 빈 문자열을 돌려준다", () => {
    expect(maskResidentRegistration("9001")).toBe("");
    expect(maskResidentRegistration("")).toBe("");
  });
});

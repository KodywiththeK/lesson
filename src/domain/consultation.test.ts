import { describe, expect, it } from "vitest";

import { instrumentOptions } from "@/features/students/student-form-options";

import {
  CONSULTATION_INSTRUMENT_NAMES,
  getConsultationRetentionCutoff,
  isConsultationExpired,
  toConsultationFormValues,
  validateConsultationForm,
  type ConsultationFormValues,
} from "./consultation";

const validForm: ConsultationFormValues = {
  name: " 김하늘 ",
  age: "9",
  instrumentNames: ["첼로", "피아노"],
  phone: " 010-1234-5678 ",
  school: " 새봄초 ",
  memo: " 화요일 오후 선호\n체험 수업 희망 ",
};

describe("CONSULTATION_INSTRUMENT_NAMES", () => {
  it("원생 등록 폼의 악기 표기와 같은 목록·순서를 쓴다", () => {
    expect([...CONSULTATION_INSTRUMENT_NAMES]).toEqual(
      instrumentOptions.map((instrument) => instrument.name),
    );
  });
});

describe("validateConsultationForm", () => {
  it("입력값을 다듬고 악기는 원생 등록 폼의 순서로 정렬한 상담 기록으로 바꾼다", () => {
    expect(validateConsultationForm(validForm)).toEqual({
      ok: true,
      profile: {
        name: "김하늘",
        age: 9,
        instrumentNames: ["피아노", "첼로"],
        phone: "010-1234-5678",
        school: "새봄초",
        memo: "화요일 오후 선호\n체험 수업 희망",
      },
    });
  });

  it("나이·악기·학교·특이사항은 비워도 되고, 목록에 없는 악기와 중복은 걸러낸다", () => {
    expect(
      validateConsultationForm({
        name: "박서준",
        age: "  ",
        instrumentNames: ["기타", "플루트", "플루트"],
        phone: "1234",
        school: "",
        memo: "",
      }),
    ).toEqual({
      ok: true,
      profile: {
        name: "박서준",
        age: undefined,
        instrumentNames: ["플루트"],
        phone: "1234",
        school: "",
        memo: "",
      },
    });
  });

  it("이름이 비어 있으면 입력을 안내하는 사유를 돌려준다", () => {
    expect(validateConsultationForm({ ...validForm, name: "  " })).toEqual({
      ok: false,
      reason: "이름을 입력해 주세요.",
    });
  });

  it("전화번호는 숫자가 4자리 이상이어야 한다", () => {
    const reason = "전화번호를 숫자 4자리 이상 입력해 주세요.";

    expect(validateConsultationForm({ ...validForm, phone: "" })).toEqual({ ok: false, reason });
    expect(validateConsultationForm({ ...validForm, phone: "010-" })).toEqual({ ok: false, reason });
    expect(validateConsultationForm({ ...validForm, phone: "02-12" })).toMatchObject({ ok: true });
  });

  it.each(["abc", "-1", "9.5", "151"])("나이 '%s'는 0~150 사이 정수가 아니므로 거부한다", (age) => {
    expect(validateConsultationForm({ ...validForm, age })).toEqual({
      ok: false,
      reason: "나이는 0~150 사이의 숫자로 입력해 주세요.",
    });
  });

  it("나이 0은 허용한다", () => {
    expect(validateConsultationForm({ ...validForm, age: "0" })).toMatchObject({
      ok: true,
      profile: { age: 0 },
    });
  });

  it("글자 수 제한을 넘기면 어느 항목인지 알려 준다", () => {
    expect(validateConsultationForm({ ...validForm, name: "가".repeat(51) })).toEqual({
      ok: false,
      reason: "이름은 50자 이하로 입력해 주세요.",
    });
    expect(validateConsultationForm({ ...validForm, school: "가".repeat(101) })).toEqual({
      ok: false,
      reason: "학교는 100자 이하로 입력해 주세요.",
    });
    expect(validateConsultationForm({ ...validForm, phone: "1".repeat(31) })).toEqual({
      ok: false,
      reason: "전화번호는 30자 이하로 입력해 주세요.",
    });
    expect(validateConsultationForm({ ...validForm, memo: "가".repeat(2001) })).toEqual({
      ok: false,
      reason: "특이사항은 2000자 이하로 입력해 주세요.",
    });
  });
});

describe("toConsultationFormValues", () => {
  it("저장된 상담 기록을 수정 폼의 문자열 입력값으로 되돌린다", () => {
    expect(
      toConsultationFormValues({
        name: "김하늘",
        age: 9,
        instrumentNames: ["피아노"],
        phone: "010-1234-5678",
        school: "",
        memo: "메모",
      }),
    ).toEqual({
      name: "김하늘",
      age: "9",
      instrumentNames: ["피아노"],
      phone: "010-1234-5678",
      school: "",
      memo: "메모",
    });
    expect(
      toConsultationFormValues({
        name: "박서준",
        instrumentNames: [],
        phone: "1234",
        school: "",
        memo: "",
      }).age,
    ).toBe("");
  });
});

describe("toConsultationFormValues 입력 범위", () => {
  it("목록 행처럼 접수일·id가 붙은 값을 넘겨도 폼 입력 항목만 남긴다", () => {
    const row = {
      academyId: "academy-1",
      consultationId: "consultation-1",
      receivedAt: "2026-10-10T01:00:00.000Z",
      name: "김하늘",
      instrumentNames: [],
      phone: "010-1111-2222",
      school: "",
      memo: "",
    };

    expect(Object.keys(toConsultationFormValues(row)).sort()).toEqual([
      "age",
      "instrumentNames",
      "memo",
      "name",
      "phone",
      "school",
    ]);
  });
});

describe("개인정보 보관 기간(접수일로부터 1년)", () => {
  it("보관 기준 시각은 지금으로부터 정확히 1년 전이다", () => {
    expect(getConsultationRetentionCutoff(new Date("2026-10-16T03:00:00.000Z"))).toBe(
      "2025-10-16T03:00:00.000Z",
    );
  });

  it("윤일에는 DB의 interval '1 year'처럼 전년도 말일로 맞춘다", () => {
    expect(getConsultationRetentionCutoff(new Date("2028-02-29T09:30:00.000Z"))).toBe(
      "2027-02-28T09:30:00.000Z",
    );
  });

  it("정확히 1년 된 접수는 보관하고, 1밀리초라도 지나면 만료로 본다", () => {
    const now = new Date("2026-10-16T03:00:00.000Z");

    expect(isConsultationExpired("2025-10-16T03:00:00.000Z", now)).toBe(false);
    expect(isConsultationExpired("2025-10-16T02:59:59.999Z", now)).toBe(true);
    expect(isConsultationExpired("2026-10-15T00:00:00.000Z", now)).toBe(false);
  });
});

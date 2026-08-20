import { describe, expect, it } from "vitest";

import { registerTeacher } from "./teacher";

describe("registerTeacher", () => {
  it("담당 파트, 연락처, 등록일, 주민등록번호 보안 참조, 급여 형태를 기록한다", () => {
    const teacher = registerTeacher({
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "박선생",
      part: "피아노",
      contact: "010-1234-5678",
      registeredAt: "2026-08-21",
      residentRegistrationNumber: {
        encryptedValueRef: "secure-vault:teacher-1-rrn",
        maskedValue: "900101-1******",
      },
      payType: "ratio",
    });

    expect(teacher).toEqual({
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "박선생",
      part: "피아노",
      contact: "010-1234-5678",
      registeredAt: "2026-08-21",
      residentRegistrationNumber: {
        encryptedValueRef: "secure-vault:teacher-1-rrn",
        maskedValue: "900101-1******",
      },
      payType: "ratio",
      active: true,
    });
  });

  it("선생님명, 담당 파트, 연락처, 암호화 참조, 마스킹 값은 필수다", () => {
    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
      }),
    ).toThrow("선생님명은 필수입니다.");

    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: " ",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
      }),
    ).toThrow("담당 파트는 필수입니다.");

    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "",
        registeredAt: "2026-08-21",
        residentRegistrationNumber: {
          encryptedValueRef: "",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
      }),
    ).toThrow("연락처는 필수입니다.");

    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        residentRegistrationNumber: {
          encryptedValueRef: "",
          maskedValue: " ",
        },
        payType: "monthly",
      }),
    ).toThrow("주민등록번호 보안 참조와 마스킹 값은 필수입니다.");
  });

  it("지원하지 않는 급여 형태는 등록을 막는다", () => {
    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "commission" as "ratio",
      }),
    ).toThrow("지원하지 않는 급여 형태입니다.");
  });
});

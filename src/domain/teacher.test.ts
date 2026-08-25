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
      contractStartOn: "2026-09-01",
      contractEndOn: "2027-08-31",
      residentRegistrationNumber: {
        encryptedValueRef: "secure-vault:teacher-1-rrn",
        maskedValue: "900101-1******",
      },
      payType: "ratio",
      ratioAcademyShare: 4,
      ratioTeacherShare: 6,
      workSchedules: [
        { weekday: "monday", startTime: "14:00", endTime: "20:00" },
        { weekday: "wednesday" },
      ],
    });

    expect(teacher).toEqual({
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "박선생",
      part: "피아노",
      contact: "010-1234-5678",
      registeredAt: "2026-08-21",
      contractStartOn: "2026-09-01",
      contractEndOn: "2027-08-31",
      residentRegistrationNumber: {
        encryptedValueRef: "secure-vault:teacher-1-rrn",
        maskedValue: "900101-1******",
      },
      payType: "ratio",
      ratioAcademyShare: 4,
      ratioTeacherShare: 6,
      salary: {
        payType: "ratio",
        ratioTeacherShare: 60,
      },
      workSchedules: [
        { weekday: "monday", startTime: "14:00", endTime: "20:00" },
        { weekday: "wednesday" },
      ],
      status: "employed",
      active: true,
    });
  });

  it("급여 형태별 필수 금액을 검증하고 비율제는 선생님 몫 퍼센트로 변환한다", () => {
    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
      }),
    ).toThrow("월급제는 월급 금액이 필요합니다.");

    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "hourly",
      }),
    ).toThrow("시급제는 시급 금액이 필요합니다.");

    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "ratio",
        ratioAcademyShare: 5,
        ratioTeacherShare: 6,
      }),
    ).toThrow("비율제는 학원 몫과 선생님 몫의 합계가 10이어야 합니다.");
  });

  it("계약기간과 근무시간 입력 규칙을 검증한다", () => {
    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        contractStartOn: "2027-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
        monthlySalary: 2500000,
      }),
    ).toThrow("계약 종료일은 계약 시작일보다 빠를 수 없습니다.");

    expect(() =>
      registerTeacher({
        academyId: "academy-1",
        teacherId: "teacher-1",
        name: "박선생",
        part: "피아노",
        contact: "010-1234-5678",
        registeredAt: "2026-08-21",
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
        monthlySalary: 2500000,
        workSchedules: [{ weekday: "monday", startTime: "14:00" }],
      }),
    ).toThrow("근무 시작 시간과 종료 시간은 함께 입력해야 합니다.");
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
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
        monthlySalary: 2500000,
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
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
        monthlySalary: 2500000,
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
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "",
          maskedValue: "900101-1******",
        },
        payType: "monthly",
        monthlySalary: 2500000,
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
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "",
          maskedValue: " ",
        },
        payType: "monthly",
        monthlySalary: 2500000,
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
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        residentRegistrationNumber: {
          encryptedValueRef: "secure-vault:teacher-1-rrn",
          maskedValue: "900101-1******",
        },
        payType: "commission" as "ratio",
      }),
    ).toThrow("지원하지 않는 급여 형태입니다.");
  });
});

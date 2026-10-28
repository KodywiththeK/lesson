import { describe, expect, it } from "vitest";

import {
  cancelDemoPrivateLessonAttendance,
  createInitialDemoAcademyState,
  markDemoPrivateLessonAttendance,
  registerDemoAcademyStudent,
  adjustDemoLessonTicket,
  registerDemoLessonTicket,
  registerDemoConsultation,
  deleteDemoVendor,
  registerDemoVendor,
  deleteDemoConsultation,
  updateDemoConsultation,
  updateDemoVendor,
} from "./academy-demo-state";

describe("academy demo state", () => {
  it("원생 등록 정보에서 학원 레슨 일정을 만들고 목록 선택지에 연결한다", () => {
    const state = createInitialDemoAcademyState();

    const next = registerDemoAcademyStudent(state, {
      name: "윤라온",
      registeredAt: "2026-08-21",
      contact: {
        relationship: "모",
        phone: "010-9999-1234",
      },
      instruments: [
        {
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "김하늘",
          lessonType: "academy",
          weeklySchedules: [
            { weekday: "friday", startTime: "14:00", endTime: "14:50" },
          ],
          progress: "바이엘 상",
          lessonFee: 150000,
          discountTotal: 10000,
          discountLabel: "형제할인",
          finalMonthlyFee: 140000,
        },
      ],
    });

    expect(next.students.some((student) => student.name === "윤라온")).toBe(true);
    expect(
      next.academySheets["2026-08-21"]?.rows.some(
        (row) => row.studentName === "윤라온" && row.startTime === "14:00",
      ),
    ).toBe(true);
    expect(
      next.ledgerEntries.some(
        (entry) =>
          entry.source === "tuition" &&
          entry.description === "윤라온 2026-08 피아노 수강료",
      ),
    ).toBe(true);
  });

  it("같은 원생·악기 구매도 별도 회차권과 수입 행으로 남긴다", () => {
    const state = createInitialDemoAcademyState();

    const { state: next, result } = registerDemoLessonTicket(state, {
      academyId: state.academyId,
      studentId: "student-4",
      instrumentId: "violin",
      instrumentName: "바이올린",
      grantedCount: 4,
      validDays: 30,
      registeredAt: "2026-08-21",
      paidAmount: 160000,
    });

    const ticket = next.tickets.find(
      (candidate) =>
        candidate.studentId === "student-4" &&
        candidate.instrumentId === "violin",
    );

    expect(next.tickets).toHaveLength(state.tickets.length + 1);
    expect(ticket).toMatchObject({
      ticketId: "ticket-1",
      totalGrantedCount: 8,
      remainingCount: 2,
    });
    expect(result).toEqual({
      ticketId: expect.stringMatching(/^ticket-demo-/),
      merged: false,
      totalGrantedCount: 4,
      remainingCount: 4,
      validFrom: "2026-08-21",
      validUntil: "2026-09-20",
    });
    expect(next.ledgerEntries).toContainEqual(
      expect.objectContaining({
        type: "income",
        source: "lesson-ticket",
        amount: 160000,
        description: "한서아 바이올린 회차권 4회 구매",
      }),
    );
  });

  it("권을 삭제한 뒤 다시 구매해도 남은 권과 ID가 겹치지 않는다", () => {
    const state = createInitialDemoAcademyState();
    const first = registerDemoLessonTicket(state, {
      academyId: state.academyId,
      studentId: "student-4",
      instrumentId: "violin",
      instrumentName: "바이올린",
      grantedCount: 4,
      validDays: 30,
      registeredAt: "2026-08-21",
      paidAmount: 160000,
    });
    const afterDeletion = { ...first.state, tickets: first.state.tickets.slice(1) };
    const { state: next } = registerDemoLessonTicket(afterDeletion, {
      academyId: state.academyId,
      studentId: "student-4",
      instrumentId: "violin",
      instrumentName: "바이올린",
      grantedCount: 4,
      validDays: 30,
      registeredAt: "2026-08-21",
      paidAmount: 160000,
    });

    expect(new Set(next.tickets.map((ticket) => ticket.ticketId)).size).toBe(next.tickets.length);
  });

  it("서비스권은 별도 회차권을 만들고 결제 수입을 남기지 않는다", () => {
    const state = createInitialDemoAcademyState();

    const { state: next, result } = registerDemoLessonTicket(state, {
      academyId: state.academyId,
      studentId: "student-1",
      instrumentId: "piano",
      instrumentName: "피아노",
      grantedCount: 8,
      validDays: 30,
      registeredAt: "2026-08-21",
      isService: true,
    });

    expect(next.tickets).toHaveLength(state.tickets.length + 1);
    expect(next.tickets.at(-1)).toMatchObject({
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      totalGrantedCount: 8,
      remainingCount: 8,
      validFrom: "2026-08-21",
      validUntil: "2026-09-20",
    });
    expect(result).toMatchObject({ merged: false, remainingCount: 8, validUntil: "2026-09-20" });
    expect(next.ledgerEntries).toHaveLength(state.ledgerEntries.length);
  });

  it("서비스 선택 없이 결제 금액을 비운 일반 구매는 거부한다", () => {
    const state = createInitialDemoAcademyState();
    expect(() => registerDemoLessonTicket(state, {
      academyId: state.academyId,
      studentId: "student-1",
      instrumentId: "piano",
      instrumentName: "피아노",
      grantedCount: 4,
      validDays: 30,
      registeredAt: "2026-08-21",
    })).toThrow("결제 금액을 입력하거나 서비스로 지급하기를 선택해 주세요.");
  });

  it("회차권 직접 수정은 부여 회수·잔여 회수·만료일을 바꾼다", () => {
    const state = createInitialDemoAcademyState();

    const { state: next, result } = adjustDemoLessonTicket(state, {
      academyId: state.academyId,
      ticketId: "ticket-1",
      totalGrantedCount: 10,
      remainingCount: 5,
      validUntil: "2026-09-30",
      reason: "수기 장부와 맞추기",
    });

    expect(next.tickets.find((ticket) => ticket.ticketId === "ticket-1")).toMatchObject({
      totalGrantedCount: 10,
      remainingCount: 5,
      validUntil: "2026-09-30",
    });
    expect(result).toEqual({
      ticketId: "ticket-1",
      totalGrantedCount: 10,
      remainingCount: 5,
      validUntil: "2026-09-30",
    });
  });

  it("없는 회차권이나 잘못된 수정 값은 오류로 막는다", () => {
    const state = createInitialDemoAcademyState();
    const input = {
      academyId: state.academyId,
      ticketId: "ticket-1",
      totalGrantedCount: 10,
      remainingCount: 5,
      validUntil: "2026-09-30",
      reason: "수기 장부와 맞추기",
    };

    expect(() => adjustDemoLessonTicket(state, { ...input, ticketId: "ticket-x" })).toThrow(
      "회차권을 찾지 못했습니다.",
    );
    expect(() => adjustDemoLessonTicket(state, { ...input, reason: " " })).toThrow(
      "수정 사유를 입력해 주세요.",
    );
  });

  it("개인레슨 출석 확인은 회차권을 한 번만 차감한다", () => {
    const state = createInitialDemoAcademyState();
    const lessonId = "private-lesson-1";

    const once = markDemoPrivateLessonAttendance(state, {
      lessonId,
      status: "present",
      markedAt: "2026-08-21T18:05:00+09:00",
    });
    const twice = markDemoPrivateLessonAttendance(once, {
      lessonId,
      status: "present",
      markedAt: "2026-08-21T18:06:00+09:00",
    });

    expect(
      state.tickets.find((ticket) => ticket.ticketId === "ticket-1")
        ?.remainingCount,
    ).toBe(2);
    expect(
      once.tickets.find((ticket) => ticket.ticketId === "ticket-1")
        ?.remainingCount,
    ).toBe(1);
    expect(
      twice.tickets.find((ticket) => ticket.ticketId === "ticket-1")
        ?.remainingCount,
    ).toBe(1);
  });

  it("개인레슨 결석은 사유를 저장하고, 비우면 기본 문구, 결석 상태에서 다시 저장하면 사유만 바뀐다", () => {
    const state = createInitialDemoAcademyState();
    const lessonId = "private-lesson-1";
    const reasonOf = (target: typeof state) =>
      target.privateLessons.find((lesson) => lesson.id === lessonId)?.absenceReason;
    const remainingOf = (target: typeof state) =>
      target.tickets.find((ticket) => ticket.ticketId === "ticket-1")?.remainingCount;

    const absentWithReason = markDemoPrivateLessonAttendance(state, {
      lessonId,
      status: "absent",
      markedAt: "2026-08-21T18:05:00+09:00",
      reason: "  감기로 결석  ",
    });
    const reasonEdited = markDemoPrivateLessonAttendance(absentWithReason, {
      lessonId,
      status: "absent",
      markedAt: "2026-08-21T18:06:00+09:00",
      reason: "가족 여행",
    });
    const reasonCleared = markDemoPrivateLessonAttendance(reasonEdited, {
      lessonId,
      status: "absent",
      markedAt: "2026-08-21T18:07:00+09:00",
    });
    const present = markDemoPrivateLessonAttendance(reasonCleared, {
      lessonId,
      status: "present",
      markedAt: "2026-08-21T18:08:00+09:00",
    });

    expect(reasonOf(absentWithReason)).toBe("감기로 결석");
    expect(reasonOf(reasonEdited)).toBe("가족 여행");
    expect(reasonOf(reasonCleared)).toBe("결석 확인");
    expect(reasonOf(present)).toBeUndefined();
    expect(remainingOf(reasonEdited)).toBe(remainingOf(state));
  });

  it("개인레슨 등원 확인을 취소하면 예정 상태로 돌아가고 차감한 회차권 1회를 복구한다", () => {
    const state = createInitialDemoAcademyState();
    const lessonId = "private-lesson-1";
    const remainingOf = (target: typeof state) =>
      target.tickets.find((ticket) => ticket.ticketId === "ticket-1")?.remainingCount;

    const present = markDemoPrivateLessonAttendance(state, {
      lessonId,
      status: "present",
      markedAt: "2026-08-21T18:05:00+09:00",
    });
    const cancelled = cancelDemoPrivateLessonAttendance(present, { lessonId });
    const cancelledAgain = cancelDemoPrivateLessonAttendance(cancelled, { lessonId });

    expect(remainingOf(present)).toBe(1);
    expect(remainingOf(cancelled)).toBe(2);
    expect(cancelled.ticketUsages).toEqual([]);
    expect(cancelled.privateLessons.find((lesson) => lesson.id === lessonId)?.status).toBe("scheduled");
    expect(remainingOf(cancelledAgain)).toBe(2);
  });

  it("거래처 등록은 거래처 목록에 신규 항목을 추가한다", () => {
    const state = createInitialDemoAcademyState();

    const next = registerDemoVendor(state, {
      name: "현악기 공방",
      contact: "02-7777-8888",
      kind: "수리",
      memo: "바이올린 브릿지 수리",
    });

    expect(next.vendors).toContainEqual(
      expect.objectContaining({
        name: "현악기 공방",
        kind: "수리",
      }),
    );
  });

  it("거래처 수정은 대상 거래처의 정보만 바꾸고 학원과 id는 유지한다", () => {
    const state = createInitialDemoAcademyState();
    const target = state.vendors[0];

    const next = updateDemoVendor(state, {
      vendorId: target.vendorId,
      name: "수정된 거래처",
      contact: "02-0000-0000",
      kind: "수리",
      memo: "수정 메모",
    });

    expect(next.vendors).toHaveLength(state.vendors.length);
    expect(next.vendors[0]).toEqual({
      academyId: target.academyId,
      vendorId: target.vendorId,
      name: "수정된 거래처",
      contact: "02-0000-0000",
      kind: "수리",
      memo: "수정 메모",
    });
    expect(next.vendors.slice(1)).toEqual(state.vendors.slice(1));
  });

  it("거래처 삭제는 대상 거래처만 목록에서 지운다", () => {
    const state = createInitialDemoAcademyState();
    const target = state.vendors[0];

    const next = deleteDemoVendor(state, { vendorId: target.vendorId });

    expect(next.vendors).toHaveLength(state.vendors.length - 1);
    expect(next.vendors.some((vendor) => vendor.vendorId === target.vendorId)).toBe(false);
    expect(next.vendors).toEqual(state.vendors.slice(1));
  });

  it("상담 데모 데이터는 반응형 표 확인을 위해 한 건 이상 있다", () => {
    expect(createInitialDemoAcademyState().consultations.length).toBeGreaterThan(0);
  });

  it("상담 등록은 접수 시각과 함께 상담 목록에 새 항목을 추가한다", () => {
    const state = createInitialDemoAcademyState();

    const next = registerDemoConsultation(
      state,
      {
        name: "정다은",
        age: 8,
        instrumentNames: ["피아노"],
        phone: "010-5555-6666",
        school: "새봄초",
        memo: "체험 수업 희망",
      },
      "2026-10-16T01:00:00.000Z",
    );

    expect(next.consultations).toHaveLength(state.consultations.length + 1);
    expect(next.consultations.at(-1)).toEqual({
      academyId: state.academyId,
      consultationId: expect.stringMatching(/^consultation-demo-/),
      name: "정다은",
      age: 8,
      instrumentNames: ["피아노"],
      phone: "010-5555-6666",
      school: "새봄초",
      memo: "체험 수업 희망",
      receivedAt: "2026-10-16T01:00:00.000Z",
    });
  });

  it("상담을 지운 뒤 새로 등록해도 기존 상담과 id가 겹치지 않는다", () => {
    const profile = { name: "정다은", instrumentNames: [], phone: "1234", school: "", memo: "" };
    let state = createInitialDemoAcademyState();
    state = registerDemoConsultation(state, profile, "2026-10-16T01:00:00.000Z");
    state = registerDemoConsultation(state, profile, "2026-10-16T02:00:00.000Z");
    state = deleteDemoConsultation(state, { consultationId: state.consultations[0].consultationId });
    state = registerDemoConsultation(state, profile, "2026-10-16T03:00:00.000Z");

    const ids = state.consultations.map((consultation) => consultation.consultationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("상담 수정은 대상 상담의 모든 입력 항목을 바꾸되 접수 시각과 id는 유지한다", () => {
    const state = createInitialDemoAcademyState();
    const target = state.consultations[0];

    const next = updateDemoConsultation(state, {
      consultationId: target.consultationId,
      name: "수정된 이름",
      age: undefined,
      instrumentNames: ["플루트"],
      phone: "02-0000",
      school: "",
      memo: "수정 메모",
    });

    expect(next.consultations[0]).toEqual({
      academyId: target.academyId,
      consultationId: target.consultationId,
      name: "수정된 이름",
      age: undefined,
      instrumentNames: ["플루트"],
      phone: "02-0000",
      school: "",
      memo: "수정 메모",
      receivedAt: target.receivedAt,
    });
    expect(next.consultations.slice(1)).toEqual(state.consultations.slice(1));
  });

  it("상담 삭제는 대상 상담만 목록에서 지운다", () => {
    const state = createInitialDemoAcademyState();
    const [target, ...rest] = state.consultations;

    const next = deleteDemoConsultation(state, { consultationId: target.consultationId });

    expect(next.consultations).toEqual(rest);
  });
});

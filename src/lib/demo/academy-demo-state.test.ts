import { describe, expect, it } from "vitest";

import {
  createInitialDemoAcademyState,
  markDemoPrivateLessonAttendance,
  registerDemoAcademyStudent,
  registerDemoBookRelease,
  registerDemoLessonTicketPurchase,
  registerDemoVendor,
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

  it("회차권 구매는 회차권 목록과 수입 ledger를 함께 갱신한다", () => {
    const state = createInitialDemoAcademyState();

    const next = registerDemoLessonTicketPurchase(state, {
      studentId: "student-4",
      studentName: "한서아",
      instrumentId: "violin",
      instrumentName: "바이올린",
      grantedCount: 4,
      validFrom: "2026-08-21",
      validUntil: "2026-09-20",
      registeredAt: "2026-08-21",
      paidAmount: 160000,
    });

    const ticket = next.tickets.find(
      (candidate) =>
        candidate.studentId === "student-4" &&
        candidate.instrumentId === "violin",
    );

    expect(ticket?.remainingCount).toBe(6);
    expect(next.ledgerEntries).toContainEqual(
      expect.objectContaining({
        type: "income",
        source: "lesson-ticket",
        amount: 160000,
        description: "한서아 바이올린 회차권 4회 구매",
      }),
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

  it("결제 완료 교재 출고는 구매 목록과 수입 ledger를 함께 갱신한다", () => {
    const state = createInitialDemoAcademyState();

    const next = registerDemoBookRelease(state, {
      studentId: "student-1",
      studentName: "김민지",
      bookTitle: "체르니 100",
      price: 13000,
      shippedAt: "2026-08-21",
      status: "paid",
    });

    expect(next.bookSales).toContainEqual(
      expect.objectContaining({
        studentName: "김민지",
        bookTitle: "체르니 100",
        status: "paid",
      }),
    );
    expect(next.ledgerEntries).toContainEqual(
      expect.objectContaining({
        type: "income",
        source: "book-sale",
        amount: 13000,
        description: "교재 판매: 체르니 100 / 김민지",
      }),
    );
  });
});

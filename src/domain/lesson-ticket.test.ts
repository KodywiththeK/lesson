import { describe, expect, it } from "vitest";

import {
  DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS,
  applyAttendanceToTicket,
  adjustLessonTicketManually,
  buildLessonTicketList,
  formatLessonTicketStatus,
  registerLessonTicket,
  summarizeLessonTicketStatus,
  type LessonTicketListItem,
} from "./lesson-ticket";

const baseTicket = {
  academyId: "academy-1",
  studentId: "student-1",
  instrumentId: "piano",
  remainingCount: 4,
};

const baseAttendance = {
  academyId: "academy-1",
  lessonEventId: "lesson-1",
  studentId: "student-1",
  instrumentId: "piano",
};

describe("applyAttendanceToTicket", () => {
  it("실제 출석 확인일 때만 회차권을 1회 차감하고 사용 기록을 만든다", () => {
    const result = applyAttendanceToTicket(baseTicket, {
      ...baseAttendance,
      status: "present",
    });

    expect(result.ticket.remainingCount).toBe(3);
    expect(result.usage).toMatchObject({
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      studentId: "student-1",
      instrumentId: "piano",
      usedCount: 1,
    });
  });

  it("결석은 회차권을 차감하지 않는다", () => {
    const result = applyAttendanceToTicket(baseTicket, {
      ...baseAttendance,
      status: "absent",
    });

    expect(result.ticket.remainingCount).toBe(4);
    expect(result.usage).toBeUndefined();
  });

  it("수업 일정에 올라간 상태만으로는 회차권을 차감하지 않는다", () => {
    const result = applyAttendanceToTicket(baseTicket, {
      ...baseAttendance,
      status: "scheduled",
    });

    expect(result.ticket.remainingCount).toBe(4);
    expect(result.usage).toBeUndefined();
  });

  it("다른 학원 회차권은 차감하지 못한다", () => {
    expect(() =>
      applyAttendanceToTicket(baseTicket, {
        ...baseAttendance,
        academyId: "academy-2",
        status: "present",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });

  it("같은 수업 출석을 두 번 처리해도 중복 차감하지 않는다", () => {
    const result = applyAttendanceToTicket(
      baseTicket,
      {
        ...baseAttendance,
        status: "present",
      },
      { alreadyDeductedLessonEventIds: ["lesson-1"] },
    );

    expect(result.ticket.remainingCount).toBe(4);
    expect(result.usage).toBeUndefined();
    expect(result.skippedReason).toBe("already-deducted");
  });
});

describe("registerLessonTicket", () => {
  const activeTicket = {
    academyId: "academy-1",
    studentId: "student-1",
    instrumentId: "piano",
    totalGrantedCount: 12,
    remainingCount: 3,
    validFrom: "2026-08-01",
    validUntil: "2026-09-30",
    registeredAt: "2026-08-01",
  };

  it("같은 학원, 원생, 악기의 활성 회차권에 회수와 유효기간을 추가한다", () => {
    const result = registerLessonTicket(activeTicket, {
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
      grantedCount: 10,
      validFrom: "2026-10-01",
      validUntil: "2026-11-30",
      registeredAt: "2026-09-20",
    });

    expect(result.ticket).toMatchObject({
      totalGrantedCount: 22,
      remainingCount: 13,
      validFrom: "2026-10-01",
      validUntil: "2026-11-30",
      registeredAt: "2026-09-20",
    });
    expect(result.event).toEqual({
      type: "merged-existing-ticket",
      addedCount: 10,
      previousValidUntil: "2026-09-30",
      nextValidUntil: "2026-11-30",
    });
  });

  it("기존 활성 회차권이 없으면 새 회차권을 만든다", () => {
    const result = registerLessonTicket(undefined, {
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      grantedCount: 8,
      validFrom: "2026-08-20",
      validUntil: "2026-10-20",
      registeredAt: "2026-08-20",
    });

    expect(result.ticket).toMatchObject({
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      totalGrantedCount: 8,
      remainingCount: 8,
      validUntil: "2026-10-20",
    });
    expect(result.event.type).toBe("created-new-ticket");
  });

  it("다른 학원 회차권에는 재등록을 병합하지 못한다", () => {
    expect(() =>
      registerLessonTicket(activeTicket, {
        academyId: "academy-2",
        studentId: "student-1",
        instrumentId: "piano",
        grantedCount: 10,
        validFrom: "2026-10-01",
        validUntil: "2026-11-30",
        registeredAt: "2026-09-20",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });

  it("유효 만료일이 시작일보다 빠른 회차권 등록은 막는다", () => {
    expect(() =>
      registerLessonTicket(undefined, {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        grantedCount: 10,
        validFrom: "2026-10-01",
        validUntil: "2026-09-30",
        registeredAt: "2026-09-20",
      }),
    ).toThrow("회차권 유효 만료일은 시작일 이후여야 합니다.");
  });
});

describe("summarizeLessonTicketStatus", () => {
  it("잔여 회차가 학원 설정 기준 이하이면 잔여 부족 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        totalGrantedCount: 12,
        remainingCount: 2,
        validFrom: "2026-08-01",
        validUntil: "2026-09-30",
        registeredAt: "2026-08-01",
      },
      {
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(summary.statuses).toContain("low-remaining");
  });

  it("만료일이 학원 설정 기준 안으로 다가오면 만료 임박 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        totalGrantedCount: 12,
        remainingCount: 6,
        validFrom: "2026-08-01",
        validUntil: "2026-09-08",
        registeredAt: "2026-08-01",
      },
      {
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(summary.daysUntilExpiration).toBe(7);
    expect(summary.statuses).toContain("expiring-soon");
  });

  it("만료되었거나 잔여 회차가 0이면 각각의 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        totalGrantedCount: 12,
        remainingCount: 0,
        validFrom: "2026-08-01",
        validUntil: "2026-08-31",
        registeredAt: "2026-08-01",
      },
      {
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(summary.statuses).toEqual(["exhausted", "expired"]);
  });
});

describe("buildLessonTicketList", () => {
  it("현재 학원의 회차권 목록을 원생명 가나다순으로 만들고 상태를 계산한다", () => {
    const list = buildLessonTicketList(
      [
        {
          academyId: "academy-1",
          ticketId: "ticket-2",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentId: "violin",
          instrumentName: "바이올린",
          totalGrantedCount: 8,
          remainingCount: 0,
          validFrom: "2026-08-01",
          validUntil: "2026-08-31",
          registeredAt: "2026-08-01",
        },
        {
          academyId: "academy-1",
          ticketId: "ticket-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          totalGrantedCount: 12,
          remainingCount: 2,
          validFrom: "2026-08-01",
          validUntil: "2026-09-07",
          registeredAt: "2026-08-01",
        },
        {
          academyId: "academy-2",
          ticketId: "ticket-3",
          studentId: "student-3",
          studentName: "다른학원",
          instrumentId: "piano",
          instrumentName: "피아노",
          totalGrantedCount: 12,
          remainingCount: 12,
          validFrom: "2026-08-01",
          validUntil: "2026-09-30",
          registeredAt: "2026-08-01",
        },
      ],
      {
        academyId: "academy-1",
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(list.items.map((row) => row.studentName)).toEqual(["김민지", "이서윤"]);
    expect(list.items[0]).toMatchObject({
      ticketId: "ticket-1",
      statuses: ["low-remaining", "expiring-soon"],
      daysUntilExpiration: 6,
    });
    expect(list.items[1]).toMatchObject({
      ticketId: "ticket-2",
      statuses: ["exhausted", "expired"],
    });
  });

  it("검색어와 상태 필터를 적용한다", () => {
    const list = buildLessonTicketList(
      [
        {
          academyId: "academy-1",
          ticketId: "ticket-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          totalGrantedCount: 12,
          remainingCount: 2,
          validFrom: "2026-08-01",
          validUntil: "2026-09-07",
          registeredAt: "2026-08-01",
        },
        {
          academyId: "academy-1",
          ticketId: "ticket-2",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentId: "violin",
          instrumentName: "바이올린",
          totalGrantedCount: 8,
          remainingCount: 8,
          validFrom: "2026-08-01",
          validUntil: "2026-10-31",
          registeredAt: "2026-08-01",
        },
      ],
      {
        academyId: "academy-1",
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
        search: "피아노",
        filters: {
          status: "low-remaining",
        },
      },
    );

    expect(list.items).toHaveLength(1);
    expect(list.items[0].studentName).toBe("김민지");
    expect(list.totalItems).toBe(1);
  });

  describe("페이지 나누기와 정렬", () => {
    const listOptions = {
      academyId: "academy-1",
      today: "2026-09-01",
      ...DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS,
    };

    function createTicket(
      overrides: Partial<LessonTicketListItem> = {},
    ): LessonTicketListItem {
      return {
        academyId: "academy-1",
        ticketId: "ticket-1",
        studentId: "student-1",
        studentName: "김민지",
        instrumentId: "piano",
        instrumentName: "피아노",
        totalGrantedCount: 12,
        remainingCount: 8,
        validFrom: "2026-08-01",
        validUntil: "2026-12-31",
        registeredAt: "2026-08-01",
        ...overrides,
      };
    }

    function createNumberedTickets(count: number) {
      return Array.from({ length: count }, (_, index) => {
        const number = String(index + 1).padStart(2, "0");

        return createTicket({
          ticketId: `ticket-${number}`,
          studentId: `student-${number}`,
          studentName: `원생${number}`,
        });
      });
    }

    it("기본은 10개씩 나누고 총 건수와 페이지 정보를 함께 준다", () => {
      const tickets = createNumberedTickets(25);

      const firstPage = buildLessonTicketList(tickets, listOptions);
      const lastPage = buildLessonTicketList(tickets, { ...listOptions, page: 3 });

      expect(firstPage.items.map((row) => row.studentName)).toEqual(
        Array.from({ length: 10 }, (_, index) => `원생${String(index + 1).padStart(2, "0")}`),
      );
      expect(firstPage).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasPreviousPage: false,
        hasNextPage: true,
      });
      expect(lastPage.items).toHaveLength(5);
      expect(lastPage).toMatchObject({ page: 3, hasPreviousPage: true, hasNextPage: false });
    });

    it("페이지당 20개를 고르면 20개씩 나눈다", () => {
      const view = buildLessonTicketList(createNumberedTickets(25), {
        ...listOptions,
        page: 2,
        pageSize: 20,
      });

      expect(view.items).toHaveLength(5);
      expect(view).toMatchObject({ page: 2, pageSize: 20, totalPages: 2 });
    });

    it("검색과 상태 필터를 적용한 결과를 기준으로 총 건수를 센다", () => {
      const tickets = [
        ...createNumberedTickets(12),
        createTicket({
          ticketId: "ticket-violin",
          studentId: "student-violin",
          studentName: "한서아",
          instrumentName: "바이올린",
          remainingCount: 1,
        }),
      ];

      const searched = buildLessonTicketList(tickets, { ...listOptions, search: "피아노" });
      const filtered = buildLessonTicketList(tickets, {
        ...listOptions,
        filters: { status: "low-remaining" },
      });

      expect(searched.totalItems).toBe(12);
      expect(filtered.totalItems).toBe(1);
      expect(filtered.items[0].studentName).toBe("한서아");
    });

    it("원생명, 악기, 유효기간, 상태 이름으로 검색한다", () => {
      const tickets = [
        createTicket({ ticketId: "ticket-1", studentName: "김민지", validUntil: "2026-09-05" }),
        createTicket({
          ticketId: "ticket-2",
          studentName: "이서윤",
          instrumentName: "바이올린",
          validUntil: "2026-12-31",
        }),
      ];
      const search = (keyword: string) =>
        buildLessonTicketList(tickets, { ...listOptions, search: keyword }).items.map((row) => row.ticketId);

      expect(search("이서")).toEqual(["ticket-2"]);
      expect(search("바이올")).toEqual(["ticket-2"]);
      expect(search("2026-09")).toEqual(["ticket-1"]);
      expect(search("임박")).toEqual(["ticket-1"]);
      expect(search("  김민지  ")).toEqual(["ticket-1"]);
    });

    it("원생명은 숫자 크기와 가나다 기준으로 정렬한다", () => {
      const view = buildLessonTicketList(
        ["원생10", "원생2", "하늘", "가은"].map((studentName, index) =>
          createTicket({
            ticketId: `ticket-${index}`,
            studentId: `student-${index}`,
            studentName,
          }),
        ),
        listOptions,
      );

      expect(view.items.map((row) => row.studentName)).toEqual(["가은", "원생2", "원생10", "하늘"]);
    });

    it("같은 원생이면 악기명, 만료일 순으로 정렬한다", () => {
      const view = buildLessonTicketList(
        [
          createTicket({ ticketId: "ticket-1", instrumentName: "피아노", validUntil: "2026-12-31" }),
          createTicket({ ticketId: "ticket-2", instrumentName: "피아노", validUntil: "2026-10-31" }),
          createTicket({ ticketId: "ticket-3", instrumentName: "바이올린", validUntil: "2027-01-31" }),
          createTicket({ ticketId: "ticket-4", studentName: "가은", studentId: "student-2" }),
          createTicket({ ticketId: "ticket-5", instrumentName: "피아노 심화", validUntil: "2026-10-01" }),
        ],
        listOptions,
      );

      expect(view.items.map((row) => row.ticketId)).toEqual([
        "ticket-4",
        "ticket-3",
        "ticket-2",
        "ticket-1",
        "ticket-5",
      ]);
    });

    it("이름·악기·만료일이 모두 같아도 페이지를 넘길 때 중복이나 누락이 없다", () => {
      const sameTickets = Array.from({ length: 12 }, (_, index) =>
        createTicket({ ticketId: `ticket-${index + 1}` }),
      );

      const firstPage = buildLessonTicketList(sameTickets, listOptions);
      const secondPage = buildLessonTicketList(sameTickets, { ...listOptions, page: 2 });
      const pagedIds = [...firstPage.items, ...secondPage.items].map((row) => row.ticketId);

      expect(pagedIds).toEqual(Array.from({ length: 12 }, (_, index) => `ticket-${index + 1}`));
    });
  });

  it("잔여 2회 이하는 잔여 부족, 만료 7일 전부터는 만료 임박으로 본다", () => {
    const ticket = { ...baseTicket, totalGrantedCount: 12, validFrom: "2026-08-01", registeredAt: "2026-08-01" };
    const statusOptions = { today: "2026-09-01", ...DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS };

    expect(
      summarizeLessonTicketStatus({ ...ticket, remainingCount: 2, validUntil: "2026-09-08" }, statusOptions).statuses,
    ).toEqual(["low-remaining", "expiring-soon"]);
    expect(
      summarizeLessonTicketStatus({ ...ticket, remainingCount: 3, validUntil: "2026-09-09" }, statusOptions).statuses,
    ).toEqual([]);
  });

  it("회차권 상태를 운영자가 읽는 한국어로 표시한다", () => {
    expect(formatLessonTicketStatus("low-remaining")).toBe("잔여 부족");
    expect(formatLessonTicketStatus("expiring-soon")).toBe("만료 임박");
    expect(formatLessonTicketStatus("expired")).toBe("만료");
    expect(formatLessonTicketStatus("exhausted")).toBe("소진");
  });
});

describe("adjustLessonTicketManually", () => {
  it("권한 있는 사용자는 사유와 함께 회차권 잔여 회수를 수동 조정할 수 있다", () => {
    const result = adjustLessonTicketManually(
      baseTicket,
      {
        academyId: "academy-1",
        deltaCount: 2,
        reason: "이전 수기 장부 누락 보정",
        adjustedAt: "2026-08-20T18:00:00+09:00",
        adjustedBy: "user-owner",
      },
      {
        canAdjust: true,
      },
    );

    expect(result.ticket.remainingCount).toBe(6);
    expect(result.event).toEqual({
      type: "manual-adjustment",
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
      previousRemainingCount: 4,
      nextRemainingCount: 6,
      deltaCount: 2,
      reason: "이전 수기 장부 누락 보정",
      adjustedAt: "2026-08-20T18:00:00+09:00",
      adjustedBy: "user-owner",
    });
  });

  it("권한이 없으면 회차권 수동 수정을 막는다", () => {
    expect(() =>
      adjustLessonTicketManually(
        baseTicket,
        {
          academyId: "academy-1",
          deltaCount: 1,
          reason: "테스트 조정",
          adjustedAt: "2026-08-20T18:00:00+09:00",
          adjustedBy: "teacher-1",
        },
        {
          canAdjust: false,
        },
      ),
    ).toThrow("회차권 수동 수정 권한이 없습니다.");
  });

  it("수동 조정 후 잔여 회차가 음수가 되면 막는다", () => {
    expect(() =>
      adjustLessonTicketManually(
        baseTicket,
        {
          academyId: "academy-1",
          deltaCount: -5,
          reason: "오등록 차감",
          adjustedAt: "2026-08-20T18:00:00+09:00",
          adjustedBy: "user-owner",
        },
        {
          canAdjust: true,
        },
      ),
    ).toThrow("잔여 회차는 0보다 작을 수 없습니다.");
  });
});

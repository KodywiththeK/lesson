import { describe, expect, it } from "vitest";

import {
  DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS,
  adjustLessonTicket,
  applyAttendanceToTicket,
  applyLessonTicketRegistration,
  buildLessonTicketList,
  calculateLessonTicketValidUntil,
  MAX_LESSON_TICKET_VALID_DAYS,
  formatLessonTicketStatus,
  describeLessonTicketRemainingDays,
  summarizeLessonTicketStatus,
  validateLessonTicketAdjustment,
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

describe("calculateLessonTicketValidUntil", () => {
  it("만료일은 등록일에 사용 기한(일수)을 더한 날짜다", () => {
    expect(calculateLessonTicketValidUntil("2026-09-01", 30)).toBe("2026-10-01");
    expect(calculateLessonTicketValidUntil("2026-01-31", 30)).toBe("2026-03-02");
    expect(calculateLessonTicketValidUntil("2028-02-01", 29)).toBe("2028-03-01");
  });

  it("사용 기한이 1일 미만이거나 정수가 아니면 막는다", () => {
    expect(() => calculateLessonTicketValidUntil("2026-09-01", 0)).toThrow(
      "사용 기한은 1일 이상의 정수여야 합니다.",
    );
    expect(() => calculateLessonTicketValidUntil("2026-09-01", 1.5)).toThrow(
      "사용 기한은 1일 이상의 정수여야 합니다.",
    );
  });

  it("사용 기한이 3650일을 넘으면 막는다", () => {
    expect(() => calculateLessonTicketValidUntil("2026-09-01", 3651)).toThrow(
      "사용 기한은 3650일 이하로 입력해 주세요.",
    );
    expect(calculateLessonTicketValidUntil("2026-09-01", MAX_LESSON_TICKET_VALID_DAYS)).toBe("2036-08-29");
  });
});

describe("applyLessonTicketRegistration", () => {
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

  it("같은 학원, 원생, 악기라도 새 구매는 별도 회차권으로 계산한다", () => {
    const result = applyLessonTicketRegistration(activeTicket, {
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
      grantedCount: 10,
      validDays: 30,
      registeredAt: "2026-09-20",
    });

    expect(result.ticket).toMatchObject({
      totalGrantedCount: 10,
      remainingCount: 10,
      validFrom: "2026-09-20",
      validUntil: "2026-10-20",
      registeredAt: "2026-09-20",
    });
    expect(result.event).toEqual({
      type: "created-new-ticket",
      addedCount: 10,
      nextValidUntil: "2026-10-20",
    });
  });

  it("잔여가 0인 회차권을 재등록하면 잔여는 신규 회수가 되고 만료일은 새로 계산된다", () => {
    const result = applyLessonTicketRegistration(
      { ...activeTicket, remainingCount: 0, validUntil: "2026-08-31" },
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        grantedCount: 8,
        validDays: 60,
        registeredAt: "2026-09-01",
      },
    );

    expect(result.ticket).toMatchObject({
      totalGrantedCount: 8,
      remainingCount: 8,
      validUntil: "2026-10-31",
    });
  });

  it("기존 회차권이 없으면 등록일을 시작일로 새 회차권을 만든다", () => {
    const result = applyLessonTicketRegistration(undefined, {
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      grantedCount: 8,
      validDays: 30,
      registeredAt: "2026-08-20",
    });

    expect(result.ticket).toMatchObject({
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      totalGrantedCount: 8,
      remainingCount: 8,
      validFrom: "2026-08-20",
      validUntil: "2026-09-19",
      registeredAt: "2026-08-20",
    });
    expect(result.event.type).toBe("created-new-ticket");
  });

  it("다른 학원 회차권에는 재등록을 병합하지 못한다", () => {
    expect(() =>
      applyLessonTicketRegistration(activeTicket, {
        academyId: "academy-2",
        studentId: "student-1",
        instrumentId: "piano",
        grantedCount: 10,
        validDays: 30,
        registeredAt: "2026-09-20",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });

  it("기존 마지막 등록일보다 과거 날짜로 재등록하지 못한다", () => {
    expect(() => applyLessonTicketRegistration(activeTicket, {
      academyId: "academy-1", studentId: "student-1", instrumentId: "piano",
      grantedCount: 4, validDays: 30, registeredAt: "2026-07-31",
    })).toThrow("등록일은 직전 등록일보다 앞설 수 없습니다.");
  });

  it("부여 회수나 사용 기한이 1 미만이면 등록을 막는다", () => {
    const registration = {
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
      grantedCount: 10,
      validDays: 30,
      registeredAt: "2026-09-20",
    };

    expect(() =>
      applyLessonTicketRegistration(undefined, { ...registration, grantedCount: 0 }),
    ).toThrow("회차권 부여 회수는 1 이상의 정수여야 합니다.");
    expect(() =>
      applyLessonTicketRegistration(undefined, { ...registration, validDays: 0 }),
    ).toThrow("사용 기한은 1일 이상의 정수여야 합니다.");
  });
});

describe("summarizeLessonTicketStatus", () => {
  const ticket = {
    academyId: "academy-1",
    studentId: "student-1",
    instrumentId: "piano",
    totalGrantedCount: 12,
    remainingCount: 6,
    validFrom: "2026-08-01",
    validUntil: "2026-09-30",
    registeredAt: "2026-08-01",
  };
  const statusOptions = { today: "2026-09-01", lowRemainingThreshold: 2 };

  it("잔여 회차가 기준 이하이면 잔여 부족 상태를 표시한다", () => {
    expect(
      summarizeLessonTicketStatus({ ...ticket, remainingCount: 2 }, statusOptions).statuses,
    ).toEqual(["low-remaining"]);
    expect(
      summarizeLessonTicketStatus({ ...ticket, remainingCount: 3 }, statusOptions).statuses,
    ).toEqual([]);
  });

  it("만료일이 다가와도 지나기 전에는 상태로 표시하지 않는다", () => {
    expect(
      summarizeLessonTicketStatus({ ...ticket, validUntil: "2026-09-02" }, statusOptions).statuses,
    ).toEqual([]);
    expect(
      summarizeLessonTicketStatus({ ...ticket, validUntil: "2026-09-01" }, statusOptions).statuses,
    ).toEqual([]);
  });

  it("만료일이 지났거나 잔여 회차가 0이면 각각의 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      { ...ticket, remainingCount: 0, validUntil: "2026-08-31" },
      statusOptions,
    );

    expect(summary.statuses).toEqual(["exhausted", "expired"]);
    expect(summarizeLessonTicketStatus({ ...ticket, remainingCount: 2, validUntil: "2026-08-31" }, statusOptions).statuses).toEqual(["expired"]);
  });
});

describe("buildLessonTicketList", () => {
  it("사용중과 사용완료를 나누고 사용중에서 정상과 잔여 부족을 고른다", () => {
    const base = { academyId: "a", studentId: "s", studentName: "원생", instrumentId: "p", instrumentName: "피아노", totalGrantedCount: 4, validFrom: "2026-01-01", registeredAt: "2026-01-01" };
    const tickets = [
      { ...base, ticketId: "normal", remainingCount: 3, validUntil: "2026-09-01" },
      { ...base, ticketId: "low", remainingCount: 2, validUntil: "2026-09-02" },
      { ...base, ticketId: "expired", remainingCount: 2, validUntil: "2026-08-31" },
      { ...base, ticketId: "exhausted", remainingCount: 0, validUntil: "2026-09-02" },
    ];
    const options = { academyId: "a", today: "2026-09-01", lowRemainingThreshold: 2 };
    expect(buildLessonTicketList(tickets, { ...options, filters: { group: "active" } }).items.map((row) => row.ticketId).sort()).toEqual(["low", "normal"]);
    expect(buildLessonTicketList(tickets, { ...options, filters: { group: "active", activeStatus: "normal" } }).items.map((row) => row.ticketId)).toEqual(["normal"]);
    expect(buildLessonTicketList(tickets, { ...options, filters: { group: "completed" } }).items.map((row) => row.ticketId).sort()).toEqual(["exhausted", "expired"]);
  });
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
      },
    );

    expect(list.items.map((row) => row.studentName)).toEqual(["김민지", "이서윤"]);
    expect(list.items[0]).toMatchObject({
      ticketId: "ticket-1",
      statuses: ["low-remaining"],
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

    it("원생명, 악기, 등록일, 만료일, 상태 이름으로 검색한다", () => {
      const tickets = [
        createTicket({
          ticketId: "ticket-1",
          studentName: "김민지",
          remainingCount: 2,
          registeredAt: "2026-07-15",
          validUntil: "2026-09-05",
        }),
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
      expect(search("2026-07")).toEqual(["ticket-1"]);
      expect(search("부족")).toEqual(["ticket-1"]);
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

  it("기본 기준은 잔여 2회 이하를 잔여 부족으로 본다", () => {
    const ticket = { ...baseTicket, totalGrantedCount: 12, validFrom: "2026-08-01", registeredAt: "2026-08-01", validUntil: "2026-09-08" };
    const statusOptions = { today: "2026-09-01", ...DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS };

    expect(DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS).toEqual({ lowRemainingThreshold: 2 });
    expect(summarizeLessonTicketStatus({ ...ticket, remainingCount: 2 }, statusOptions).statuses).toEqual(["low-remaining"]);
    expect(summarizeLessonTicketStatus({ ...ticket, remainingCount: 3 }, statusOptions).statuses).toEqual([]);
  });

  it("회차권 상태를 운영자가 읽는 한국어로 표시한다", () => {
    expect(formatLessonTicketStatus("low-remaining")).toBe("잔여 부족");
    expect(formatLessonTicketStatus("expired")).toBe("만료");
    expect(formatLessonTicketStatus("exhausted")).toBe("소진");
  });
});

describe("회차권 직접 수정", () => {
  const ticket = {
    academyId: "academy-1",
    studentId: "student-1",
    instrumentId: "piano",
    totalGrantedCount: 12,
    remainingCount: 4,
    validFrom: "2026-08-01",
    validUntil: "2026-09-30",
    registeredAt: "2026-08-01",
  };
  const validInput = {
    totalGrantedCount: 10,
    remainingCount: 6,
    validUntil: "2026-10-15",
    reason: "  수기 장부와 맞추기  ",
  };

  it("부여 회수, 잔여 회수, 만료일을 입력한 값으로 바꾼다", () => {
    expect(validateLessonTicketAdjustment(ticket, validInput)).toEqual({ ok: true });
    expect(adjustLessonTicket(ticket, validInput)).toMatchObject({
      totalGrantedCount: 10,
      remainingCount: 6,
      validUntil: "2026-10-15",
      validFrom: "2026-08-01",
    });
  });

  it.each([
    [{ totalGrantedCount: 0 }, "부여 회수는 1회 이상의 정수여야 합니다."],
    [{ totalGrantedCount: 1.5 }, "부여 회수는 1회 이상의 정수여야 합니다."],
    [{ remainingCount: -1 }, "잔여 회수는 0회 이상의 정수여야 합니다."],
    [{ remainingCount: 11 }, "잔여 회수는 부여 회수보다 많을 수 없습니다."],
    [{ validUntil: "2026-07-31" }, "만료일은 마지막 등록일 이후여야 합니다."],
    [{ validUntil: "" }, "만료일을 입력해 주세요."],
    [{ reason: "   " }, "수정 사유를 입력해 주세요."],
  ])("잘못된 입력 %j은 이유와 함께 막는다", (override, reason) => {
    const input = { ...validInput, ...override };

    expect(validateLessonTicketAdjustment(ticket, input)).toEqual({ ok: false, reason });
    expect(() => adjustLessonTicket(ticket, input)).toThrow(reason);
  });

  it("잔여 회수가 0이어도 부여 회수 이하이면 허용한다", () => {
    expect(
      validateLessonTicketAdjustment(ticket, { ...validInput, remainingCount: 0 }),
    ).toEqual({ ok: true });
  });

  it("재등록 후 만료일을 마지막 등록일보다 앞으로 당길 수 없다", () => {
    expect(validateLessonTicketAdjustment(
      { ...ticket, registeredAt: "2026-09-01" },
      { ...validInput, validUntil: "2026-08-31" },
    )).toEqual({ ok: false, reason: "만료일은 마지막 등록일 이후여야 합니다." });
  });
});

describe("회차권 남은 일수", () => {
  it("만료 당일과 지난 날짜를 서울 기준 날짜 문자열로 구분한다", () => {
    expect(describeLessonTicketRemainingDays("2026-09-01", "2026-09-01")).toBe("0일 남음 · 오늘까지 사용 가능");
    expect(describeLessonTicketRemainingDays("2026-09-02", "2026-09-01")).toBe("1일 남음");
    expect(describeLessonTicketRemainingDays("2026-08-31", "2026-09-01")).toBe("1일 지남");
  });
});

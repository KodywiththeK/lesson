import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLessonTicketList,
  type LessonTicketListItem,
} from "@/domain/lesson-ticket";

import {
  LessonTicketListScreen,
  type LessonTicketListQueryOptionsFactory,
  type LessonTicketRegistrationOptionsQueryFactory,
} from "./lesson-ticket-list-screen";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const lessonTickets: LessonTicketListItem[] = [
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
];

type ScreenProps = ComponentProps<typeof LessonTicketListScreen>;

function renderLessonTicketListScreen(
  queryOptionsFactory: LessonTicketListQueryOptionsFactory,
  extraProps: Partial<Pick<
    ScreenProps,
    | "registrationOptionsQueryFactory"
    | "registerLessonTicket"
    | "adjustLessonTicket"
    | "canRecordPayment"
    | "getLessonTicketRefundPreview"
    | "deleteLessonTicket"
  >> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonTicketListScreen
        academyId="academy-1"
        today="2026-09-01"
        canRecordPayment={extraProps.canRecordPayment ?? true}
        queryOptionsFactory={queryOptionsFactory}
        {...extraProps}
      />
    </QueryClientProvider>,
  );
}

function listLessonTickets(tickets: LessonTicketListItem[] = lessonTickets): LessonTicketListQueryOptionsFactory {
  return (options) => ({
    queryKey: ["lesson-tickets", options.academyId, options.search ?? "", options.filters?.status ?? ""],
    queryFn: async () => buildLessonTicketList(tickets, options),
  });
}

const pianoRegistrationOptions: LessonTicketRegistrationOptionsQueryFactory = (academyId) => ({
  queryKey: ["lesson-ticket-registration-options", academyId],
  queryFn: async () => [
    {
      studentId: "student-1",
      studentName: "김민지",
      instruments: [{ instrumentId: "piano", instrumentName: "피아노" }],
    },
    {
      studentId: "student-2",
      studentName: "한서아",
      instruments: [
        { instrumentId: "violin", instrumentName: "바이올린" },
        { instrumentId: "cello", instrumentName: "첼로" },
      ],
    },
  ],
});

// 원생01~원생25. 앞 15명은 피아노, 나머지는 바이올린. 원생05부터는 잔여 2회로 잔여 부족 상태다.
const manyLessonTickets: LessonTicketListItem[] = Array.from({ length: 25 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const isPiano = index < 15;

  return {
    academyId: "academy-1",
    ticketId: `ticket-${number}`,
    studentId: `student-${number}`,
    studentName: `원생${number}`,
    instrumentId: isPiano ? "piano" : "violin",
    instrumentName: isPiano ? "피아노" : "바이올린",
    totalGrantedCount: 12,
    remainingCount: index >= 4 ? 2 : 8,
    validFrom: "2026-08-01",
    validUntil: "2026-12-31",
    registeredAt: "2026-08-01",
  };
});

const pagedQueryOptionsFactory: LessonTicketListQueryOptionsFactory = (options) => ({
  queryKey: [
    "lesson-tickets",
    options.academyId,
    options.search ?? "",
    options.filters?.status ?? "",
    options.page ?? "",
    options.pageSize ?? "",
  ],
  queryFn: async () => buildLessonTicketList(manyLessonTickets, options),
});

describe("LessonTicketListScreen", () => {
  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  it("회차권 목록을 표로 보여주고 원생, 악기, 총 부여·사용·잔여 회수, 등록일, 만료일, 상태를 표시한다", async () => {
    renderLessonTicketListScreen(listLessonTickets());

    const table = await screen.findByRole("table", { name: "회차권 목록" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual([
      "원생",
      "악기",
      "총 부여",
      "사용",
      "잔여",
      "등록일",
      "만료일",
      "남은 일수",
      "상태",
      "관리",
    ]);

    const row = within(table).getByRole("row", { name: /김민지/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "김민지",
      "피아노",
      "12회유료 12회 · 서비스 0회",
      "10회",
      "2회유료 2회 · 서비스 0회",
      "2026-08-01",
      "2026-09-07",
      "6일 남음",
      "잔여 부족",
      "수정삭제",
    ]);
    expect(
      within(row).getByRole("button", { name: "김민지 피아노 회차권 수정" }),
    ).toBeInTheDocument();
    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual(headers);
    expect(screen.queryByRole("list", { name: "모바일 회차권 목록" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "김민지 피아노 회차권 수정" })).toHaveLength(1);
  });

  it("만료 당일은 0일 남음과 오늘까지 사용 가능을, 지난 회차권은 만료를 보여준다", async () => {
    renderLessonTicketListScreen(listLessonTickets([
      { ...lessonTickets[0], validUntil: "2026-09-01", remainingCount: 3 },
      { ...lessonTickets[1], validUntil: "2026-08-31" },
    ]));
    const table = await screen.findByRole("table", { name: "회차권 목록" });
    expect(within(within(table).getByRole("row", { name: /김민지/ })).getByText("0일 남음 · 오늘까지 사용 가능")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /이서윤/ })).getByText("만료")).toBeInTheDocument();
  });

  it("잔여가 부족하거나 소진된 회차권은 눈에 띄는 배지로, 만료일이 다가오는 것만으로는 강조하지 않는다", async () => {
    renderLessonTicketListScreen(
      listLessonTickets([
        ...lessonTickets,
        {
          ...lessonTickets[1],
          ticketId: "ticket-3",
          studentName: "박소진",
          remainingCount: 0,
        },
        {
          ...lessonTickets[1],
          ticketId: "ticket-4",
          studentId: "student-4",
          studentName: "정임박",
          remainingCount: 6,
          validUntil: "2026-09-03",
        },
      ]),
    );

    const table = await screen.findByRole("table", { name: "회차권 목록" });
    const lowBadge = within(within(table).getByRole("row", { name: /김민지/ })).getByText("잔여 부족");
    const exhaustedBadge = within(within(table).getByRole("row", { name: /박소진/ })).getByText("소진");
    const nearExpiryRow = within(table).getByRole("row", { name: /정임박/ });

    expect(lowBadge).toHaveAttribute("data-variant", "destructive");
    expect(exhaustedBadge).toHaveAttribute("data-variant", "destructive");
    expect(within(nearExpiryRow).getByText("정상")).toBeInTheDocument();
    expect(within(nearExpiryRow).queryByText("만료 임박")).not.toBeInTheDocument();
  });

  it("상태 필터는 잔여 부족, 만료, 소진만 고를 수 있다", async () => {
    renderLessonTicketListScreen(listLessonTickets());

    await screen.findByRole("table", { name: "회차권 목록" });
    const options = within(screen.getByLabelText("회차권 상태 필터"))
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["전체", "잔여 부족", "만료", "소진"]);
  });

  it("검색어와 상태 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<LessonTicketListQueryOptionsFactory>[0][] =
      [];

    renderLessonTicketListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "lesson-tickets",
          options.academyId,
          options.search ?? "",
          options.filters?.status ?? "",
        ],
        queryFn: async () => buildLessonTicketList(lessonTickets, options),
      };
    });

    await screen.findByRole("cell", { name: "김민지" });

    await user.type(
      screen.getByRole("searchbox", { name: "회차권 검색" }),
      "피아노",
    );
    await user.selectOptions(screen.getByLabelText("회차권 상태 필터"), "low-remaining");

    expect(await screen.findByRole("cell", { name: "김민지" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "이서윤" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "피아노",
      filters: {
        status: "low-remaining",
      },
    });
    expect(seenOptions.at(-1)).not.toHaveProperty("expiringWithinDays");
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderLessonTicketListScreen((options) => ({
      queryKey: ["lesson-tickets", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "회차권 목록을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });
});

describe("회차권 등록 폼", () => {
  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  async function openRegistrationDialog(extraProps: Parameters<typeof renderLessonTicketListScreen>[1] = {}) {
    const user = userEvent.setup();

    renderLessonTicketListScreen(listLessonTickets(), {
      registrationOptionsQueryFactory: pianoRegistrationOptions,
      ...extraProps,
    });
    await user.click(screen.getByRole("button", { name: "회차권 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 등록" });
    await within(dialog).findByRole("option", { name: "피아노" });
    await user.selectOptions(within(dialog).getByLabelText("악기"), "piano");
    await within(dialog).findByRole("option", { name: "김민지" });

    return { user, dialog };
  }

  it("부여 회수 4회, 사용 기한 30일, 등록일 오늘로 시작하고 유효 시작일·만료일 입력칸은 없다", async () => {
    const { user, dialog } = await openRegistrationDialog();

    expect(within(dialog).getByRole("spinbutton", { name: "부여 회수" })).toHaveValue(4);
    expect(within(dialog).getByRole("spinbutton", { name: "사용 기한(일)" })).toHaveValue(30);
    expect(within(dialog).getByLabelText("등록일")).toHaveValue("2026-09-01");
    expect(within(dialog).queryByLabelText("유효 시작일")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("유효 만료일")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("만료일")).not.toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("piano");

    await user.selectOptions(within(dialog).getByLabelText("악기"), "violin");
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-2");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("violin");
  });

  it("결제 입력 권한이 없으면 결제 입력을 숨기고 개인레슨 악기가 없는 원생을 후보에서 제외한다", async () => {
    const { dialog } = await openRegistrationDialog({
      canRecordPayment: false,
      registrationOptionsQueryFactory: (academyId) => ({
        queryKey: ["options", academyId],
        queryFn: async () => [
          { studentId: "student-1", studentName: "김민지", instruments: [{ instrumentId: "piano", instrumentName: "피아노" }] },
          { studentId: "student-3", studentName: "악기 없음", instruments: [] },
        ],
      }),
    });
    expect(within(dialog).queryByRole("spinbutton", { name: "결제 금액" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "악기 없음" })).not.toBeInTheDocument();
  });

  it("만료일은 등록일 + 사용 기한으로 계산해 미리 보여주고 입력이 바뀌면 다시 계산한다", async () => {
    const { dialog } = await openRegistrationDialog();

    expect(within(dialog).getByText("입력 기준 만료일: 2026-10-01")).toBeInTheDocument();
    expect(within(dialog).getByText("기존 회차권과 합치지 않고 새 회차권으로 등록합니다.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "사용 기한(일)" }), {
      target: { value: "60" },
    });
    expect(within(dialog).getByText("입력 기준 만료일: 2026-10-31")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("등록일"), {
      target: { value: "2026-09-15" },
    });
    expect(within(dialog).getByText("입력 기준 만료일: 2026-11-14")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "사용 기한(일)" }), {
      target: { value: "0" },
    });
    expect(within(dialog).getByText("입력 기준 만료일: 사용 기한을 1~3650일로 입력해 주세요")).toBeInTheDocument();
  });

  it("일반 등록은 양수 결제가 필수이고 서비스 지급은 별도로 선택한다", async () => {
    const { user, dialog } = await openRegistrationDialog();
    const amountInput = within(dialog).getByRole<HTMLInputElement>("textbox", { name: "결제 금액" });

    expect(amountInput).toHaveValue("");
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    for (const [value, isValid] of [
      ["0", false],
      ["1", true],
      ["140000", true],
      ["140,000", true],
      ["-1000", false],
      ["1.5", false],
    ] as const) {
      fireEvent.change(amountInput, { target: { value } });
      expect(within(dialog).getByRole("button", { name: "저장" }).hasAttribute("disabled"), `${value}원 입력`).toBe(!isValid);
    }
    fireEvent.change(amountInput, { target: { value: "2147483648" } });
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    expect(
      within(dialog).getByText(/양수 금액을 입력하면 수입 내역에 기록됩니다/),
    ).toBeInTheDocument();
  });

  it("서비스 지급을 선택하면 결제 금액 없이 0원 등록 요청을 보낸다", async () => {
    const registrations: Array<Record<string, unknown>> = [];
    const { user, dialog } = await openRegistrationDialog({
      registerLessonTicket: async (input) => {
        registrations.push(input);

        return {
          ticketId: "ticket-3",
          merged: false,
          totalGrantedCount: input.grantedCount,
          remainingCount: input.grantedCount,
          validFrom: input.registeredAt,
          validUntil: "2026-10-31",
        };
      },
    });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.click(within(dialog).getByRole("checkbox", { name: "서비스로 지급하기" }));
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "10" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "사용 기한(일)" }), {
      target: { value: "60" },
    });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(registrations).toEqual([
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          grantedCount: 10,
          validDays: 60,
          registeredAt: "2026-09-01",
          paidAmount: 0,
          isService: true,
        },
      ]);
    });
    expect(screen.queryByRole("dialog", { name: "회차권 등록" })).toBeNull();
    expect(toastMock.success).toHaveBeenCalledWith("새 회차권 10회를 등록했습니다. 만료일은 2026-10-31입니다.");
  });

  it("결제 금액을 입력하면 유료 등록 요청을 보낸다", async () => {
    const registrations: Array<Record<string, unknown>> = [];
    const { user, dialog } = await openRegistrationDialog({
      registerLessonTicket: async (input) => {
        registrations.push(input);

        return {
          ticketId: "ticket-3",
          merged: false,
          totalGrantedCount: input.grantedCount,
          remainingCount: input.grantedCount,
          validFrom: input.registeredAt,
          validUntil: "2026-10-01",
        };
      },
    });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "결제 금액" }), {
      target: { value: "150,000" },
    });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(registrations).toHaveLength(1));
    expect(registrations[0]).toMatchObject({ paidAmount: 150000, isService: false });
  });

  it("부여 회수나 사용 기한이 1 미만이면 저장할 수 없다", async () => {
    const { user, dialog } = await openRegistrationDialog();

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "결제 금액" }), {
      target: { value: "1000" },
    });
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "0" },
    });
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "3" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "사용 기한(일)" }), {
      target: { value: "" },
    });
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("다시 구매하면 기존 권에 합치지 않고 새 권의 회수와 만료일을 알린다", async () => {
    const { user, dialog } = await openRegistrationDialog({
      registerLessonTicket: async () => ({
        ticketId: "ticket-1",
        merged: false,
        totalGrantedCount: 10,
        remainingCount: 10,
        validFrom: "2026-08-01",
        validUntil: "2026-10-01",
      }),
    });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "결제 금액" }), {
      target: { value: "1000" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "10" },
    });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        "새 회차권 10회를 등록했습니다. 만료일은 2026-10-01입니다.",
      );
    });
  });

  it("서버가 거절하면 한국어 사유를 보여주고 다이얼로그를 유지한다", async () => {
    const { user, dialog } = await openRegistrationDialog({
      registerLessonTicket: async () => {
        throw new Error(
          "회차권을 등록하지 못했습니다: 결제 금액을 수입으로 기록하는 것은 원장만 할 수 있습니다. 결제 금액을 비우고 등록해 주세요.",
        );
      },
    });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "결제 금액" }), {
      target: { value: "1000" },
    });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("회차권 등록에 실패했습니다.", {
        description:
          "결제 금액을 수입으로 기록하는 것은 원장만 할 수 있습니다. 결제 금액을 비우고 등록해 주세요.",
      });
    });
    expect(screen.getByRole("dialog", { name: "회차권 등록" })).toBeInTheDocument();
  });
});

describe("회차권 직접 수정", () => {
  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  async function openAdjustDialog(adjustLessonTicket?: ScreenProps["adjustLessonTicket"]) {
    const user = userEvent.setup();

    renderLessonTicketListScreen(listLessonTickets(), { adjustLessonTicket });
    await user.click(await screen.findByRole("button", { name: "김민지 피아노 회차권 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 수정" });

    return { user, dialog };
  }

  it("원생·악기는 읽기 전용으로 보여주고 현재 회수와 만료일을 채워 연다", async () => {
    const { dialog } = await openAdjustDialog();

    expect(within(dialog).getByText("김민지")).toBeInTheDocument();
    expect(within(dialog).getByText("피아노")).toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox", { name: "원생" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("spinbutton", { name: "부여 회수" })).toHaveValue(12);
    expect(within(dialog).getByRole("spinbutton", { name: "잔여 회수" })).toHaveValue(2);
    expect(within(dialog).getByLabelText("만료일")).toHaveValue("2026-09-07");
    expect(within(dialog).getByLabelText("수정 사유")).toHaveValue("");
  });

  it("수정 사유가 비어 있으면 저장 버튼이 비활성이고 이유를 문장으로 알려준다", async () => {
    const { user, dialog } = await openAdjustDialog();

    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    expect(within(dialog).getByText("수정 사유를 입력해 주세요.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("수정 사유"), "수기 장부와 맞추기");

    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();
    expect(within(dialog).queryByText("수정 사유를 입력해 주세요.")).not.toBeInTheDocument();
  });

  it("잘못된 값은 이유를 알려주고 저장할 수 없다", async () => {
    const { user, dialog } = await openAdjustDialog();
    await user.type(within(dialog).getByLabelText("수정 사유"), "수기 장부와 맞추기");

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "잔여 회수" }), {
      target: { value: "13" },
    });
    expect(within(dialog).getByText("잔여 회수는 부여 회수보다 많을 수 없습니다.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "잔여 회수" }), {
      target: { value: "-1" },
    });
    expect(within(dialog).getByText("잔여 회수는 0회 이상의 정수여야 합니다.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "잔여 회수" }), {
      target: { value: "0" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "0" },
    });
    expect(within(dialog).getByText("부여 회수는 1회 이상의 정수여야 합니다.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "12" },
    });
    fireEvent.change(within(dialog).getByLabelText("만료일"), {
      target: { value: "2026-07-31" },
    });
    expect(within(dialog).getByText("만료일은 마지막 등록일 이후여야 합니다.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("저장하면 수정 요청을 보내고 다이얼로그를 닫으며 성공을 알린다", async () => {
    const adjustments: Array<Record<string, unknown>> = [];
    const { user, dialog } = await openAdjustDialog(async (input) => {
      adjustments.push(input);

      return {
        ticketId: input.ticketId,
        totalGrantedCount: input.totalGrantedCount,
        remainingCount: input.remainingCount,
        validUntil: input.validUntil,
      };
    });

    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "10" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "잔여 회수" }), {
      target: { value: "6" },
    });
    fireEvent.change(within(dialog).getByLabelText("만료일"), {
      target: { value: "2026-10-15" },
    });
    await user.type(within(dialog).getByLabelText("수정 사유"), "수기 장부와 맞추기");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(adjustments).toEqual([
        {
          academyId: "academy-1",
          ticketId: "ticket-1",
          totalGrantedCount: 10,
          remainingCount: 6,
          validUntil: "2026-10-15",
          reason: "수기 장부와 맞추기",
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "회차권 수정" })).not.toBeInTheDocument();
    });
    expect(toastMock.success).toHaveBeenCalledWith("회차권을 수정했습니다.");
  });

  it("서버가 거절하면 한국어 사유를 보여주고 다이얼로그를 유지한다", async () => {
    const { user, dialog } = await openAdjustDialog(async () => {
      throw new Error("회차권을 수정하지 못했습니다: 회차권을 찾지 못했습니다.");
    });
    await user.type(within(dialog).getByLabelText("수정 사유"), "수기 장부와 맞추기");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("회차권 수정에 실패했습니다.", {
        description: "회차권을 찾지 못했습니다.",
      });
    });
    expect(screen.getByRole("dialog", { name: "회차권 수정" })).toBeInTheDocument();
  });
});

describe("회차권 삭제", () => {
  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  const refundPreview = {
    policy: "proportional_always" as const,
    totalGrantedCount: 12,
    usedCount: 10,
    eligible: true,
    refundAmount: 50_000,
    canDeleteAsMistake: false,
  };

  async function openDeleteDialog(extraProps: Parameters<typeof renderLessonTicketListScreen>[1] = {}) {
    const user = userEvent.setup();

    renderLessonTicketListScreen(listLessonTickets(), {
      getLessonTicketRefundPreview: async () => refundPreview,
      ...extraProps,
    });
    await user.click(await screen.findByRole("button", { name: "김민지 피아노 회차권 삭제" }));
    const dialog = await screen.findByRole("alertdialog", { name: "회차권을 삭제할까요?" });
    await within(dialog).findByText(/현재 규정/);

    return { user, dialog };
  }

  it("행마다 삭제 버튼을 두고 눌러야 확인창이 열린다", async () => {
    renderLessonTicketListScreen(listLessonTickets());

    expect(await screen.findByRole("button", { name: "김민지 피아노 회차권 삭제" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이서윤 바이올린 회차권 삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("환불 처리로 삭제하면 환불 금액을 알리고 확인창을 닫는다", async () => {
    const deletions: Array<Record<string, unknown>> = [];
    const { user, dialog } = await openDeleteDialog({
      deleteLessonTicket: async (input) => {
        deletions.push(input);

        return { mode: "refund", refunded: true, refundAmount: 50_000 };
      },
    });

    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deletions).toEqual([{ academyId: "academy-1", ticketId: "ticket-1", mode: "refund" }]);
      expect(toastMock.success).toHaveBeenCalledWith("회차권을 삭제하고 50,000원을 환불 처리했습니다.");
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("환불할 금액이 없으면 수입 내역이 그대로라고 알린다", async () => {
    const { user, dialog } = await openDeleteDialog({
      deleteLessonTicket: async () => ({ mode: "refund", refunded: false, refundAmount: 0 }),
    });

    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("회차권을 삭제했습니다. 환불할 금액이 없어 수입 내역은 그대로입니다."),
    );
  });

  it("잘못 등록해서 삭제하면 수입 기록까지 지웠다고 알린다", async () => {
    const deletions: Array<Record<string, unknown>> = [];
    const { user, dialog } = await openDeleteDialog({
      getLessonTicketRefundPreview: async () => ({ ...refundPreview, usedCount: 0, canDeleteAsMistake: true }),
      deleteLessonTicket: async (input) => {
        deletions.push(input);

        return { mode: "mistake", refunded: false, refundAmount: 0 };
      },
    });

    await user.click(await within(dialog).findByRole("radio", { name: /잘못 등록해서 삭제/ }));
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deletions).toEqual([{ academyId: "academy-1", ticketId: "ticket-1", mode: "mistake" }]);
      expect(toastMock.success).toHaveBeenCalledWith("잘못 등록한 회차권과 수입 기록을 삭제했습니다.");
    });
  });

  it("서버가 거절하면 한국어 사유를 보여주고 확인창을 유지한다", async () => {
    const { user, dialog } = await openDeleteDialog({
      deleteLessonTicket: async () => {
        throw new Error("회차권을 삭제하지 못했습니다: 이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.");
      },
    });

    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("회차권 삭제에 실패했습니다.", {
        description: "이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.",
      }),
    );
    expect(screen.getByRole("alertdialog", { name: "회차권을 삭제할까요?" })).toBeInTheDocument();
  });
});

describe("LessonTicketListScreen 페이지 이동", () => {
  it("총 회차권 개수와 페이지당 개수 선택을 항상 보여주고 10개씩 표시한다", async () => {
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    const table = await screen.findByRole("table", { name: "회차권 목록" });

    expect(screen.getByText("총 25개")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByRole("cell", { name: "원생10" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "원생11" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 회차권 수" })).toHaveValue("10");
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("회차권이 10개 이하여도 총 개수와 페이지 이동을 보여준다", async () => {
    renderLessonTicketListScreen((options) => ({
      queryKey: ["lesson-tickets", options.academyId, options.page ?? ""],
      queryFn: async () => buildLessonTicketList(lessonTickets, options),
    }));

    await screen.findByRole("table", { name: "회차권 목록" });

    expect(screen.getByText("총 2개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
  });

  it("다음 페이지로 이동하면 11번째 회차권부터 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(await screen.findByRole("cell", { name: "원생11" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "원생01" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("페이지당 20개를 고르면 1페이지로 돌아가 20개를 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "원생21" });
    await user.selectOptions(screen.getByRole("combobox", { name: "페이지당 회차권 수" }), "20");

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "원생20" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "원생21" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("검색하면 1페이지로 돌아가 검색 결과의 첫 회차권부터 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.type(screen.getByRole("searchbox", { name: "회차권 검색" }), "피아노");

    expect(await screen.findByText("총 15개")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("상태 필터를 바꾸면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "원생21" });
    await user.selectOptions(screen.getByLabelText("회차권 상태 필터"), "low-remaining");

    expect(await screen.findByText("총 21개")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "원생05" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("초기화하면 1페이지로 돌아가 전체 회차권을 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.click(screen.getByRole("button", { name: "초기화" }));

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByText("총 25개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("조건에 맞는 회차권이 없어도 총 0개를 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.type(screen.getByRole("searchbox", { name: "회차권 검색" }), "없는이름");

    expect(await screen.findByText("조건에 맞는 회차권이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0개")).toBeInTheDocument();
  });
});

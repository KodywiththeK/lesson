import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LedgerEntry } from "@/domain/book-sale";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";

import { FinanceLedgerListScreen } from "./finance-ledger-screen";
import { resetFinanceMonthForTest } from "./finance-shared";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const entry = (overrides: Partial<LedgerEntry> & Pick<LedgerEntry, "ledgerId">): LedgerEntry => ({
  academyId: "academy-1",
  occurredOn: "2026-08-10",
  type: "income",
  source: "manual",
  category: "other",
  amount: 1000,
  description: "내역",
  refId: overrides.ledgerId,
  ...overrides,
});

const entries: LedgerEntry[] = [
  entry({ ledgerId: "book", occurredOn: "2026-08-20", source: "book-sale", category: "book-sale", amount: 12000, description: "교재 판매: 바이엘 2 / 김민지" }),
  entry({ ledgerId: "extra", occurredOn: "2026-08-02", amount: 3000, description: "추가 수강료" }),
  entry({ ledgerId: "tuning", occurredOn: "2026-08-14", type: "expense", category: "tuning-repair", amount: 70000, description: "피아노 조율비" }),
  entry({ ledgerId: "payroll", occurredOn: "2026-08-31", type: "expense", source: "payroll", category: "payroll", amount: 840000, description: "박선생 8월 급여" }),
  entry({ ledgerId: "july", occurredOn: "2026-07-31", amount: 99000, description: "7월 임시 수입" }),
];

type Props = Partial<ComponentProps<typeof FinanceLedgerListScreen>>;

function renderLedger(data: LedgerEntry[] = entries, props: Props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <FinanceLedgerListScreen
        academyId="academy-1"
        academyName="더 클래식"
        queryOptionsFactory={(options) => ({
          queryKey: ["ledger-spec", JSON.stringify(options)],
          queryFn: async () => buildFinanceLedgerList(data, options),
        })}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetFinanceMonthForTest();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00"));
});
afterEach(() => vi.useRealTimers());

async function openRegisterForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "수동 입출금 등록" }));

  return screen.findByRole("dialog", { name: "수동 입출금 등록" });
}

describe("월 합계 카드", () => {
  it("선택한 월의 총 입금과 총 출금을 색과 함께 보여 주고 검색·필터와 무관하다", async () => {
    const user = userEvent.setup();
    renderLedger();

    const income = await screen.findByRole("group", { name: "월별 총 수입 (입금)" });
    const expense = screen.getByRole("group", { name: "월별 총 출금" });
    await waitFor(() => expect(within(income).getByText("15,000원")).toBeInTheDocument());
    expect(within(income).getByText("15,000원")).toHaveClass("text-income");
    expect(within(expense).getByText("910,000원")).toHaveClass("text-expense");

    await user.type(screen.getByRole("searchbox", { name: "입출금 내역 검색" }), "조율");
    await user.selectOptions(screen.getByLabelText("유형 필터"), "expense");
    await waitFor(() =>
      expect(screen.queryByRole("cell", { name: "추가 수강료" })).not.toBeInTheDocument(),
    );

    expect(within(income).getByText("15,000원")).toBeInTheDocument();
    expect(within(expense).getByText("910,000원")).toBeInTheDocument();
  });

  it("월을 바꾸면 그 월의 합계와 기간으로 바뀌고 이번 달보다 뒤의 월은 고를 수 없다", async () => {
    const user = userEvent.setup();
    renderLedger();
    await user.click(screen.getByRole("button", { name: "상세 필터" }));
    const income = await screen.findByRole("group", { name: "월별 총 수입 (입금)" });

    fireEvent.change(screen.getByLabelText("입출금 월 선택"), { target: { value: "2026-07" } });

    await waitFor(() => expect(within(income).getByText("99,000원")).toBeInTheDocument());
    expect(screen.getByLabelText("입출금 시작일")).toHaveValue("2026-07-01");

    fireEvent.change(screen.getByLabelText("입출금 월 선택"), { target: { value: "2026-09" } });
    expect(screen.getByLabelText("입출금 월 선택")).toBeInvalid();
    expect(within(income).getByText("99,000원")).toBeInTheDocument();
  });
});

describe("등록 폼", () => {
  it("날짜·유형·분류·내용·금액만 보여 주고 금액은 비어 있다", async () => {
    const user = userEvent.setup();
    renderLedger();
    const dialog = await openRegisterForm(user);

    expect(within(dialog).getByLabelText("발생일")).toHaveValue("2026-08-21");
    expect(within(dialog).getByLabelText("유형")).toHaveValue("income");
    expect(within(dialog).getByLabelText("분류")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("설명")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("출처")).not.toBeInTheDocument();
    const amount = within(dialog).getByRole("textbox", { name: "금액" });
    expect(amount).toHaveValue("");
    expect(amount).toHaveAttribute("placeholder", "금액(원)");
    expect(amount).toHaveAttribute("inputmode", "numeric");
  });

  it("유형에 맞는 분류만 보여 주고 유형을 바꾸면 분류를 기본값으로 되돌린다", async () => {
    const user = userEvent.setup();
    renderLedger();
    const dialog = await openRegisterForm(user);
    const category = within(dialog).getByLabelText("분류");

    expect(within(category).queryByRole("option", { name: "임대료" })).not.toBeInTheDocument();
    expect(within(category).getByRole("option", { name: "수강료" })).toBeInTheDocument();

    await user.selectOptions(category, "tuition");
    await user.selectOptions(within(dialog).getByLabelText("유형"), "expense");

    expect(category).toHaveValue("other");
    expect(within(category).queryByRole("option", { name: "수강료" })).not.toBeInTheDocument();
    expect(within(category).getByRole("option", { name: "임대료" })).toBeInTheDocument();
  });

  it("저장할 수 없는 이유를 인라인으로 알리고 버튼에 연결한다", async () => {
    const user = userEvent.setup();
    renderLedger();
    const dialog = await openRegisterForm(user);
    const submit = within(dialog).getByRole("button", { name: "저장" });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription("금액을 입력해 주세요.");

    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "70000" } });
    expect(submit).toHaveAccessibleDescription("설명을 입력해 주세요.");

    await user.type(within(dialog).getByLabelText("설명"), "추가 수강료");
    expect(submit).toBeEnabled();
    expect(submit).not.toHaveAccessibleDescription();
  });

  it("20억 원 이상의 금액은 저장하지 못하게 한다", async () => {
    const user = userEvent.setup();
    renderLedger();
    const dialog = await openRegisterForm(user);

    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "2000000000" } });
    await user.type(within(dialog).getByLabelText("설명"), "너무 큰 금액");

    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    expect(within(dialog).getByText("금액은 20억 원 미만으로 입력해 주세요.")).toBeInTheDocument();
  });

  it("쉼표가 있는 금액을 그대로 입력해도 정확한 원 단위로 저장한다", async () => {
    const user = userEvent.setup();
    const registerManualLedgerEntry = vi.fn().mockResolvedValue(undefined);
    renderLedger(entries, { registerManualLedgerEntry });
    const dialog = await openRegisterForm(user);

    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "140,000" } });
    await user.type(within(dialog).getByLabelText("설명"), "수강료");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(registerManualLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 140000 }),
    ));
  });

  it("입력한 값을 출처 없이 등록하고 다이얼로그를 닫는다", async () => {
    const user = userEvent.setup();
    const registerManualLedgerEntry = vi.fn().mockResolvedValue(undefined);
    renderLedger(entries, { registerManualLedgerEntry });
    const dialog = await openRegisterForm(user);

    await user.selectOptions(within(dialog).getByLabelText("유형"), "expense");
    await user.selectOptions(within(dialog).getByLabelText("분류"), "supplies");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "45000" } });
    await user.type(within(dialog).getByLabelText("설명"), "  현악기 줄 교체비  ");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(registerManualLedgerEntry).toHaveBeenCalledExactlyOnceWith({
        academyId: "academy-1",
        occurredOn: "2026-08-21",
        type: "expense",
        category: "supplies",
        amount: 45000,
        description: "현악기 줄 교체비",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastMock.success).toHaveBeenCalledWith("수동 입출금을 등록했습니다.");
  });

  it("저장하는 동안에는 '저장 중'으로 바뀌고 다시 제출되지 않는다", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const registerManualLedgerEntry = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    renderLedger(entries, { registerManualLedgerEntry });
    const dialog = await openRegisterForm(user);

    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "1000" } });
    await user.type(within(dialog).getByLabelText("설명"), "임시 수입");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const pending = await within(dialog).findByRole("button", { name: "저장 중" });
    expect(pending).toBeDisabled();
    fireEvent.submit(within(dialog).getByRole("form", { name: "수동 입출금 입력" }));
    expect(registerManualLedgerEntry).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("저장 핸들러가 없는 화면에서는 성공 토스트 대신 오류 토스트를 띄운다", async () => {
    const user = userEvent.setup();
    renderLedger();
    const dialog = await openRegisterForm(user);

    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "1000" } });
    await user.type(within(dialog).getByLabelText("설명"), "임시 수입");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("수동 입출금 등록에 실패했습니다.", {
        description: "이 화면에서는 저장할 수 없습니다.",
      }),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("고른 날짜가 보고 있는 월 밖이면 어느 월 내역으로 기록되는지 알려 준다", async () => {
    const user = userEvent.setup();
    renderLedger();
    const dialog = await openRegisterForm(user);

    expect(within(dialog).queryByText(/월 입출입내역으로 기록됩니다/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("발생일"), { target: { value: "2026-07-05" } });

    expect(within(dialog).getByText("발생일이 속한 7월 입출입내역으로 기록됩니다.")).toBeInTheDocument();
  });
});

describe("수정 폼과 목록 버튼", () => {
  it("수정·삭제 버튼 이름에 날짜와 금액을 담아 구분한다", async () => {
    renderLedger();

    expect(await screen.findByRole("button", { name: "2026-08-14 피아노 조율비 70,000원 수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-08-14 피아노 조율비 70,000원 삭제" })).toBeInTheDocument();
  });

  it("수동 내역은 유형과 분류를 바꿔 수정할 수 있다", async () => {
    const user = userEvent.setup();
    const updateLedgerEntry = vi.fn().mockResolvedValue(undefined);
    renderLedger(entries, { updateLedgerEntry });

    await user.click(await screen.findByRole("button", { name: "2026-08-14 피아노 조율비 70,000원 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "입출금 내역 수정" });

    expect(within(dialog).getByLabelText("유형")).toBeEnabled();
    expect(within(dialog).getByRole("textbox", { name: "금액" })).toHaveValue("70000");
    expect(within(dialog).queryByText(/원본에는 반영되지 않습니다/)).not.toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("분류"), "supplies");
    await user.click(within(dialog).getByRole("button", { name: "수정 저장" }));

    await waitFor(() =>
      expect(updateLedgerEntry).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ ledgerId: "tuning", type: "expense", source: "manual", category: "supplies", amount: 70000 }),
      ),
    );
  });

  it("자동 생성 내역은 유형과 출처를 잠그고 원본에 반영되지 않는다고 알린다", async () => {
    const user = userEvent.setup();
    const updateLedgerEntry = vi.fn().mockResolvedValue(undefined);
    renderLedger(entries, { updateLedgerEntry });

    await user.click(await screen.findByRole("button", { name: "2026-08-31 박선생 8월 급여 840,000원 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "입출금 내역 수정" });

    expect(within(dialog).getByLabelText("유형")).toBeDisabled();
    expect(within(dialog).getByText("출처: 급여")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "자동으로 기록된 내역입니다. 여기서 고쳐도 수강료·교재·급여 원본에는 반영되지 않습니다.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "금액" }), { target: { value: "850000" } });
    await user.click(within(dialog).getByRole("button", { name: "수정 저장" }));

    await waitFor(() =>
      expect(updateLedgerEntry).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ ledgerId: "payroll", type: "expense", source: "payroll", category: "payroll", amount: 850000 }),
      ),
    );
  });
});

describe("삭제 안내", () => {
  it("자동 기록을 되돌리는 방법을 알려 준다", async () => {
    const user = userEvent.setup();
    renderLedger();

    await user.click(await screen.findByRole("button", { name: "2026-08-31 박선생 8월 급여 840,000원 삭제" }));
    const dialog = await screen.findByRole("alertdialog", { name: "이 입출금 내역을 삭제할까요?" });

    expect(dialog).toHaveTextContent(
      "수강료 입금은 '학원 고정 수입'에서 입금 취소, 급여는 '선생님 월급'에서 지급 취소로 되돌릴 수 있습니다.",
    );
    // 교재는 결제 취소 기능이 없으므로 삭제하면 어떻게 보이는지 알려 준다.
    expect(dialog).toHaveTextContent(
      "교재 수입을 지우면 '교재 내역'에는 결제 완료로 남고 '원장 기록 없음'으로 표시됩니다.",
    );
  });
});

describe("필터", () => {
  it("월·검색·유형만 먼저 보여 주고 나머지는 상세 필터에 접어 둔다", async () => {
    const user = userEvent.setup();
    renderLedger();

    expect(screen.getByLabelText("입출금 월 선택")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "입출금 내역 검색" })).toBeInTheDocument();
    expect(screen.getByLabelText("유형 필터")).toBeInTheDocument();
    for (const name of ["출처 필터", "분류 필터", "입출금 시작일", "입출금 종료일", "입출금 정렬"]) {
      expect(screen.queryByLabelText(name)).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "상세 필터" }));

    for (const name of ["출처 필터", "분류 필터", "입출금 시작일", "입출금 종료일", "입출금 정렬"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it("필터가 켜져 있으면 접어도 '필터 적용 중'을 보여 준다", async () => {
    const user = userEvent.setup();
    renderLedger();
    await screen.findByRole("table", { name: "입출금 내역" });
    expect(screen.queryByText("필터 적용 중")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "상세 필터" }));
    await user.selectOptions(screen.getByLabelText("출처 필터"), "manual");
    await user.click(screen.getByRole("button", { name: "상세 필터" }));

    expect(screen.queryByLabelText("출처 필터")).not.toBeInTheDocument();
    expect(screen.getByText("필터 적용 중")).toBeInTheDocument();
  });

  it("시작일이 종료일보다 늦으면 안내하고 기간 입력은 필수다", async () => {
    const user = userEvent.setup();
    renderLedger();
    await user.click(screen.getByRole("button", { name: "상세 필터" }));

    expect(screen.getByLabelText("입출금 시작일")).toBeRequired();
    expect(screen.getByLabelText("입출금 종료일")).toBeRequired();
    expect(screen.queryByText("시작일이 종료일보다 늦습니다. 기간을 다시 골라 주세요.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("입출금 시작일"), { target: { value: "2026-08-25" } });
    fireEvent.change(screen.getByLabelText("입출금 종료일"), { target: { value: "2026-08-10" } });

    expect(screen.getByText("시작일이 종료일보다 늦습니다. 기간을 다시 골라 주세요.")).toBeInTheDocument();
  });
});

describe("빈 상태", () => {
  it("그 월에 기록이 없으면 월 기준 문구를 보여 준다", async () => {
    renderLedger([]);

    expect(await screen.findByText("이 달에 기록된 입출입내역이 없습니다.")).toBeInTheDocument();
  });

  it("검색 결과가 없으면 조건 기준 문구를 보여 준다", async () => {
    const user = userEvent.setup();
    renderLedger();
    await screen.findByRole("table", { name: "입출금 내역" });

    await user.type(screen.getByRole("searchbox", { name: "입출금 내역 검색" }), "없는내용");

    expect(await screen.findByText("조건에 맞는 입출금 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("이 달에 기록된 입출입내역이 없습니다.")).not.toBeInTheDocument();
  });
});

describe("조회 오류와 입력 중 표 유지", () => {
  it("조회에 실패하면 다시 불러오기로 재시도한다", async () => {
    const user = userEvent.setup();
    const queryFn = vi
      .fn<() => Promise<LedgerEntry[]>>()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValue(entries.filter((row) => row.occurredOn.startsWith("2026-08")));
    renderLedger(entries, {
      queryOptionsFactory: () => ({ queryKey: ["ledger-retry"], queryFn }),
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    await user.click(within(alert).getByRole("button", { name: "다시 불러오기" }));

    expect(await screen.findByRole("table", { name: "입출금 내역" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("검색어를 입력하는 동안 이전 표를 유지한다", async () => {
    const user = userEvent.setup();
    let release: (rows: LedgerEntry[]) => void = () => undefined;
    renderLedger(entries, {
      queryOptionsFactory: (options) => ({
        queryKey: ["ledger-placeholder", options.search ?? ""],
        queryFn: () =>
          options.search
            ? new Promise<LedgerEntry[]>((resolve) => (release = resolve))
            : Promise.resolve(buildFinanceLedgerList(entries, options)),
      }),
    });
    await screen.findByRole("cell", { name: "추가 수강료" });

    await user.type(screen.getByRole("searchbox", { name: "입출금 내역 검색" }), "조율");

    expect(screen.getByRole("cell", { name: "추가 수강료" })).toBeInTheDocument();
    expect(screen.queryByText("입출금 내역을 불러오는 중입니다.")).not.toBeInTheDocument();

    release([entries[2]]);
    await waitFor(() => expect(screen.queryByRole("cell", { name: "추가 수강료" })).not.toBeInTheDocument());
  });
});

describe("금액 색", () => {
  it("목록과 캘린더의 수입은 초록, 지출은 빨강 토큰을 쓴다", async () => {
    const user = userEvent.setup();
    renderLedger();

    const table = await screen.findByRole("table", { name: "입출금 내역" });
    expect(within(table).getByText("3,000원")).toHaveClass("text-income");
    expect(within(table).getByText("70,000원")).toHaveClass("text-expense");

    await user.click(screen.getByRole("tab", { name: "캘린더" }));
    const calendar = screen.getByRole("grid", { name: "2026년 8월 입출금 캘린더" });
    expect(within(calendar).getByText("3,000원")).toHaveClass("text-income");
    expect(within(calendar).getByText("70,000원")).toHaveClass("text-expense");
    expect(calendar.innerHTML).not.toContain("text-blue-600");
  });
});

describe("CSV 내보내기", () => {
  it("BOM을 붙이고 조회 기간을 파일명에 넣으며 수식 시작 값을 막는다", async () => {
    const user = userEvent.setup();
    let blob: Blob | undefined;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((created: Blob) => {
      blob = created;
      return "blob:ledger-csv";
    });
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });

    try {
      renderLedger([entry({ ledgerId: "formula", occurredOn: "2026-08-05", description: "=1+1" })]);
      await screen.findByRole("table", { name: "입출금 내역" });
      await user.click(screen.getByRole("button", { name: "엑셀 내보내기" }));

      const bytes = await new Promise<Uint8Array>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blob!);
      });
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder().decode(bytes)).toContain("'=1+1");
      expect(downloads).toEqual(["입출입내역_2026-08-01_2026-08-31.csv"]);
      // 다운로드가 시작되기 전에 주소를 해제하면 일부 브라우저에서 취소되므로 곧바로 해제하지 않는다.
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    } finally {
      anchorClick.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import type { LedgerEntry } from "@/domain/book-sale";

import {
  FinanceLedgerListScreen,
  type FinanceLedgerListQueryOptionsFactory,
} from "./finance-ledger-list-screen";

const ledgerEntries: LedgerEntry[] = [
  {
    academyId: "academy-1",
    ledgerId: "ledger-1",
    occurredOn: "2026-08-20",
    type: "income",
    source: "book-sale",
    amount: 12000,
    description: "교재 판매: 바이엘 2 / 김민지",
    refId: "sale-1",
  },
  {
    academyId: "academy-1",
    ledgerId: "ledger-2",
    occurredOn: "2026-08-21",
    type: "expense",
    source: "manual",
    amount: 30000,
    description: "조율비",
    refId: "manual-1",
  },
];

function renderFinanceLedgerListScreen(
  queryOptionsFactory: FinanceLedgerListQueryOptionsFactory,
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
      <FinanceLedgerListScreen
        academyId="academy-1"
        academyName="더 클래식"
        queryOptionsFactory={queryOptionsFactory}
      />
    </QueryClientProvider>,
  );
}

describe("FinanceLedgerListScreen", () => {
  it("입출입 내역을 표로 보여주고 발생일, 유형, 출처, 금액, 설명을 표시한다", async () => {
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.academyId, options.search ?? ""],
      queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
    }));

    const table = await screen.findByRole("table", { name: "입출입 내역" });
    expect(
      within(table).getByRole("cell", { name: "2026-08-21" }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "지출" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "수동" })).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "30,000원" }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "조율비" })).toBeInTheDocument();
  });

  it("검색어와 유형/출처 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<FinanceLedgerListQueryOptionsFactory>[0][] =
      [];

    renderFinanceLedgerListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "finance",
          options.academyId,
          options.search ?? "",
          options.filters?.type ?? "",
          options.filters?.source ?? "",
        ],
        queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
      };
    });

    await screen.findByRole("cell", { name: "교재 판매: 바이엘 2 / 김민지" });

    await user.type(
      screen.getByRole("searchbox", { name: "입출입 내역 검색" }),
      "조율",
    );
    await user.selectOptions(screen.getByLabelText("유형 필터"), "expense");
    await user.selectOptions(screen.getByLabelText("출처 필터"), "manual");

    expect(await screen.findByRole("cell", { name: "조율비" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "교재 판매: 바이엘 2 / 김민지" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "조율",
      filters: {
        type: "expense",
        source: "manual",
      },
    });
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "입출입 내역을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });
});

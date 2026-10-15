import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceOverviewScreen, type FinanceManagementData } from "./finance-management-screens";

const financeData: FinanceManagementData = {
  ledgerEntries: [
    {
      academyId: "academy-1",
      ledgerId: "ledger-1",
      occurredOn: "2026-03-05",
      type: "income",
      source: "tuition",
      amount: 300000,
      description: "3월 수강료",
      refId: "tuition-1",
    },
    {
      academyId: "academy-1",
      ledgerId: "ledger-2",
      occurredOn: "2026-03-20",
      type: "expense",
      source: "payroll",
      amount: 120000,
      description: "3월 급여",
      refId: "payroll-1",
    },
    {
      academyId: "academy-1",
      ledgerId: "ledger-3",
      occurredOn: "2026-05-02",
      type: "expense",
      source: "manual",
      amount: 50000,
      description: "악기 수리",
      refId: "manual-1",
    },
  ],
  enrollments: [],
  tickets: [],
  bookSales: [],
  teachers: [],
};

describe("FinanceOverviewScreen", () => {
  it("선택한 연도의 수입·지출·순수익을 연간 합계와 월별로 함께 보여준다", () => {
    render(<FinanceOverviewScreen academyId="academy-1" financeData={financeData} initialYear={2026} />);

    const summary = screen.getByRole("region", { name: "연간 요약" });
    expect(within(summary).getByText("수입").nextElementSibling).toHaveTextContent("300,000원");
    expect(within(summary).getByText("지출").nextElementSibling).toHaveTextContent("170,000원");
    expect(within(summary).getByText("순수익").nextElementSibling).toHaveTextContent("130,000원");

    const graph = screen.getByRole("figure", { name: "월별 수입·지출 그래프" });
    const march = within(graph).getByRole("group", { name: "2026-03" });
    expect(march).toHaveTextContent("수입 300,000원");
    expect(march).toHaveTextContent("지출 120,000원");
    expect(march).toHaveTextContent("순수익 180,000원");

    const may = within(graph).getByRole("group", { name: "2026-05" });
    expect(may).toHaveTextContent("순수익 -50,000원");
  });

  it("분류별 수입에는 지출 내역을 섞지 않는다", () => {
    render(<FinanceOverviewScreen academyId="academy-1" financeData={financeData} initialYear={2026} />);

    const categories = screen.getByRole("region", { name: "분류별 수입" });
    expect(within(categories).queryByText(/악기 수리|급여/)).not.toBeInTheDocument();
  });

  it("분류별 수입도 선택한 연도의 수입만 합산한다", () => {
    const withPreviousYear: FinanceManagementData = {
      ...financeData,
      ledgerEntries: [
        ...financeData.ledgerEntries,
        {
          academyId: "academy-1",
          ledgerId: "ledger-old",
          occurredOn: "2025-11-10",
          type: "income",
          source: "tuition",
          amount: 900000,
          description: "작년 수강료",
          refId: "tuition-old",
        },
      ],
    };
    render(<FinanceOverviewScreen academyId="academy-1" financeData={withPreviousYear} initialYear={2026} />);

    const categories = screen.getByRole("region", { name: "분류별 수입" });
    expect(categories).toHaveTextContent("300,000원");
    expect(categories).not.toHaveTextContent("900,000원");
    expect(categories).not.toHaveTextContent("1,200,000원");
  });
});

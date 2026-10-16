import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { YearlyMetricPoint } from "@/domain/finance-yearly-metrics";

import { FinanceYearlyChart } from "./finance-yearly-chart";

const series: YearlyMetricPoint[] = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  label: `${index + 1}월`,
  amount: index === 2 ? 1_250_000 : 0,
}));

describe("FinanceYearlyChart", () => {
  // jsdom에는 레이아웃이 없어 차트 크기가 0이라는 recharts 경고가 나온다. 표로 검증하므로 소음만 줄인다.
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("지표 이름과 연도를 그래프 제목으로 알려 준다", () => {
    render(<FinanceYearlyChart year={2026} metric="academy-income" series={series} />);

    expect(screen.getByRole("figure", { name: "2026년 학원 수입 월별 그래프" })).toBeInTheDocument();
    expect(screen.getByText("2026년 학원 수입")).toBeInTheDocument();
  });

  it("차트가 그려지지 않는 환경에서도 읽을 수 있도록 1~12월 금액 표를 함께 렌더한다", () => {
    render(<FinanceYearlyChart year={2026} metric="expense" series={series} />);

    const table = screen.getByRole("table", { name: "2026년 지출 월별 금액" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(within(table).getByRole("row", { name: "1월 0원" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "3월 1,250,000원" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "12월 0원" })).toBeInTheDocument();
  });

  it("지표별 의미 색을 쓴다: 수입 계열은 수입색, 지출은 지출색, 악기 지표는 합계색", () => {
    const colorOf = (metric: Parameters<typeof FinanceYearlyChart>[0]["metric"]) => {
      const { container, unmount } = render(<FinanceYearlyChart year={2026} metric={metric} series={series} />);
      const styleText = container.querySelector("style")?.textContent ?? "";
      unmount();

      return styleText.match(/--color-amount:\s*([^;]+);/)?.[1];
    };

    expect(colorOf("academy-income")).toBe("var(--income)");
    expect(colorOf("expense")).toBe("var(--expense)");
    expect(colorOf("all-instruments")).toBe("var(--total)");
    expect(colorOf("instrument")).toBe("var(--total)");
  });
});

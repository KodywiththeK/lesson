import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FinanceAmount, readFreshData, resetFinanceMonthForTest, useFinanceMonth } from "./finance-shared";

describe("FinanceAmount", () => {
  it("금액을 원 단위로 보여 주고 의미(합계·수입·지출)에 맞는 색 토큰을 쓴다", () => {
    render(
      <>
        <FinanceAmount amount={1234567} tone="total" />
        <FinanceAmount amount={50000} tone="income" />
        <FinanceAmount amount={30000} tone="expense" />
        <FinanceAmount amount={0} />
      </>,
    );

    expect(screen.getByText("1,234,567원")).toHaveClass("text-total");
    expect(screen.getByText("50,000원")).toHaveClass("text-income");
    expect(screen.getByText("30,000원")).toHaveClass("text-expense");
    expect(screen.getByText("0원").className).not.toMatch(/text-(total|income|expense)/);
  });
});

describe("useFinanceMonth", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
    resetFinanceMonthForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("기본은 이번 달이고, 한 탭에서 고른 달을 다른 탭(훅 사용처)이 이어받는다", () => {
    const first = renderHook(() => useFinanceMonth());
    expect(first.result.current.month).toBe("2026-10");

    act(() => first.result.current.setMonth("2026-08"));

    const second = renderHook(() => useFinanceMonth());
    expect(second.result.current.month).toBe("2026-08");
    expect(first.result.current.month).toBe("2026-08");
  });

  it("이번 달보다 뒤의 달은 고를 수 없고 이번 달을 최대값으로 알려 준다", () => {
    const { result } = renderHook(() => useFinanceMonth());

    act(() => result.current.setMonth("2026-12"));

    expect(result.current.month).toBe("2026-10");
    expect(result.current.maxMonth).toBe("2026-10");
  });
});

describe("readFreshData", () => {
  it("재조회가 성공하면 새 데이터를 돌려준다", async () => {
    await expect(readFreshData(async () => ({ data: { total: 1 }, isError: false, error: null }))).resolves.toEqual({
      total: 1,
    });
  });

  it("재조회가 실패하면 직전 성공 데이터를 새 데이터로 착각하지 않고 오류를 던진다", async () => {
    await expect(
      readFreshData(async () => ({ data: { total: 1 }, isError: true, error: new Error("Failed to fetch") })),
    ).rejects.toThrow("Failed to fetch");
  });
});

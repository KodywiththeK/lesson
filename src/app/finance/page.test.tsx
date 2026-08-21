import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import FinancePage from "./page";

describe("FinancePage", () => {
  it("수입 메뉴에서 입출입 내역 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <FinancePage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "수입 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "수입" }),
    ).toHaveAttribute("href", "/finance");
    expect(
      screen.getByRole("searchbox", { name: "입출입 내역 검색" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("김민지 8월 피아노 수강료")).toBeInTheDocument();
    expect(screen.getByText("피아노 조율비")).toBeInTheDocument();
  });
});

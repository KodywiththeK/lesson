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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supabase 환경변수가 설정되면 입출입 내역을 불러올 수 있습니다.",
    );
  });
});

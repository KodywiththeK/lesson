import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import PassesPage from "./page";

describe("PassesPage", () => {
  it("회차권 메뉴에서 회차권 목록 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "회차권 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "회차권" }),
    ).toHaveAttribute("href", "/passes");
    expect(
      screen.getByRole("searchbox", { name: "회차권 검색" }),
    ).toBeInTheDocument();
    const seoaRow = await screen.findByRole("row", { name: /한서아/ });
    expect(within(seoaRow).getByText("잔여 부족")).toBeInTheDocument();
    expect(screen.getByText(/^총 \d+개$/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 회차권 수" })).toHaveValue("10");
  });
});

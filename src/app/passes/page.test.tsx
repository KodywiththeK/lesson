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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supabase 환경변수가 설정되면 회차권 목록을 불러올 수 있습니다.",
    );
  });
});

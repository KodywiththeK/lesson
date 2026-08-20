import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import BooksPage from "./page";

describe("BooksPage", () => {
  it("교재 메뉴에서 교재 구매 목록 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <BooksPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "교재 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "교재" }),
    ).toHaveAttribute("href", "/books");
    expect(
      screen.getByRole("searchbox", { name: "교재 구매 검색" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supabase 환경변수가 설정되면 교재 구매 목록을 불러올 수 있습니다.",
    );
  });
});

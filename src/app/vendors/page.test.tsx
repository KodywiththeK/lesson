import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import VendorsPage from "./page";

describe("VendorsPage", () => {
  it("거래처 메뉴에서 거래처 목록 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <VendorsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "거래처 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "거래처" }),
    ).toHaveAttribute("href", "/vendors");
    expect(
      screen.getByRole("searchbox", { name: "거래처 검색" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supabase 환경변수가 설정되면 거래처 목록을 불러올 수 있습니다.",
    );
  });
});

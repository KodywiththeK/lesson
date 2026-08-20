import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import TeachersPage from "./page";

describe("TeachersPage", () => {
  it("선생님 메뉴에서 선생님 목록 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <TeachersPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "선생님 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "선생님" }),
    ).toHaveAttribute("href", "/teachers");
    expect(
      screen.getByRole("searchbox", { name: "선생님 검색" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supabase 환경변수가 설정되면 선생님 목록을 불러올 수 있습니다.",
    );
  });
});

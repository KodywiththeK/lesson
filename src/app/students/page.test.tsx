import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import StudentsPage from "./page";

describe("StudentsPage", () => {
  it("원생 메뉴에서 원생 목록 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <StudentsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "원생 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "원생" })).toHaveAttribute(
      "href",
      "/students",
    );
    expect(screen.getByRole("searchbox", { name: "원생 검색" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supabase 환경변수가 설정되면 원생 목록을 불러올 수 있습니다.",
    );
  });
});

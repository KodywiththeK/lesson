import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import TeachersPage from "./page";

describe("TeachersPage", () => {
  it("인원·거래처 메뉴의 선생님 하위 메뉴에서 선생님 목록 화면으로 진입할 수 있다", async () => {
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
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    expect(
      within(navigation).getByRole("link", { name: "선생님" }),
    ).toHaveAttribute("href", "/management/teachers");
    expect(
      screen.getByRole("searchbox", { name: "선생님 검색" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("김하늘")).toBeInTheDocument();
    expect(screen.getByText("오유진")).toBeInTheDocument();
  });

  it("선생님 등록 다이얼로그에서 등록한 선생님을 목록에 반영한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <TeachersPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "선생님 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "선생님 등록" });

    await user.type(within(dialog).getByLabelText("선생님명"), "박소연");
    await user.clear(within(dialog).getByLabelText("연락처"));
    await user.type(within(dialog).getByLabelText("연락처"), "010-7777-8888");
    await user.type(within(dialog).getByLabelText("계약 시작일"), "2026-09-01");
    await user.type(within(dialog).getByLabelText("계약 종료일"), "2027-08-31");
    await user.type(within(dialog).getByLabelText("월급"), "2500000");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(await screen.findByText("박소연")).toBeInTheDocument();
  });
});

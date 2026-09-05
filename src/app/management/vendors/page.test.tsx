import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import VendorsPage from "./page";

describe("VendorsPage", () => {
  it("인원·거래처 메뉴의 거래처 하위 메뉴에서 거래처 목록 화면으로 진입할 수 있다", async () => {
    window.history.pushState(null, "", "/management/vendors");

    render(
      <AppProviders>
        <VendorsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "인원·거래처" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    expect(
      within(navigation).getByRole("link", { name: "거래처" }),
    ).toHaveAttribute("href", "/management/vendors");
    expect(
      screen.getByRole("searchbox", { name: "거래처 검색" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "거래처 관리" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("클래식 악기사")).toBeInTheDocument();
    expect(screen.getByText("뮤직북 유통")).toBeInTheDocument();
  });

  it("거래처 등록 다이얼로그에서 입력한 거래처를 목록에 반영한다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/management/vendors");

    render(
      <AppProviders>
        <VendorsPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "거래처 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "거래처 등록" });

    await user.type(within(dialog).getByLabelText("거래처명"), "현악기 공방");
    await user.type(within(dialog).getByLabelText("종류"), "수리");
    await user.type(within(dialog).getByLabelText("연락처"), "02-7777-8888");
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "거래처 등록 입력" }),
    );

    const vendorRow = await screen.findByRole("row", { name: /현악기 공방/ });
    expect(within(vendorRow).getByText("수리")).toBeInTheDocument();
  });
});

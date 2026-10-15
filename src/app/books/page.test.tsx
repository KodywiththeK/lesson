import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectWholeWonInput } from "@/test/expect-whole-won-input";

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
    expect(await screen.findByText("바이엘 상")).toBeInTheDocument();
    expect(screen.getByText("스즈키 바이올린 1")).toBeInTheDocument();
    expect(screen.getByText(/^총 \d+건$/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 교재 구매 수" })).toHaveValue("10");
  });

  it("교재 출고 다이얼로그에서 입력한 교재를 구매 목록에 반영한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <BooksPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "교재 출고" }));
    const dialog = await screen.findByRole("dialog", { name: "교재 출고" });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.type(within(dialog).getByLabelText("교재명"), "체르니 100");
    fireEvent.change(within(dialog).getByLabelText("가격"), {
      target: { value: "13000" },
    });
    await user.selectOptions(within(dialog).getByLabelText("결제 상태"), "paid");
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "교재 출고 입력" }),
    );

    expect(await screen.findByText("체르니 100")).toBeInTheDocument();
    expect(screen.getByText("13,000원")).toBeInTheDocument();
  });

  it("교재 가격은 1원 단위 양의 정수를 제출 검증으로 허용한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <BooksPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "교재 출고" }));
    const dialog = await screen.findByRole("dialog", { name: "교재 출고" });

    expectWholeWonInput(within(dialog).getByRole("spinbutton", { name: "가격" }));
  });

  it("교재 가격 140000원도 저장 버튼으로 출고할 수 있다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <BooksPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "교재 출고" }));
    const dialog = await screen.findByRole("dialog", { name: "교재 출고" });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.type(within(dialog).getByLabelText("교재명"), "체르니 40");
    fireEvent.change(within(dialog).getByLabelText("가격"), {
      target: { value: "140000" },
    });
    await user.selectOptions(within(dialog).getByLabelText("결제 상태"), "paid");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(await screen.findByText("체르니 40")).toBeInTheDocument();
    expect(screen.getByText("140,000원")).toBeInTheDocument();
  });
});

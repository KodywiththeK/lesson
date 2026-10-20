import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../providers";
import BookShipmentsPage from "./page";

function renderShipmentsPage() {
  window.history.pushState(null, "", "/books/shipments");

  return render(
    <AppProviders>
      <BookShipmentsPage />
    </AppProviders>,
  );
}

describe("BookShipmentsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-20T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("교재 메뉴의 출고 하위 메뉴에서 도서 구매 목록과 출고목록으로 진입할 수 있다", async () => {
    renderShipmentsPage();

    expect(screen.getByRole("heading", { level: 1, name: "교재" })).toBeInTheDocument();
    const subNavigation = screen.getByRole("navigation", { name: "교재 하위 메뉴" });
    expect(within(subNavigation).getByRole("link", { name: "재고" })).toHaveAttribute("href", "/books");
    expect(within(subNavigation).getByRole("link", { name: "출고" })).toHaveAttribute("href", "/books/shipments");
    expect(within(subNavigation).getByRole("link", { name: "결제 완료" })).toHaveAttribute("href", "/books/paid");
    expect(screen.getByRole("heading", { name: "도서 구매 목록" })).toBeInTheDocument();

    const row = await screen.findByRole("row", { name: /김민지/ });
    expect(within(row).getByRole("cell", { name: "바이엘 상" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "2026-08-18" })).toBeInTheDocument();
  });

  it("원생 선택지에는 재원 중인 원생만, 도서 선택지에는 남은 재고가 나온다", async () => {
    renderShipmentsPage();

    await screen.findByRole("option", { name: "바이엘 상 (남은 재고 9권)" });

    expect(screen.getByRole("option", { name: "김민지" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "박지호" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "유하린" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "체르니 100 (재고 없음)" })).toBeInTheDocument();
  });

  it("출고를 등록하면 출고목록에 한 건이 생기고 도서 선택지의 남은 재고가 줄어든다", async () => {
    const user = userEvent.setup();
    renderShipmentsPage();

    await screen.findByRole("option", { name: "스즈키 바이올린 1 (남은 재고 4권)" });
    await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-2");
    await user.selectOptions(screen.getByLabelText("도서명"), "book-2");
    await user.clear(screen.getByLabelText("수량"));
    await user.type(screen.getByLabelText("수량"), "2");
    await user.click(screen.getByRole("button", { name: "출고 등록" }));

    const row = await screen.findByRole("row", { name: /이서윤/ });
    expect(within(row).getByRole("cell", { name: "36,000원" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "2026-08-20" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "스즈키 바이올린 1 (남은 재고 2권)" })).toBeInTheDocument();
  });

  it("출고를 수정하면 목록에 반영한다", async () => {
    const user = userEvent.setup();
    renderShipmentsPage();

    await user.click(await screen.findByRole("button", { name: "김민지 바이엘 상 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "출고 내역 수정" });
    await user.clear(within(dialog).getByLabelText("수량"));
    await user.type(within(dialog).getByLabelText("수량"), "3");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "출고 내역 수정" })).not.toBeInTheDocument());
    const row = await screen.findByRole("row", { name: /김민지/ });
    expect(within(row).getByRole("cell", { name: "3권" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "36,000원" })).toBeInTheDocument();
  });

  it("출고를 삭제하면 목록에서 사라지고 재고가 되돌아온다", async () => {
    const user = userEvent.setup();
    renderShipmentsPage();

    await user.click(await screen.findByRole("button", { name: "김민지 바이엘 상 삭제" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "출고 내역을 삭제할까요?" });
    await user.click(within(confirmation).getByRole("button", { name: "삭제" }));

    expect(await screen.findByText("대기 중인 출고 내역이 없습니다.")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "바이엘 상 (남은 재고 10권)" })).toBeInTheDocument();
  });

  it("기존 출고에는 나중 결제 버튼이 없고 등록할 때만 결제 완료를 선택한다", async () => {
    const user = userEvent.setup();
    renderShipmentsPage();

    await screen.findByRole("row", { name: /김민지/ });
    expect(screen.queryByRole("button", { name: /결제 완료 처리/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-2");
    await user.selectOptions(screen.getByLabelText("도서명"), "book-2");
    await user.selectOptions(screen.getByLabelText("결제 상태"), "paid");
    expect(screen.getByLabelText("입금일")).toHaveValue("2026-08-20");
  });
});

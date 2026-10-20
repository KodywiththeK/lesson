import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import BooksPage from "./page";

function renderBooksPage() {
  window.history.pushState(null, "", "/books");

  return render(
    <AppProviders>
      <BooksPage />
    </AppProviders>,
  );
}

async function openRegisterDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "교재 등록" }));

  return screen.findByRole("dialog", { name: "교재 등록" });
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { title: string; price: string; quantity: string },
) {
  await user.type(within(dialog).getByRole("textbox", { name: "도서명" }), values.title);
  await user.type(within(dialog).getByRole("textbox", { name: "가격(원)" }), values.price);
  await user.type(within(dialog).getByRole("spinbutton", { name: "권수" }), values.quantity);
}

describe("BooksPage", () => {
  it("교재 메뉴의 재고 탭에서 교재 재고 목록 화면으로 진입한다", async () => {
    renderBooksPage();

    expect(screen.getByRole("heading", { level: 1, name: "교재" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "교재" })).toHaveAttribute("href", "/books");
    const tabs = screen.getByRole("navigation", { name: "교재 하위 메뉴" });
    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "재고",
      "출고",
      "결제 완료",
      "발주·입고",
    ]);
    expect(within(tabs).getByRole("link", { name: "재고" })).toHaveAttribute("href", "/books");
    expect(within(tabs).getByRole("link", { name: "출고" })).toHaveAttribute("href", "/books/shipments");
    expect(within(tabs).getByRole("link", { name: "결제 완료" })).toHaveAttribute("href", "/books/paid");
    expect(within(tabs).getByRole("link", { name: "발주·입고" })).toHaveAttribute("href", "/books/orders");
    expect(screen.getByRole("heading", { name: "교재 등록 관리" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "교재 재고 상태" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "도서명 검색" })).toBeInTheDocument();

    const table = await screen.findByRole("table", { name: "교재 재고 목록" });
    expect(within(table).getByRole("cell", { name: "바이엘 상" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "스즈키 바이올린 1" })).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /체르니 100/ })).getByText("재고 없음")).toBeInTheDocument();
    expect(screen.getByText(/^총 \d+건$/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 교재 수" })).toHaveValue("10");
  });

  it("교재 등록 다이얼로그에서 입력한 교재를 재고 목록에 한 줄로 반영한다", async () => {
    const user = userEvent.setup();
    renderBooksPage();

    const dialog = await openRegisterDialog(user);
    await fillRegisterForm(user, dialog, { title: "체르니 30", price: "14000", quantity: "6" });
    await user.click(within(dialog).getByRole("button", { name: "등록" }));

    const row = await screen.findByRole("row", { name: /체르니 30/ });
    expect(within(row).getByRole("cell", { name: "14,000원" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "6" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "교재 등록" })).not.toBeInTheDocument();
  });

  it("같은 도서명으로 재입고하면 새 줄 없이 기존 교재에 권수를 합산하고 가격을 바꾼다", async () => {
    const user = userEvent.setup();
    renderBooksPage();
    await screen.findByRole("row", { name: /바이엘 상/ });

    const dialog = await openRegisterDialog(user);
    await fillRegisterForm(user, dialog, { title: "바이엘 상", price: "13000", quantity: "5" });
    expect(
      await within(dialog).findByText(
        "이미 등록된 교재입니다. 권수가 합산되고(현재 9권 → 14권) 가격이 12,000원에서 13,000원으로 바뀝니다.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "등록" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "교재 등록" })).not.toBeInTheDocument());
    const rows = await screen.findAllByRole("row", { name: /바이엘 상/ });
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByRole("cell", { name: "14" })).toBeInTheDocument();
    expect(within(rows[0]).getByRole("cell", { name: "13,000원" })).toBeInTheDocument();
  });

  it("교재 가격은 쉼표를 포함한 금액 입력을 유지한다", async () => {
    const user = userEvent.setup();
    renderBooksPage();

    const dialog = await openRegisterDialog(user);

    const price = within(dialog).getByRole("textbox", { name: "가격(원)" });
    await user.type(price, "140,000");
    expect(price).toHaveValue("140,000");
  });

  it("교재 가격 140000원도 등록 버튼으로 저장할 수 있다", async () => {
    const user = userEvent.setup();
    renderBooksPage();

    const dialog = await openRegisterDialog(user);
    await fillRegisterForm(user, dialog, { title: "체르니 40", price: "140000", quantity: "2" });
    await user.click(within(dialog).getByRole("button", { name: "등록" }));

    const row = await screen.findByRole("row", { name: /체르니 40/ });
    expect(within(row).getByRole("cell", { name: "140,000원" })).toBeInTheDocument();
  });

  it("교재 수정 다이얼로그에서 현재 재고를 고치면 재고 없음 배지가 사라진다", async () => {
    const user = userEvent.setup();
    renderBooksPage();

    await user.click(await screen.findByRole("button", { name: "체르니 100 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "교재 수정" });
    const quantityInput = within(dialog).getByRole("spinbutton", { name: "권수" });
    await user.clear(quantityInput);
    await user.type(quantityInput, "12");
    await user.click(within(dialog).getByRole("button", { name: "수정" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "교재 수정" })).not.toBeInTheDocument());
    const row = await screen.findByRole("row", { name: /체르니 100/ });
    expect(within(row).getByRole("cell", { name: "12" })).toBeInTheDocument();
    expect(within(row).queryByText("재고 없음")).not.toBeInTheDocument();
  });

  it("교재 삭제는 확인을 거쳐 재고 목록에서만 사라진다", async () => {
    const user = userEvent.setup();
    renderBooksPage();

    await user.click(await screen.findByRole("button", { name: "체르니 100 삭제" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });
    expect(within(confirmation).queryByText(/대기 중인 출고/)).not.toBeInTheDocument();
    await user.click(await within(confirmation).findByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByRole("row", { name: /체르니 100/ })).not.toBeInTheDocument());
    expect(screen.getByRole("row", { name: /바이엘 상/ })).toBeInTheDocument();
  });

  it("결제 대기 출고가 있는 교재를 삭제하려 하면 대기 건수를 확인 창에 안내한다", async () => {
    const user = userEvent.setup();
    renderBooksPage();

    await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });

    expect(
      await within(confirmation).findByText(
        "대기 중인 출고 1건이 있습니다. 삭제해도 대기 건은 계속 결제 처리할 수 있습니다.",
      ),
    ).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookOrderScreen } from "./book-order-screen";

function renderScreen(rpc = vi.fn()) {
  const client = { rpc };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BookOrderScreen
        academyId="academy-1"
        canPay
        client={client}
        vendors={[{ id: "vendor-1", name: "음악서점" }]}
        books={[]}
      />
    </QueryClientProvider>,
  );
  return { rpc };
}

describe("교재 발주·입고 화면", () => {
  it("데모에서는 원격 클라이언트를 만들지 않고 조회 전용 상태를 표시한다", async () => {
    render(<QueryClientProvider client={new QueryClient()}>
      <BookOrderScreen academyId="academy-1" canPay demoReadOnly />
    </QueryClientProvider>);
    expect(await screen.findByText("발주 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "발주 등록" })).toBeDisabled();
    expect(screen.queryByText("교재 발주를 불러오지 못했습니다.")).not.toBeInTheDocument();
  });
  it("발주 목록과 등록 버튼을 표시하고 판매가는 입고 때 입력받는다", async () => {
    const { rpc } = renderScreen(vi.fn().mockResolvedValue({ data: [], error: null }));
    expect(await screen.findByText("발주 내역이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "발주 등록" }));
    expect(screen.getByRole("dialog", { name: "발주 등록" })).toBeInTheDocument();
    expect(screen.getByLabelText("거래처")).toBeInTheDocument();
    expect(screen.getByLabelText("매입가")).toBeInTheDocument();
    expect(screen.queryByLabelText("판매가")).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("list_book_orders", { p_academy_id: "academy-1" });
  });

  it("발주 품목과 지급 상태를 표시하고 입고·지급 액션을 분리한다", async () => {
    const order = {
      id: "order-1", academy_id: "academy-1", vendor_id: "vendor-1", vendor_name: "음악서점",
      ordered_on: "2026-10-15", received_on: null, paid_on: null,
      paid_ledger_entry_id: null, ledger_mismatch: false, status: "ordered",
      items: [{ id: "item-1", book_id: null, title: "새 교재", quantity: 2, purchase_price: 5000, sale_price: 10000 }],
    };
    renderScreen(vi.fn().mockResolvedValue({ data: [order], error: null }));
    expect(await screen.findByText("음악서점")).toBeInTheDocument();
    expect(screen.getByText("10,000원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "음악서점 입고 확인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "음악서점 지급" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "음악서점 지급" }));
    expect(await screen.findByRole("dialog", { name: "발주 지급" })).toBeInTheDocument();
    expect(screen.getByLabelText("지급일")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "음악서점 입고 확인" }));
    expect(await screen.findByRole("dialog", { name: "전량 입고 확인" })).toBeInTheDocument();
    expect(screen.getByLabelText("새 교재 판매가")).toBeInTheDocument();
  });

  it("발주 저장에 실패하면 입력창을 닫지 않고 오류를 안내한다", async () => {
    const rpc = vi.fn().mockImplementation((name: string) => name === "list_book_orders"
      ? Promise.resolve({ data: [], error: null })
      : Promise.resolve({ data: null, error: new Error("네트워크 연결을 확인해 주세요.") }));
    renderScreen(rpc);
    await screen.findByText("발주 내역이 없습니다.");
    fireEvent.click(screen.getByRole("button", { name: "발주 등록" }));
    fireEvent.change(screen.getByLabelText("거래처"), { target: { value: "vendor-1" } });
    fireEvent.change(screen.getByLabelText("새 도서명"), { target: { value: "바이엘 1" } });
    fireEvent.change(screen.getByLabelText("매입가"), { target: { value: "5,000" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("create_book_order", expect.objectContaining({
      p_vendor_id: "vendor-1",
      p_items: [expect.objectContaining({ title: "바이엘 1", purchase_price: 5000 })],
    })));
    expect(screen.getByRole("dialog", { name: "발주 등록" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("네트워크 연결을 확인해 주세요.");
  });

  it("연결 원장이 어긋난 지급 건은 취소 버튼을 숨기고 정정을 안내한다", async () => {
    const order = {
      id: "order-1", academy_id: "academy-1", vendor_id: "vendor-1", vendor_name: "음악서점",
      ordered_on: "2026-10-15", received_on: "2026-10-16", paid_on: "2026-10-17",
      paid_ledger_entry_id: "ledger-1", ledger_mismatch: true, status: "received",
      items: [{ id: "item-1", book_id: "book-1", title: "바이엘", quantity: 2, purchase_price: 5000, sale_price: 10000 }],
    };
    renderScreen(vi.fn().mockResolvedValue({ data: [order], error: null }));

    expect(await screen.findByText("원장 불일치 · 입출금 내역을 정정해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "지급 취소" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "발주 취소" })).not.toBeInTheDocument();
  });
});

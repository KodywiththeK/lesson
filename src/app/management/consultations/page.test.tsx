import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import ConsultationsPage from "./page";

function renderConsultationsPage() {
  window.history.pushState(null, "", "/management/consultations");

  return render(
    <AppProviders>
      <ConsultationsPage />
    </AppProviders>,
  );
}

describe("ConsultationsPage", () => {
  it("인원·거래처 메뉴의 상담 하위 메뉴에서 상담 목록 화면으로 진입할 수 있다", async () => {
    renderConsultationsPage();

    expect(screen.getByRole("heading", { level: 1, name: "인원·거래처" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "상담" })).toHaveAttribute(
      "href",
      "/management/consultations",
    );
    expect(screen.getByRole("searchbox", { name: "상담 검색" })).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "정다은" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "오시우" })).toBeInTheDocument();
  });

  it("상담 등록 다이얼로그에서 입력한 상담을 접수일과 함께 목록에 반영한다", async () => {
    const user = userEvent.setup();
    renderConsultationsPage();

    await user.click(await screen.findByRole("button", { name: "상담 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "상담 등록" });
    await user.type(within(dialog).getByLabelText("이름"), "한지우");
    await user.type(within(dialog).getByLabelText("전화번호"), "010-1212-3434");
    await user.click(within(dialog).getByRole("checkbox", { name: "플루트 선택" }));
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const row = await screen.findByRole("row", { name: /한지우/ });
    expect(within(row).getByRole("cell", { name: "플루트" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: /^\d{4}-\d{2}-\d{2}$/ })).toBeInTheDocument();
  });

  it("상담 수정 다이얼로그에서 바꾼 내용을 목록에 반영한다", async () => {
    const user = userEvent.setup();
    renderConsultationsPage();

    await user.click(await screen.findByRole("button", { name: "정다은 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "상담 수정" });
    const schoolInput = within(dialog).getByLabelText("학교");
    await user.clear(schoolInput);
    await user.type(schoolInput, "달빛초등학교");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("cell", { name: "달빛초등학교" })).toBeInTheDocument();
    expect(screen.queryByText("새봄초등학교")).not.toBeInTheDocument();
  });

  it("상담 기록을 삭제 확인 뒤 목록에서 지운다", async () => {
    const user = userEvent.setup();
    renderConsultationsPage();

    await user.click(await screen.findByRole("button", { name: "오시우 삭제" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "상담 기록을 삭제할까요?" });
    await user.click(within(confirmation).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByRole("cell", { name: "오시우" })).not.toBeInTheDocument());
    expect(screen.getByRole("cell", { name: "정다은" })).toBeInTheDocument();
  });

  it("상담에서 원생을 등록하면 상담 기록이 목록에서 사라진다", async () => {
    const user = userEvent.setup();
    renderConsultationsPage();

    await user.click(await screen.findByRole("button", { name: "오시우 원생 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "원생 등록" });
    expect(within(dialog).getByLabelText("원생명")).toHaveValue("오시우");
    await user.click(within(dialog).getByRole("checkbox", { name: "첼로 선택" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "바이올린 월요일" }));
    await user.click(within(dialog).getByRole("button", { name: "등록" }));

    await waitFor(() => expect(screen.queryByRole("cell", { name: "오시우" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "원생 등록" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "정다은" })).toBeInTheDocument();
  });
});

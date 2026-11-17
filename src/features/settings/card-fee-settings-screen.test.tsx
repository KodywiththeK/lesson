import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CardFeeRate } from "@/domain/card-fee";

import { CardFeeSettingsScreen } from "./card-fee-settings-screen";

function renderScreen(initial: CardFeeRate[] = []) {
  let rates = [...initial];
  const saveRate = vi.fn(async (input: { id?: string; name: string; ratePercent: number }) => {
    const rate = { id: input.id ?? `r${rates.length + 1}`, name: input.name, ratePercent: input.ratePercent };
    rates = input.id ? rates.map((candidate) => (candidate.id === input.id ? rate : candidate)) : [...rates, rate];
    return rate;
  });
  const archiveRate = vi.fn(async (id: string) => {
    rates = rates.filter((rate) => rate.id !== id);
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CardFeeSettingsScreen
        academyId="a"
        queryOptions={{ queryKey: ["card-fee-rates"], queryFn: async () => rates }}
        saveRate={saveRate}
        archiveRate={archiveRate}
      />
    </QueryClientProvider>,
  );

  return { saveRate, archiveRate, user: userEvent.setup() };
}

describe("카드 수수료 설정", () => {
  it("카드사가 없으면 카드 입금은 수입만 기록된다고 안내하고, 이름·수수료율로 추가한다", async () => {
    const { saveRate, user } = renderScreen();

    expect(await screen.findByText("등록한 카드사가 없습니다. 카드로 입금해도 수입만 기록합니다.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("카드사 이름"), "신한카드");
    await user.type(screen.getByLabelText("수수료율(%)"), "1.45");
    await user.click(screen.getByRole("button", { name: "카드사 추가" }));

    await waitFor(() => expect(saveRate).toHaveBeenCalledWith({ name: "신한카드", ratePercent: 1.45 }));
    expect(await screen.findByText("신한카드")).toBeInTheDocument();
    expect(screen.getByText("1.45%")).toBeInTheDocument();
    expect(screen.getByLabelText("카드사 이름")).toHaveValue("");
  });

  it("잘못된 수수료율은 이유를 알리고 저장하지 않는다", async () => {
    const { saveRate, user } = renderScreen();

    await user.type(await screen.findByLabelText("카드사 이름"), "국민");
    await user.type(screen.getByLabelText("수수료율(%)"), "12");

    expect(screen.getByText("수수료율은 0~10%, 소수점 둘째 자리까지 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카드사 추가" })).toBeDisabled();
    expect(saveRate).not.toHaveBeenCalled();
  });

  it("수정하면 같은 카드사를 바꾸고, 삭제는 확인을 받는다", async () => {
    const { saveRate, archiveRate, user } = renderScreen([{ id: "r1", name: "신한카드", ratePercent: 1.45 }]);

    await user.click(await screen.findByRole("button", { name: "신한카드 수정" }));
    const rate = screen.getByLabelText("수수료율(%)");
    expect(rate).toHaveValue("1.45");
    await user.clear(rate);
    await user.type(rate, "1.5");
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    await waitFor(() => expect(saveRate).toHaveBeenCalledWith({ id: "r1", name: "신한카드", ratePercent: 1.5 }));

    await user.click(await screen.findByRole("button", { name: "신한카드 삭제" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("이미 기록한 카드 수수료는 그대로 남습니다.");
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(archiveRate).toHaveBeenCalledWith("r1"));
  });
});

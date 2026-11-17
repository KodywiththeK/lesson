import { describe, expect, it, vi } from "vitest";

import { archiveCardFeeRate, fetchCardFeeRates, saveCardFeeRate } from "./card-fee-rates";

describe("카드 수수료 설정 API", () => {
  it("학원의 활성 카드사만 이름순으로 읽고 수수료율을 숫자로 바꾼다", async () => {
    const query = { eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [{ id: "r1", name: "신한카드", rate_percent: "1.45" }], error: null });
    const client = { from: vi.fn(() => ({ select: vi.fn(() => query) })) };

    await expect(fetchCardFeeRates(client as unknown as Parameters<typeof fetchCardFeeRates>[0], "a")).resolves.toEqual([{ id: "r1", name: "신한카드", ratePercent: 1.45 }]);
    expect(query.eq).toHaveBeenCalledWith("academy_id", "a");
    expect(query.eq).toHaveBeenCalledWith("active", true);
  });

  it("저장·보관은 원장 RPC로 보낸다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "r1", name: "신한카드", rate_percent: 1.5 }, error: null });

    await expect(saveCardFeeRate({ rpc }, { academyId: "a", name: "신한카드", ratePercent: 1.5 }))
      .resolves.toEqual({ id: "r1", name: "신한카드", ratePercent: 1.5 });
    expect(rpc).toHaveBeenCalledWith("save_card_fee_rate", { p_academy_id: "a", p_id: null, p_name: "신한카드", p_rate_percent: 1.5 });

    rpc.mockResolvedValue({ data: null, error: null });
    await archiveCardFeeRate({ rpc }, { academyId: "a", id: "r1" });
    expect(rpc).toHaveBeenLastCalledWith("archive_card_fee_rate", { p_academy_id: "a", p_id: "r1" });
  });
});

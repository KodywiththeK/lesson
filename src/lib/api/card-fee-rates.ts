import type { CardFeeChoice, CardFeeRate } from "@/domain/card-fee";

import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { queryKeys } from "./query-keys";

type CardFeeRateRow = { id: string; name: string; rate_percent: number | string };
type RpcResult = { data: CardFeeRateRow | null; error: Error | null };

/** 원장·데스크가 읽는다(데스크는 회차권 입금 때 카드사를 고른다). 저장·보관은 원장만 RPC로 한다. */
export type CardFeeRateClient = {
  from(table: "card_fee_rates"): { select(columns: string): PagedSelectQuery<CardFeeRateRow> };
  rpc(name: "save_card_fee_rate" | "archive_card_fee_rate", payload: Record<string, unknown>): PromiseLike<RpcResult>;
};

/** numeric 칸은 문자열로 올 수도 있어 숫자로 맞춘다. */
function toCardFeeRate(row: CardFeeRateRow): CardFeeRate {
  return { id: row.id, name: row.name, ratePercent: Number(row.rate_percent) };
}

export async function fetchCardFeeRates(client: Pick<CardFeeRateClient, "from">, academyId: string) {
  const rows = await fetchAllRows("카드 수수료 설정을 불러오지 못했습니다", (from, to) => client.from("card_fee_rates")
    .select("id,name,rate_percent").eq("academy_id", academyId).eq("active", true).order("name").order("id").range(from, to));

  return rows.map(toCardFeeRate);
}

export async function saveCardFeeRate(client: Pick<CardFeeRateClient, "rpc">, input: {
  academyId: string; id?: string; name: string; ratePercent: number;
}) {
  const { data, error } = await client.rpc("save_card_fee_rate", {
    p_academy_id: input.academyId, p_id: input.id ?? null, p_name: input.name, p_rate_percent: input.ratePercent,
  });
  if (error) throw new Error(`카드사를 저장하지 못했습니다: ${error.message}`);
  if (!data) throw new Error("저장한 카드사를 확인할 수 없습니다.");

  return toCardFeeRate(data);
}

export async function archiveCardFeeRate(client: Pick<CardFeeRateClient, "rpc">, input: { academyId: string; id: string }) {
  const { error } = await client.rpc("archive_card_fee_rate", { p_academy_id: input.academyId, p_id: input.id });
  if (error) throw new Error(`카드사를 삭제하지 못했습니다: ${error.message}`);
}

export type CardFeeRatesQueryOptions = { queryKey: readonly unknown[]; queryFn: () => Promise<CardFeeRate[]> };

export function createCardFeeRatesQueryOptions(
  client: Pick<CardFeeRateClient, "from">,
  academyId: string,
): CardFeeRatesQueryOptions {
  return {
    queryKey: queryKeys.settings.cardFeeRates(academyId),
    queryFn: () => fetchCardFeeRates(client, academyId),
  };
}

/** 입금 RPC(수강료·회차권 6인자)의 카드 수수료 인자. 비우면 서버가 수수료를 기록하지 않거나 율로 계산한다. */
export function toCardFeeRpcParams(cardFee: CardFeeChoice | undefined) {
  return { p_card_fee_rate_id: cardFee?.rateId ?? null, p_card_fee_amount: cardFee?.amount ?? null };
}

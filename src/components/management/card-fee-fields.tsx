import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCardFeeRate, parseCardFeeDraft, type CardFeeRate } from "@/domain/card-fee";

const FIELD_CLASS_NAME = "grid gap-1 text-sm font-medium";

/**
 * 카드 입금의 카드사·수수료 칸. 결제 금액을 알면 수수료를 미리 계산해 보여 주고 고칠 수 있게 하고,
 * 모르면(데스크가 금액을 읽지 못하는 경우) 서버가 수수료율로 계산한다고만 알린다.
 */
export function CardFeeFields({
  rates,
  amount,
  rateId,
  feeDraft,
  feeError,
  onRateChange,
  onFeeChange,
}: {
  rates: CardFeeRate[];
  amount?: number;
  rateId: string;
  feeDraft: string;
  feeError: string | null;
  onRateChange: (rateId: string) => void;
  onFeeChange: (draft: string) => void;
}) {
  const selectedRate = rates.find((rate) => rate.id === rateId);

  return (
    <>
      <Label className={FIELD_CLASS_NAME}>
        <span>카드사</span>
        <NativeSelect aria-label="카드사" value={rateId} onChange={(event) => onRateChange(event.target.value)}>
          <NativeSelectOption value="">카드사 선택</NativeSelectOption>
          {rates.map((rate) => (
            <NativeSelectOption key={rate.id} value={rate.id}>
              {`${rate.name} (${formatCardFeeRate(rate.ratePercent)})`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      {selectedRate && amount !== undefined ? (
        <Label className={FIELD_CLASS_NAME}>
          <span>카드 수수료(원)</span>
          <Input
            aria-label="카드 수수료(원)"
            type="text"
            inputMode="numeric"
            value={feeDraft}
            aria-invalid={feeError !== null}
            onChange={(event) => onFeeChange(event.target.value)}
          />
        </Label>
      ) : null}
      {feeError ? (
        <p role="alert" className="text-sm text-destructive">
          {feeError}
        </p>
      ) : null}
      {selectedRate && feeError === null ? (
        <p className="text-sm text-muted-foreground">
          {amount !== undefined
            ? `수입 ${amount.toLocaleString("ko-KR")}원과 카드 수수료 ${(parseCardFeeDraft(feeDraft) ?? 0).toLocaleString("ko-KR")}원이 입출입내역에 기록됩니다.`
            : `카드 수수료(${formatCardFeeRate(selectedRate.ratePercent)})가 입출입내역에 출금으로 함께 기록됩니다.`}
        </p>
      ) : null}
    </>
  );
}

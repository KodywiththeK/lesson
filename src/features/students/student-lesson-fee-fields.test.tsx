import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  createLessonFeeDraft,
  setLessonFeeManually,
  type LessonFeeDraft,
} from "@/domain/lesson-fee-draft";

import { StudentLessonFeeFields } from "./student-lesson-fee-fields";

const context = { instrumentName: "기타", lessonType: "academy" as const, weekdayCount: 1 };

function FeeForm() {
  const [draft, setDraft] = useState<LessonFeeDraft>(() => createLessonFeeDraft(context));
  return (
    <>
      <StudentLessonFeeFields context={context} referenceMonth="2026-10" draft={draft} onChange={setDraft} />
      <output aria-label="저장용 레슨비">{draft.lessonFee}</output>
    </>
  );
}

function FeeFormWithLegacyDiscount() {
  const [draft, setDraft] = useState<LessonFeeDraft>(() => ({
    ...createLessonFeeDraft(context),
    otherDiscount: { amount: 10000, label: "기존 할인" },
  }));
  return (
    <>
      <StudentLessonFeeFields context={context} referenceMonth="2026-10" draft={draft} onChange={setDraft} />
      <output aria-label="저장용 기존 할인액">{draft.otherDiscount.amount}</output>
    </>
  );
}

const pricedContext = {
  instrumentName: "피아노",
  lessonType: "academy" as const,
  weekdayCount: 3,
};

function ManuallyPricedFeeForm() {
  const [draft, setDraft] = useState<LessonFeeDraft>(() =>
    setLessonFeeManually(createLessonFeeDraft(pricedContext), 145000),
  );

  return (
    <StudentLessonFeeFields
      context={pricedContext}
      referenceMonth="2026-10"
      draft={draft}
      onChange={setDraft}
    />
  );
}

function PrivateFeeFormWithoutWeekday() {
  const privateContext = {
    instrumentName: "바이올린",
    lessonType: "private" as const,
    weekdayCount: 0,
  };
  const [draft, setDraft] = useState<LessonFeeDraft>(() => createLessonFeeDraft(privateContext));

  return (
    <StudentLessonFeeFields
      context={privateContext}
      referenceMonth="2026-10"
      draft={draft}
      onChange={setDraft}
    />
  );
}

function PrivatePricedFeeForm() {
  const privateContext = {
    instrumentName: "피아노", lessonType: "private" as const, weekdayCount: 1,
  };
  const [draft, setDraft] = useState<LessonFeeDraft>(() => createLessonFeeDraft(privateContext));
  return <>
    <StudentLessonFeeFields context={privateContext} referenceMonth="2026-10" draft={draft} onChange={setDraft} />
    <output aria-label="저장용 수업 시간">{draft.minutes}</output>
    <button type="button" onClick={() => setDraft({ ...draft, minutes: 40 })}>수업 시간 초기화</button>
  </>;
}

describe("StudentLessonFeeFields", () => {
  it("30분과 직접 입력 수업 시간에서는 레슨비를 직접 받는다", async () => {
    const user = userEvent.setup();
    render(<PrivatePricedFeeForm />);
    const duration = screen.getByRole("combobox", { name: "수업 시간" });
    await user.selectOptions(duration, "30");
    expect(screen.getByLabelText("저장용 수업 시간")).toHaveTextContent("30");
    expect(screen.getByText(/레슨비를 직접 입력/)).toBeInTheDocument();
    await user.selectOptions(duration, "custom");
    await user.type(screen.getByRole("textbox", { name: "직접 입력 수업 시간" }), "45");
    expect(screen.getByLabelText("저장용 수업 시간")).toHaveTextContent("45");
  });
  it("외부에서 수업 시간을 기본값으로 되돌리면 직접 입력 칸이 닫힌다", async () => {
    const user = userEvent.setup();
    render(<PrivatePricedFeeForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: "수업 시간" }), "custom");
    await user.type(screen.getByRole("textbox", { name: "직접 입력 수업 시간" }), "45");
    await user.click(screen.getByRole("button", { name: "수업 시간 초기화" }));

    expect(screen.getByRole("combobox", { name: "수업 시간" })).toHaveValue("40");
    expect(screen.queryByRole("textbox", { name: "직접 입력 수업 시간" })).not.toBeInTheDocument();
  });
  it("직접 입력으로 40분을 적어도 입력칸은 유지된다", async () => {
    const user = userEvent.setup();
    render(<PrivatePricedFeeForm />);
    await user.selectOptions(screen.getByRole("combobox", { name: "수업 시간" }), "custom");
    await user.type(screen.getByRole("textbox", { name: "직접 입력 수업 시간" }), "40");

    expect(screen.getByRole("combobox", { name: "수업 시간" })).toHaveValue("custom");
    expect(screen.getByRole("textbox", { name: "직접 입력 수업 시간" })).toHaveValue("40");
  });
  it("초기 0을 지우고 빈 상태로 둔 뒤 쉼표 금액을 정확히 입력한다", async () => {
    const user = userEvent.setup();
    render(<FeeForm />);

    const fee = screen.getByRole("textbox", { name: "레슨비" });
    await user.clear(fee);
    expect(fee).toHaveValue("");
    await user.type(fee, "140,000");
    await user.tab();

    expect(fee).toHaveValue("140,000");
    expect(screen.getByLabelText("저장용 레슨비")).toHaveTextContent("140000");
  });

  it("기존 할인액도 빈 입력을 유지하고 쉼표 금액을 해석한다", async () => {
    const user = userEvent.setup();
    render(<FeeFormWithLegacyDiscount />);

    const discount = screen.getByRole("textbox", { name: "기존 할인액" });
    await user.clear(discount);
    expect(discount).toHaveValue("");
    await user.type(discount, "12,000");

    expect(screen.getByLabelText("저장용 기존 할인액")).toHaveTextContent("12000");
  });

  it("직접 입력한 레슨비를 현재 가격표로 명시적으로 되돌린다", async () => {
    const user = userEvent.setup();
    render(<ManuallyPricedFeeForm />);

    expect(screen.getByRole("textbox", { name: "레슨비" })).toHaveValue("145000");
    await user.click(screen.getByRole("button", { name: "가격표로 재계산" }));

    expect(screen.getByRole("textbox", { name: "레슨비" })).toHaveValue("150000");
    expect(screen.getByRole("spinbutton", { name: "최종 수강료" })).toHaveValue(150000);
  });

  it("개인레슨 요일을 고르기 전에는 기본 월 4회이며 요일에 따라 조정됨을 안내한다", () => {
    render(<PrivateFeeFormWithoutWeekday />);

    expect(screen.getByRole("textbox", { name: "월 횟수" })).toHaveValue(
      "기본 월 4회 · 요일 선택 시 조정",
    );
  });
});

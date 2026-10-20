import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createLessonFeeDraft, type LessonFeeDraft } from "@/domain/lesson-fee-draft";

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

describe("StudentLessonFeeFields", () => {
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
});

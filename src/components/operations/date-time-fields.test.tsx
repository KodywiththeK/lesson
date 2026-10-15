import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { DateField, DateTimeField, MonthField, TimeField } from "./date-time-fields";

function Controlled({
  Field,
  initial,
  label,
  required,
}: {
  Field: typeof DateField;
  initial: string;
  label: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return <Field aria-label={label} value={value} onValueChange={setValue} required={required} />;
}

describe("날짜와 시간 선택 필드", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("달력에서 선택한 날짜를 YYYY-MM-DD로 전달한다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateField} initial="2026-10-15" label="등록일" />);

    await user.click(screen.getByRole("button", { name: "등록일 달력 열기" }));
    await user.click(screen.getByRole("button", { name: "2026년 10월 20일 화요일" }));

    expect(screen.getByRole("textbox", { name: "등록일" })).toHaveValue("2026-10-20");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("달력 월 드롭다운은 브라우저 언어와 무관하게 한국어로 표시한다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateField} initial="2026-10-15" label="등록일" />);

    await user.click(screen.getByRole("button", { name: "등록일 달력 열기" }));

    expect(screen.getByRole("option", { name: "10월" })).toBeInTheDocument();
  });

  it.each([
    ["날짜", DateField, "등록일 달력 열기"],
    ["시간", TimeField, "등록일 시간 선택 열기"],
    ["월", MonthField, "등록일 월 선택 열기"],
    ["일시", DateTimeField, "등록일 달력 열기"],
  ] as const)("%s 선택기는 오른쪽 버튼의 오른쪽 끝을 기준으로 연다", async (_name, Field, triggerName) => {
    const user = userEvent.setup();
    render(<Controlled Field={Field} initial="" label="등록일" />);

    await user.click(screen.getByRole("button", { name: triggerName }));

    expect(document.querySelector('[data-slot="popover-content"]')).toHaveAttribute("data-align", "end");
  });

  it("시간을 시와 분으로 1분 단위 선택한다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={TimeField} initial="14:00" label="시작 시간" />);

    await user.click(screen.getByRole("button", { name: "시작 시간 시간 선택 열기" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "시" }), "15");
    await user.selectOptions(screen.getByRole("combobox", { name: "분" }), "37");

    expect(screen.getByRole("textbox", { name: "시작 시간" })).toHaveValue("15:37");
  });

  it("월과 날짜·시간은 기존 저장 형식을 유지한다", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled Field={MonthField} initial="2026-10" label="조회 월" />
        <Controlled Field={DateTimeField} initial="2026-10-15T14:00" label="수업 시간" />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "조회 월 월 선택 열기" }));
    await user.click(screen.getByRole("button", { name: "11월" }));

    expect(screen.getByRole("textbox", { name: "조회 월" })).toHaveValue("2026-11");
    expect(screen.getByRole("textbox", { name: "수업 시간" })).toHaveValue("2026-10-15T14:00");
  });

  it("키보드로 직접 입력한 값을 그대로 전달한다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateField} initial="" label="등록일" />);

    await user.type(screen.getByRole("textbox", { name: "등록일" }), "2026-10-20");

    expect(screen.getByRole("textbox", { name: "등록일" })).toHaveValue("2026-10-20");
  });

  it.each([
    ["날짜", DateField, "2026-10-20"],
    ["시간", TimeField, "09:05"],
    ["월", MonthField, "2026-10"],
    ["일시", DateTimeField, "2026-10-20T09:05"],
  ] as const)("%s 수기 입력 중인 미완성 값은 전달하지 않고 완성된 값만 전달한다", async (_name, Field, complete) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Field aria-label="값" value="" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "값" }) as HTMLInputElement;

    await user.type(input, complete.slice(0, -1));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.checkValidity()).toBe(false);

    await user.type(input, complete.slice(-1));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(complete);
    expect(input.checkValidity()).toBe(true);
  });

  it("수기 입력을 지우면 빈 값을 전달한다", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DateField aria-label="등록일" value="2026-10-15" onValueChange={onValueChange} />);

    await user.clear(screen.getByRole("textbox", { name: "등록일" }));

    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("필수 필드를 지워도 빈 값은 전달하지 않고 포커스를 잃으면 마지막 값으로 되돌린다", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MonthField aria-label="조회 월" value="2026-10" required onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "조회 월" });

    await user.clear(input);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");

    await user.tab();
    expect(input).toHaveValue("2026-10");
  });

  it.each([
    ["날짜", DateField, "2026-10-15", "2026-10-2"],
    ["시간", TimeField, "09:05", "9:"],
    ["월", MonthField, "2026-10", "2026-1"],
    ["일시", DateTimeField, "2026-10-15T09:05", "2026-10-15T9"],
  ] as const)("%s 필드에 잘못된 글자를 남기고 포커스를 잃으면 마지막 유효 값으로 되돌린다", async (_name, Field, valid, typed) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Field aria-label="값" value={valid} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "값" });

    await user.clear(input);
    await user.type(input, typed);
    expect(input).toHaveValue(typed);
    await user.tab();

    expect(input).toHaveValue(valid);
    expect((input as HTMLInputElement).checkValidity()).toBe(true);
  });

  it("입력 중이던 미완성 값은 선택기로 같은 값을 골라도 선택한 값으로 바로잡는다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateField} initial="2026-10-20" label="등록일" />);
    const input = screen.getByRole("textbox", { name: "등록일" });

    await user.type(input, "9");
    expect(input).toHaveValue("2026-10-209");
    await user.click(screen.getByRole("button", { name: "등록일 달력 열기" }));
    await user.click(screen.getByRole("button", { name: /2026년 10월 20일 화요일/ }));

    expect(input).toHaveValue("2026-10-20");
  });

  it.each([
    ["날짜", DateField, "2026-02-28", "2026-02-30"],
    ["시간", TimeField, "23:59", "24:00"],
    ["월", MonthField, "2026-12", "2026-13"],
    ["일시", DateTimeField, "2026-02-28T09:05", "2026-02-30T09:05"],
  ] as const)("%s 입력은 존재하지 않는 값을 제출 검증에서 거부한다", (_name, Field, valid, invalid) => {
    const { rerender } = render(<Field aria-label="값" value={valid} onValueChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "값" }) as HTMLInputElement;
    expect(input.checkValidity()).toBe(true);

    rerender(<Field aria-label="값" value={invalid} onValueChange={vi.fn()} />);
    expect(input.checkValidity()).toBe(false);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("비어 있는 값은 필수일 때만 제출 검증에서 거부한다", () => {
    const { rerender } = render(<DateField aria-label="등록일" value="" onValueChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "등록일" }) as HTMLInputElement;
    expect(input.checkValidity()).toBe(true);

    rerender(<DateField aria-label="등록일" value="" required onValueChange={vi.fn()} />);
    expect(input.checkValidity()).toBe(false);
  });

  it.each([
    ["날짜", DateField, "달력"],
    ["시간", TimeField, "시간 선택"],
    ["월", MonthField, "월 선택"],
    ["일시", DateTimeField, "달력"],
  ] as const)("%s 필드가 비활성이면 입력과 선택기 버튼을 모두 막는다", (_name, Field, action) => {
    render(<Field aria-label="값" value="" disabled onValueChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "값" })).toBeDisabled();
    expect(screen.getByRole("button", { name: `값 ${action} 열기` })).toBeDisabled();
  });

  it("빈 일시는 날짜와 시간을 모두 고를 때까지 값을 채우지 않는다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateTimeField} initial="" label="시작 시간" />);
    const input = screen.getByRole("textbox", { name: "시작 시간" });

    await user.click(screen.getByRole("button", { name: "시작 시간 달력 열기" }));
    await user.click(screen.getByRole("button", { name: "2026년 10월 20일 화요일" }));
    expect(input).toHaveValue("");

    await user.selectOptions(screen.getByRole("combobox", { name: "시" }), "09");
    expect(input).toHaveValue("");

    await user.selectOptions(screen.getByRole("combobox", { name: "분" }), "05");
    expect(input).toHaveValue("2026-10-20T09:05");
  });

  it("빈 일시에서 선택기를 닫으면 고르다 만 값은 버린다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateTimeField} initial="" label="시작 시간" />);

    await user.click(screen.getByRole("button", { name: "시작 시간 달력 열기" }));
    await user.click(screen.getByRole("button", { name: "2026년 10월 20일 화요일" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "시작 시간 달력 열기" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "시" }), "09");
    await user.selectOptions(screen.getByRole("combobox", { name: "분" }), "05");

    expect(screen.getByRole("textbox", { name: "시작 시간" })).toHaveValue("");
  });

  it("완성된 일시에서 시간만 바꾸면 날짜를 유지한다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={DateTimeField} initial="2026-10-15T14:00" label="수업 시간" />);

    await user.click(screen.getByRole("button", { name: "수업 시간 달력 열기" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "시" }), "16");

    expect(screen.getByRole("textbox", { name: "수업 시간" })).toHaveValue("2026-10-15T16:00");
  });

  it("빈 시간은 시와 분을 모두 고를 때까지 값을 채우지 않는다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={TimeField} initial="" label="시작 시간" />);
    const input = screen.getByRole("textbox", { name: "시작 시간" });

    await user.click(screen.getByRole("button", { name: "시작 시간 시간 선택 열기" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "시" }), "15");
    expect(input).toHaveValue("");

    await user.selectOptions(screen.getByRole("combobox", { name: "분" }), "37");
    expect(input).toHaveValue("15:37");
  });

  it("월 선택은 연도만 바꿔서는 값을 바꾸지 않고 월을 누르면 확정한다", async () => {
    const user = userEvent.setup();
    render(<Controlled Field={MonthField} initial="" label="조회 월" />);
    const input = screen.getByRole("textbox", { name: "조회 월" });

    await user.click(screen.getByRole("button", { name: "조회 월 월 선택 열기" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "연도" }), "2027");
    expect(input).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "3월" }));
    expect(input).toHaveValue("2027-03");
  });

  it("다이얼로그 안에서도 선택기가 열리고 선택 후 다이얼로그를 유지한다", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>등록</DialogTitle>
          <DialogDescription>날짜를 고른다</DialogDescription>
          <Controlled Field={DateField} initial="2026-10-15" label="등록일" />
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "등록일 달력 열기" }));
    await user.click(screen.getByRole("button", { name: "2026년 10월 20일 화요일" }));

    expect(screen.getByRole("textbox", { name: "등록일" })).toHaveValue("2026-10-20");
    expect(screen.getByRole("dialog", { name: "등록" })).toBeInTheDocument();
  });
});

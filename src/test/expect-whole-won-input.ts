import { fireEvent } from "@testing-library/react";
import { expect } from "vitest";

const WHOLE_WON_CASES = [
  ["1", true],
  ["1000", true],
  ["140000", true],
  ["140001", true],
  ["0", false],
  ["-1000", false],
  ["1.5", false],
] as const;

/** 금액 input이 1원 단위 양의 정수만 브라우저 제약 검증으로 허용하는지 확인한다. */
export function expectWholeWonInput(input: HTMLInputElement) {
  for (const [value, isValid] of WHOLE_WON_CASES) {
    fireEvent.change(input, { target: { value } });
    expect(input.checkValidity(), `${value}원 입력의 제약 검증`).toBe(isValid);
  }
}

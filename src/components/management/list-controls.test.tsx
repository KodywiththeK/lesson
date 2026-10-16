import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListStatusAlert } from "./list-controls";

describe("ListStatusAlert", () => {
  it("오류 제목과 안내를 보여 준다", () => {
    render(<ListStatusAlert message="불러오지 못했습니다." detail="잠시 후 다시 시도해 주세요." />);

    expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했습니다.");
    expect(screen.queryByRole("button", { name: "다시 불러오기" })).not.toBeInTheDocument();
  });

  it("다시 불러오기 동작이 있으면 버튼으로 다시 시도할 수 있다", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ListStatusAlert message="불러오지 못했습니다." detail="안내" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "다시 불러오기" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

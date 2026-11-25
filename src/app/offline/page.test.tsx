import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OfflinePage from "./page";

describe("OfflinePage", () => {
  it("인터넷이 끊겼을 때 학생 정보 없이 연결 확인 안내와 다시 시도 링크만 보여 준다", () => {
    render(<OfflinePage />);

    expect(screen.getByRole("heading", { level: 1, name: "인터넷 연결을 확인해 주세요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute("href", "/");
  });
});

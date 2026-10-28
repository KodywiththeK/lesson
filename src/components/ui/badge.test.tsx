import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge 기본 배경", () => {
  it("배경을 지정하지 않은 기본·외곽선 태그는 흰 바탕과 테두리를 쓴다", () => {
    render(<><Badge>개인레슨</Badge><Badge variant="outline">원생</Badge></>);
    expect(screen.getByText("개인레슨")).toHaveClass("bg-white", "border");
    expect(screen.getByText("원생")).toHaveClass("bg-white", "border");
  });
});

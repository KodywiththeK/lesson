import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatFigure, StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("라벨과 값을 함께 보여 준다", () => {
    render(
      <StatTile role="group" aria-label="수입" label="수입">
        598,000원
      </StatTile>,
    );

    const tile = screen.getByRole("group", { name: "수입" });

    expect(within(tile).getByText("수입")).toBeInTheDocument();
    expect(within(tile).getByText("598,000원")).toBeInTheDocument();
  });
});

describe("StatFigure", () => {
  it("값이 아직 없으면 호출한 쪽이 넘긴 대체 표시를 그대로 보여 준다", () => {
    render(<StatFigure label="지출">-</StatFigure>);

    expect(screen.getByText("지출")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("강조하지 않은 값은 강조한 값과 다른 글자 크기를 쓴다", () => {
    const { rerender } = render(<StatFigure label="합계">1원</StatFigure>);
    const emphasizedClassName = screen.getByText("1원").className;

    rerender(
      <StatFigure label="합계" emphasized={false}>
        1원
      </StatFigure>,
    );

    expect(screen.getByText("1원").className).not.toBe(emphasizedClassName);
  });
});

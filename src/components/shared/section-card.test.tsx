import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionCard, SectionHeader } from "./section-card";

describe("SectionCard", () => {
  it("자식과 접근성 속성을 그대로 전달한다", () => {
    render(
      <SectionCard role="group" aria-label="교재 재고">
        <p>재고 내용</p>
      </SectionCard>,
    );

    expect(within(screen.getByRole("group", { name: "교재 재고" })).getByText("재고 내용")).toBeInTheDocument();
  });

  it("padded를 끄면 표처럼 안쪽 여백을 직접 정하는 내용을 가장자리까지 둘 수 있다", () => {
    const { rerender } = render(
      <SectionCard role="group" aria-label="카드">
        내용
      </SectionCard>,
    );
    const paddedClassName = screen.getByRole("group", { name: "카드" }).className;

    rerender(
      <SectionCard role="group" aria-label="카드" padded={false}>
        내용
      </SectionCard>,
    );

    expect(screen.getByRole("group", { name: "카드" }).className).not.toBe(paddedClassName);
  });
});

describe("SectionHeader", () => {
  it("제목을 h2로, 설명과 작업 영역을 함께 보여 준다", () => {
    render(
      <SectionHeader
        title="교재 등록 관리"
        description="새로운 교재를 입고 및 등록합니다."
        actions={<button type="button">교재 등록</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "교재 등록 관리" })).toBeInTheDocument();
    expect(screen.getByText("새로운 교재를 입고 및 등록합니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "교재 등록" })).toBeInTheDocument();
  });

  it("설명과 작업이 없으면 제목만 보여 준다", () => {
    render(<SectionHeader title="수납/미납 현황" />);

    expect(screen.getByRole("heading", { level: 2, name: "수납/미납 현황" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("제목 id를 받아 구획이 aria-labelledby로 제목을 이름으로 쓸 수 있다", () => {
    render(
      <section aria-labelledby="income-heading">
        <SectionHeader headingId="income-heading" title="학원 고정 수입" />
      </section>,
    );

    expect(screen.getByRole("region", { name: "학원 고정 수입" })).toBeInTheDocument();
  });

  it("제목 단계가 낮을수록 글자가 작다", () => {
    render(
      <>
        <SectionHeader title="큰 제목" />
        <SectionHeader as="h3" title="작은 제목" />
      </>,
    );

    expect(screen.getByRole("heading", { name: "큰 제목" }).className).not.toBe(
      screen.getByRole("heading", { name: "작은 제목" }).className,
    );
  });

  it("카드 안쪽 소제목은 제목 단계를 바꿔 쓸 수 있다", () => {
    render(<SectionHeader as="h3" title="월별 수입" />);

    expect(screen.getByRole("heading", { level: 3, name: "월별 수입" })).toBeInTheDocument();
  });
});

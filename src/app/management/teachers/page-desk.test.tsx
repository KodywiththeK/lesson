import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../providers";
import TeachersPage from "./page";

vi.mock("@/features/auth/academy-session-gate", () => ({
  AcademySessionGate: ({
    children,
  }: {
    children: (context: {
      academyId: string;
      academyName: string;
      permissionContext: { role: "desk" };
    }) => React.ReactNode;
  }) =>
    children({
      academyId: "academy-demo",
      academyName: "더 클래식",
      permissionContext: { role: "desk" },
    }),
}));

describe("TeachersPage (데스크 로그인)", () => {
  it("세션 역할이 데스크이면 급여 컬럼과 급여 형태 필터를 숨기고 마스킹 주민등록번호 컬럼은 보여 준다", async () => {
    window.history.pushState(null, "", "/management/teachers");

    render(
      <AppProviders>
        <TeachersPage />
      </AppProviders>,
    );

    expect(await screen.findByText("김하늘")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "급여" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("급여 형태 필터")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "주민등록번호" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "계약 기간" })).toBeInTheDocument();
  });
});

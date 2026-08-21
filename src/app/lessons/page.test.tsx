import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import LessonsPage from "./page";

describe("LessonsPage", () => {
  it("레슨 시간표 화면과 캘린더 기반 레슨관리표 진입점을 보여준다", () => {
    render(
      <AppProviders>
        <LessonsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "레슨 시간표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "레슨관리표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "학원 레슨표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "2026년 8월 학원 레슨 캘린더" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "미등원인원" }),
    ).toBeInTheDocument();
  });
});

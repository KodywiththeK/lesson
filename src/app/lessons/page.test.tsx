import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import LessonsPage from "./page";

describe("LessonsPage", () => {
  it("레슨 시간표 화면과 개인레슨 등록 진입점을 보여준다", () => {
    render(
      <AppProviders>
        <LessonsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "레슨 시간표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "개인레슨 등록" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "개인레슨 등록" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Supabase 환경변수가 설정되면 개인레슨 등록 선택지를 불러올 수 있습니다.",
      ),
    ).toBeInTheDocument();
  });
});

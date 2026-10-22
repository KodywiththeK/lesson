import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import LessonTicketSettingsPage from "./page";

describe("LessonTicketSettingsPage", () => {
  it("설정 메뉴의 회차권 설정에서 환불 규정 화면으로 진입한다", async () => {
    window.history.pushState(null, "", "/settings/lesson-tickets");

    render(
      <AppProviders>
        <LessonTicketSettingsPage />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "설정" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "회차권 설정" })).toHaveAttribute(
      "href",
      "/settings/lesson-tickets",
    );
    expect(await screen.findByRole("radio", { name: /환불 불가/ })).toBeChecked();
  });

  it("규정을 바꿔 저장하면 데모 상태에 반영되어 다시 불러와도 유지된다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/settings/lesson-tickets");

    render(
      <AppProviders>
        <LessonTicketSettingsPage />
      </AppProviders>,
    );

    await user.click(await screen.findByRole("radio", { name: /반 이하 사용 시에만 남은 회수 비례 환불/ }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /반 이하 사용 시에만 남은 회수 비례 환불/ })).toBeChecked(),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "저장" })).toBeDisabled());
  });
});

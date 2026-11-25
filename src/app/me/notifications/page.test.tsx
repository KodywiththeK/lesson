import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import MyNotificationsPage from "./page";

describe("MyNotificationsPage", () => {
  it("헤더의 종 아이콘으로 들어오는 개인 알림 설정 화면이다", async () => {
    window.history.pushState(null, "", "/me/notifications");
    render(
      <AppProviders>
        <MyNotificationsPage />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "내 알림 설정" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 알림 설정" })).toHaveAttribute("href", "/me/notifications");
    const preferences = await screen.findByRole("region", { name: "받을 알림" });
    expect(await within(preferences).findByRole("switch", { name: "아침 브리핑 메일" })).toBeChecked();
    expect(screen.getByRole("region", { name: "이 기기 알림" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "앱 설치" })).toBeInTheDocument();
  });
});

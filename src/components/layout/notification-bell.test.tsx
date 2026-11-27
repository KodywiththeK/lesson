import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotificationBell } from "./notification-bell";

describe("NotificationBell", () => {
  it("알림함으로 가고, 안 읽은 알림이 있으면 접근 이름에 알린다", () => {
    const { rerender } = render(<NotificationBell hasUnread={false} />);
    expect(screen.getByRole("link", { name: "알림함" })).toHaveAttribute("href", "/me/inbox");

    rerender(<NotificationBell hasUnread />);
    expect(screen.getByRole("link", { name: "알림함, 읽지 않은 알림 있음" })).toHaveAttribute("href", "/me/inbox");
  });
});

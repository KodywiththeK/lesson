import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import MyInboxPage from "./page";

describe("MyInboxPage", () => {
  it("헤더 종으로 들어오는 알림함이다", async () => {
    window.history.pushState(null, "", "/me/inbox");
    render(
      <AppProviders>
        <MyInboxPage />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "알림함" })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "받은 알림" })).toBeInTheDocument();
  });
});

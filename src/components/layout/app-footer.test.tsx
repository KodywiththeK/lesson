import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppFooter } from "./app-footer";

describe("AppFooter", () => {
  it("문의 메일·오픈채팅, 약관·개인정보처리방침, 저작권·버전을 보여 준다", () => {
    render(<AppFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: /kody\.withe\.k@gmail\.com/ })).toHaveAttribute(
      "href",
      "mailto:kody.withe.k@gmail.com",
    );
    const openChat = within(footer).getByRole("link", { name: /카카오톡 오픈채팅/ });
    expect(openChat).toHaveAttribute("href", "https://open.kakao.com/o/s7t9hSYi");
    expect(openChat).toHaveAttribute("target", "_blank");
    expect(openChat).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(within(footer).getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByText(/© 2026 마디마디/)).toBeInTheDocument();
    expect(within(footer).getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";

describe("개인정보처리방침·이용약관", () => {
  it("개인정보처리방침은 보호책임자·위탁·국외 이전·주민등록번호 암호화를 밝히고 푸터를 둔다", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "개인정보처리방침" })).toBeInTheDocument();
    expect(screen.getByText("성명: 김동성")).toBeInTheDocument();
    expect(screen.getAllByText(/kody\.withe\.k@gmail\.com/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /처리 위탁과 국외 이전/ })).toBeInTheDocument();
    expect(screen.getByText(/일본 도쿄/)).toBeInTheDocument();
    expect(screen.getByText(/주민등록번호는 암호화/)).toBeInTheDocument();
    expect(screen.getByText(/시행일: 2026년 11월 27일/)).toBeInTheDocument();
    expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: "이용약관" })).toBeInTheDocument();
    expect(privacyMetadata.title).toBe("개인정보처리방침");
  });

  it("이용약관은 목적·학원 데이터 책임·문의를 담는다", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "이용약관" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /목적/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /학원이 입력하는 정보/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "개인정보처리방침" }).length).toBeGreaterThan(0);
    expect(termsMetadata.title).toBe("이용약관");
  });
});

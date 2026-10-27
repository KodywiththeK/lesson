import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStatus, retire } = vi.hoisted(() => ({ getStatus: vi.fn(), retire: vi.fn() }));

vi.mock("@/lib/api/legacy-owner-retirement", () => ({
  getLegacyOwnerRetirementStatus: getStatus,
  retireLegacyOwnerEmail: retire,
}));

import { LegacyOwnerRetirementScreen } from "./legacy-owner-retirement-screen";

describe("기존 원장 이메일 로그인 정리 화면", () => {
  beforeEach(() => {
    getStatus.mockReset();
    retire.mockReset();
  });

  it("연결 전에는 삭제 버튼을 보여주지 않는다", async () => {
    getStatus.mockResolvedValue({ state: "needs-kakao" });
    render(<LegacyOwnerRetirementScreen />);
    expect(await screen.findByText("카카오 계정을 먼저 연결해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기존 이메일 로그인 정보 삭제" })).not.toBeInTheDocument();
  });

  it("연결된 원장만 확인 대화상자에서 삭제를 실행할 수 있다", async () => {
    getStatus.mockResolvedValue({ state: "ready", academyName: "더 클래식 음악학원" });
    retire.mockResolvedValue({ state: "complete", academyName: "더 클래식 음악학원" });
    render(<LegacyOwnerRetirementScreen />);

    expect(await screen.findByText("더 클래식 음악학원")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "기존 이메일 로그인 정보 삭제" }));
    expect(retire).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    expect(retire).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("기존 이메일 로그인 정보를 삭제했습니다.");
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRequiredError } from "@/lib/api/current-academy";

import { AcademySessionGate } from "./academy-session-gate";

const fetchCurrentAcademyContext = vi.fn();

vi.mock("@/lib/api/current-academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/current-academy")>()),
  fetchCurrentAcademyContext: (...args: unknown[]) => fetchCurrentAcademyContext(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword: vi.fn() } }),
}));

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AcademySessionGate>{(academy) => <p>{academy.academyName} 화면</p>}</AcademySessionGate>
    </QueryClientProvider>,
  );
}

describe("AcademySessionGate", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_E2E_DEMO", "0");
    fetchCurrentAcademyContext.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("로그인하지 않았으면 비어 있는 로그인 폼을 보여준다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();

    const form = await screen.findByRole("form", { name: "로그인" });
    expect(form).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "마디마디" })).toBeInTheDocument();
    expect(screen.getByText("모든 수업의 마디마다, 더 편리한 음악학원 관리"))
      .toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
    expect(screen.queryByText("Service Console")).not.toBeInTheDocument();
  });

  it("MVP 자동채움 환경변수가 있으면 로그인 폼에 이메일과 비밀번호를 미리 채운다", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_EMAIL", "owner@example.test");
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD", "mvp-password");
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();

    await screen.findByRole("form", { name: "로그인" });
    expect(screen.getByLabelText("이메일")).toHaveValue("owner@example.test");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("mvp-password");
  });

  it("자동채움 값은 일부만 있어도 있는 칸만 채운다", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_EMAIL", "owner@example.test");
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();

    await screen.findByRole("form", { name: "로그인" });
    expect(screen.getByLabelText("이메일")).toHaveValue("owner@example.test");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });

  it("로그인했지만 학원 정보를 못 불러오면 로그인 폼 대신 원인과 다시 시도를 안내한다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new Error("활성 학원 멤버십이 없습니다."));
    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent("학원 정보를 불러오지 못했습니다.");
    expect(screen.getByRole("alert")).toHaveTextContent("활성 학원 멤버십이 없습니다.");
    expect(screen.queryByRole("form", { name: "로그인" })).not.toBeInTheDocument();

    fetchCurrentAcademyContext.mockResolvedValue({
      academyId: "academy-1",
      academyName: "더 클래식",
      permissionContext: { role: "owner" },
    });
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("더 클래식 화면")).toBeInTheDocument();
  });
});

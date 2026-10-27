import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRequiredError, NoMembershipError, AcademySelectionRequiredError } from "@/lib/api/current-academy";

import { AcademySessionGate, useAcademySessionControls } from "./academy-session-gate";

const fetchCurrentAcademyContext = vi.fn();
const signInWithOAuth = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/api/current-academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/current-academy")>()),
  fetchCurrentAcademyContext: (...args: unknown[]) => fetchCurrentAcademyContext(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth, signInWithPassword, signOut } }),
}));

function renderGate(children: (academyName: string) => React.ReactNode = (academyName) => <p>{academyName} 화면</p>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AcademySessionGate>{(academy) => children(academy.academyName)}</AcademySessionGate>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function SwitchAcademy() {
  const session = useAcademySessionControls();
  return <button type="button" onClick={() => session?.selectAcademy("academy-2")}>학원 바꾸기</button>;
}

describe("AcademySessionGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_E2E_DEMO", "0");
    fetchCurrentAcademyContext.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("로그인하지 않았으면 카카오와 기존 이메일 로그인을 모두 보여준다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();

    expect(await screen.findByRole("button", { name: "카카오로 시작하기" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "마디마디" })).toBeInTheDocument();
    expect(screen.getByText("모든 수업의 마디마다, 더 편리한 음악학원 관리"))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "이메일" })).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.queryByText("Service Console")).not.toBeInTheDocument();
  });

  it("기존 이메일 계정으로 로그인하면 활성 학원을 다시 조회한다", async () => {
    fetchCurrentAcademyContext
      .mockRejectedValueOnce(new AuthRequiredError())
      .mockResolvedValue({
        academyId: "academy-1",
        academyName: "더 클래식",
        permissionContext: { role: "owner" },
        availableAcademies: [{ academyId: "academy-1", academyName: "더 클래식", role: "owner" }],
      });
    signInWithPassword.mockResolvedValue({ error: null });
    renderGate();

    await userEvent.type(await screen.findByRole("textbox", { name: "이메일" }), "owner@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "example-password");
    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "example-password",
    });
    expect(await screen.findByText("더 클래식 화면")).toBeInTheDocument();
  });

  it("로컬 개발 화면에서는 기존 환경변수의 이메일과 비밀번호를 자동으로 채운다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_EMAIL", "local@example.com");
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD", "local-password");
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();

    expect(await screen.findByRole("textbox", { name: "이메일" })).toHaveValue("local@example.com");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("local-password");
  });

  it("운영 화면에서는 자동 채우기 값을 사용하지 않는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_EMAIL", "local@example.com");
    vi.stubEnv("NEXT_PUBLIC_PREFILL_LOGIN_PASSWORD", "local-password");
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();

    expect(await screen.findByRole("textbox", { name: "이메일" })).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });

  it("카카오 버튼은 OAuth를 시작한다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new AuthRequiredError());
    renderGate();
    signInWithOAuth.mockResolvedValue({ error: null });
    await userEvent.click(await screen.findByRole("button", { name: "카카오로 시작하기" }));
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "kakao" }));
    expect(screen.getByRole("button", { name: "카카오로 시작하기" })).toHaveClass("bg-[#FEE500]");
  });

  it("학원이 없는 로그인 사용자는 가입 경로를 선택한다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new NoMembershipError());
    renderGate();
    expect(await screen.findByRole("heading", { name: "학원 시작하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 학원 만들기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "학원에 가입 신청" })).toBeInTheDocument();
  });

  it("학원 가입 화면에서 로그아웃하면 세션과 학원 선택을 정리한다", async () => {
    fetchCurrentAcademyContext.mockRejectedValueOnce(new NoMembershipError()).mockRejectedValue(new AuthRequiredError());
    signOut.mockResolvedValue({ error: null });
    window.localStorage.setItem("selected-academy-id", "old-academy");
    const { queryClient } = renderGate();
    queryClient.setQueryData(["students", "old-academy"], ["이전 데이터"]);

    await userEvent.click(await screen.findByRole("button", { name: "로그아웃" }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("selected-academy-id")).toBeNull();
    expect(queryClient.getQueryData(["students", "old-academy"])).toBeUndefined();
    expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  });

  it("마지막 학원이 유효하지 않으면 활성 학원 중에서 다시 선택한다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new AcademySelectionRequiredError([
      { academyId: "academy-1", academyName: "더 클래식", role: "owner" },
    ]));
    renderGate();
    expect(await screen.findByRole("button", { name: /더 클래식/ })).toBeInTheDocument();
  });

  it("학원 전환은 다른 형태의 학원별 캐시까지 정리한다", async () => {
    fetchCurrentAcademyContext.mockImplementation(async (_client, selectedId) => ({
      academyId: selectedId ?? "academy-1",
      academyName: selectedId ? "나 학원" : "가 학원",
      permissionContext: { role: "owner" },
      availableAcademies: [
        { academyId: "academy-1", academyName: "가 학원", role: "owner" },
        { academyId: "academy-2", academyName: "나 학원", role: "owner" },
      ],
    }));
    const { queryClient } = renderGate((academyName) => <><p>{academyName} 화면</p><SwitchAcademy /></>);
    expect(await screen.findByText("가 학원 화면")).toBeInTheDocument();
    queryClient.setQueryData(["teacher-roster", "academy-1"], ["이전 학원 원생"]);
    await userEvent.click(screen.getByRole("button", { name: "학원 바꾸기" }));
    expect(await screen.findByText("나 학원 화면")).toBeInTheDocument();
    expect(queryClient.getQueryData(["teacher-roster", "academy-1"])).toBeUndefined();
  });

  it("로그인했지만 학원 정보를 못 불러오면 로그인 폼 대신 원인과 다시 시도를 안내한다", async () => {
    fetchCurrentAcademyContext.mockRejectedValue(new Error("활성 학원 멤버십이 없습니다."));
    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent("학원 정보를 불러오지 못했습니다.");
    expect(screen.getByRole("alert")).toHaveTextContent("활성 학원 멤버십이 없습니다.");
    expect(screen.queryByRole("button", { name: "카카오로 시작하기" })).not.toBeInTheDocument();

    fetchCurrentAcademyContext.mockResolvedValue({
      academyId: "academy-1",
      academyName: "더 클래식",
      permissionContext: { role: "owner" },
      availableAcademies: [{ academyId: "academy-1", academyName: "더 클래식", role: "owner" }],
    });
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("더 클래식 화면")).toBeInTheDocument();
  });
});

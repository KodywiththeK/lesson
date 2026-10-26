import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePageHeaderActions } from "@/components/layout/page-actions";
import type { PermissionContext } from "@/domain/permissions";

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it.each<[PermissionContext, string]>([
    [{ role: "owner" }, "원장"],
    [{ role: "desk" }, "데스크"],
    [{ role: "teacher", teacherId: "teacher-1", assignedStudentIds: [] }, "선생님"],
  ])("헤더 사용자 영역에 학원명과 역할(%j)을 표시만 한다", (permissionContext, roleLabel) => {
    window.history.pushState(null, "", "/");

    render(<AppShell academyName="더 클래식" permissionContext={permissionContext} />);

    const header = screen.getByRole("banner");

    expect(within(header).getByText(`더 클래식 · ${roleLabel}`)).toBeInTheDocument();
    expect(within(screen.getByRole("complementary")).getByRole("img", { name: "마디마디" }))
      .toBeInTheDocument();
    // "현재 학원: …" 안내는 사이드바에만 둔다.
    expect(within(header).queryByText("현재 학원: 더 클래식")).not.toBeInTheDocument();
  });

  it("owner에게 운영 전체 메뉴를 보여주고 공통 헤더 액션은 노출하지 않는다", () => {
    window.history.pushState(null, "", "/");

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      />,
    );

    const header = screen.getByRole("banner");
    expect(within(header).queryByText("현재 학원: 더 클래식")).not.toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "대시보드",
      "레슨 시간표",
      "학원레슨표",
      "개인레슨표",
      "회차권",
      "인원·거래처",
      "원생",
      "선생님",
      "휴원/퇴원",
      "거래처",
      "상담",
      "교재",
      "재고",
      "출고",
      "결제 완료",
      "발주·입고",
      "수입 관리",
      "학원 고정 수입",
      "입출입내역",
      "교재 내역",
      "선생님 월급",
      "전체 수입",
      "설정",
      "레슨시간표",
      "회차권 설정",
    ]);
    expect(
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    expect(within(navigation).getByRole("link", { name: "원생" })).toHaveAttribute(
      "href",
      "/management/students",
    );
    expect(
      within(navigation).getByRole("link", { name: "선생님" }),
    ).toHaveAttribute("href", "/management/teachers");
    expect(
      within(navigation).getByRole("link", { name: "휴원/퇴원" }),
    ).toHaveAttribute("href", "/management/status");
    expect(
      within(navigation).getByRole("link", { name: "거래처" }),
    ).toHaveAttribute("href", "/management/vendors");
    expect(within(navigation).getByRole("link", { name: "상담" })).toHaveAttribute(
      "href",
      "/management/consultations",
    );
    expect(screen.queryByRole("link", { name: /수납 등록/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /출석 확인/ })).not.toBeInTheDocument();
  });

  it("데스크는 레슨시간표 설정을 열고 다른 설정 하위 메뉴는 볼 수 없다", () => {
    window.history.pushState(null, "", "/settings/lesson-schedule");
    render(<AppShell academyName="더 클래식" permissionContext={{ role: "desk" }}><p>시간표 설정 내용</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "레슨시간표" })).toHaveAttribute("href", "/settings/lesson-schedule");
    expect(within(navigation).queryByRole("link", { name: "회차권 설정" })).not.toBeInTheDocument();
    expect(screen.getByText("시간표 설정 내용")).toBeInTheDocument();
  });

  it("teacher에게는 거래처와 수입 관리성 메뉴를 숨기고 아직 없는 내 급여 링크도 보여주지 않는다", () => {
    window.history.pushState(null, "", "/management/students");

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{
          role: "teacher",
          teacherId: "teacher-1",
          assignedStudentIds: ["student-1"],
        }}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    const labels = within(navigation).getAllByRole("link").map((link) => link.textContent);

    expect(labels).toContain("레슨 시간표");
    expect(labels).toContain("학원레슨표");
    expect(labels).toContain("개인레슨표");
    expect(labels).toContain("인원·거래처");
    expect(labels).toContain("원생");
    expect(labels).not.toContain("내 급여");
    expect(within(navigation).getByRole("link", { name: "원생" })).toHaveAttribute(
      "href",
      "/management/students",
    );
    expect(labels).not.toContain("선생님");
    expect(labels).not.toContain("휴원/퇴원");
    expect(labels).not.toContain("수입 관리");
    expect(labels).not.toContain("설정");
    expect(labels).not.toContain("거래처");
    expect(labels).not.toContain("상담");
    expect(screen.queryByRole("link", { name: /수납 등록/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /출석 확인/ })).not.toBeInTheDocument();
  });

  it("권한이 없는 화면 주소로 들어오면 내용을 불러오지 않고 안내 문구를 보여준다", () => {
    window.history.pushState(null, "", "/finance/ledger");
    const mounted = vi.fn();

    function ProtectedContent() {
      mounted();
      return <p>입출금 내역 목록</p>;
    }

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{
          role: "teacher",
          teacherId: "teacher-1",
          assignedStudentIds: [],
        }}
      >
        <ProtectedContent />
      </AppShell>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("이 화면을 볼 권한이 없습니다");
    expect(screen.getByRole("alert")).toHaveTextContent("원장에게 문의해 주세요");
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("입출금 내역 목록")).not.toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });

  it("권한이 있는 화면 주소에서는 내용을 그대로 보여준다", () => {
    window.history.pushState(null, "", "/finance/ledger");

    render(
      <AppShell academyName="더 클래식" permissionContext={{ role: "owner" }}>
        <p>입출금 내역 목록</p>
      </AppShell>,
    );

    expect(screen.getByText("입출금 내역 목록")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("children 메뉴는 기본 펼침이고 toggle로 접고 펼친다", async () => {
    window.history.pushState(null, "", "/management/students");

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "원생" })).toBeInTheDocument();

    await userEvent.click(
      within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 접기" }),
    );
    expect(within(navigation).queryByRole("link", { name: "원생" })).not.toBeInTheDocument();

    await userEvent.click(
      within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 펼치기" }),
    );
    expect(within(navigation).getByRole("link", { name: "원생" })).toBeInTheDocument();
  });

  it("lg 이하 화면을 위한 drawer 메뉴 버튼으로 주요 메뉴를 연다", async () => {
    window.history.pushState(null, "", "/lessons/academy");

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));

    const drawer = screen.getByRole("dialog", { name: "주요 메뉴" });
    expect(within(drawer).getByText("현재 학원: 더 클래식")).toBeInTheDocument();
    expect(within(drawer).getByRole("img", { name: "마디마디" })).toBeInTheDocument();
    const navigation = within(drawer).getByRole("navigation", {
      name: "모바일 주요 메뉴",
    });

    expect(within(navigation).getByRole("link", { name: "레슨 시간표" }))
      .toHaveAttribute("href", "/lessons/academy");
    expect(within(navigation).getByRole("link", { name: "학원레슨표" }))
      .toHaveAttribute("href", "/lessons/academy");
    expect(within(navigation).getByRole("link", { name: "개인레슨표" }))
      .toHaveAttribute("href", "/lessons/private");
  });

  it("route가 바뀌어 shell이 다시 만들어져도 데스크톱 메뉴 스크롤 위치를 복원한다", () => {
    window.history.pushState(null, "", "/lessons/academy");
    const firstRender = render(
      <AppShell academyName="더 클래식" permissionContext={{ role: "owner" }} />,
    );
    const firstScrollArea = screen.getByLabelText("데스크톱 메뉴 스크롤");
    firstScrollArea.scrollTop = 184;
    fireEvent.scroll(firstScrollArea);
    firstRender.unmount();

    window.history.pushState(null, "", "/finance/ledger");
    render(<AppShell academyName="더 클래식" permissionContext={{ role: "owner" }} />);

    expect(screen.getByLabelText("데스크톱 메뉴 스크롤").scrollTop).toBe(184);
  });

  it("모바일 drawer를 닫고 다시 열어도 메뉴 스크롤 위치를 복원한다", async () => {
    window.history.pushState(null, "", "/lessons/academy");
    const user = userEvent.setup();
    render(<AppShell academyName="더 클래식" permissionContext={{ role: "owner" }} />);

    await user.click(screen.getByRole("button", { name: "메뉴 열기" }));
    const scrollArea = screen.getByLabelText("모바일 메뉴 스크롤");
    scrollArea.scrollTop = 236;
    fireEvent.scroll(scrollArea);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "메뉴 열기" }));

    expect(screen.getByLabelText("모바일 메뉴 스크롤").scrollTop).toBe(236);
  });

  it("children 페이지는 상위 메뉴 제목과 하위 탭을 헤더에 표시한다", () => {
    window.history.pushState(null, "", "/management/teachers");

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "인원·거래처" }),
    ).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "인원·거래처 하위 메뉴" });
    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "원생",
      "선생님",
      "휴원/퇴원",
      "거래처",
      "상담",
    ]);
    expect(within(tabs).getByRole("link", { name: "선생님" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("교재 하위 탭은 /books의 하위 주소에서도 각자 현재 탭으로 표시한다(재고 탭만 선택되어 보이지 않는다)", () => {
    for (const [pathname, current] of [
      ["/books", "재고"],
      ["/books/shipments", "출고"],
      ["/books/paid", "결제 완료"],
    ] as const) {
      window.history.pushState(null, "", pathname);
      const { unmount } = render(
        <AppShell academyName="더 클래식" permissionContext={{ role: "owner" }} />,
      );

      const tabs = screen.getByRole("navigation", { name: "교재 하위 메뉴" });
      const currentTabs = within(tabs)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page")
        .map((link) => link.textContent);

      expect(currentTabs).toEqual([current]);
      unmount();
    }
  });

  it("header action slot에 등록된 페이지 액션만 보여준다", () => {
    window.history.pushState(null, "", "/passes");

    function HeaderActionProbe() {
      usePageHeaderActions(
        <button type="button">회차권 등록</button>,
      );

      return <p>회차권 목록</p>;
    }

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      >
        <HeaderActionProbe />
      </AppShell>,
    );

    expect(screen.getByRole("button", { name: "회차권 등록" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /수납 등록/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /출석 확인/ })).not.toBeInTheDocument();
  });

  it("md 이하에서는 페이지 액션을 작업 메뉴 안에 표시한다", async () => {
    const restoreMatchMedia = mockHeaderMediaQuery(true);
    window.history.pushState(null, "", "/passes");

    function HeaderActionProbe() {
      usePageHeaderActions(<button type="button">회차권 등록</button>);

      return <p>회차권 목록</p>;
    }

    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      >
        <HeaderActionProbe />
      </AppShell>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "작업 메뉴 열기" }),
    );

    const actionDrawer = screen.getByRole("dialog", { name: "페이지 작업" });
    expect(
      within(actionDrawer).getByRole("button", { name: "회차권 등록" }),
    ).toBeInTheDocument();

    restoreMatchMedia();
  });
});

function mockHeaderMediaQuery(matches: boolean) {
  const originalMatchMedia = window.matchMedia;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  return () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  };
}

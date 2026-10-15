import { expect, test } from "@playwright/test";

test("첫 화면에서 운영 대시보드와 주요 메뉴를 확인할 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "음악학원 관리" }),
  ).toBeVisible();
  await expect(page.getByText("현재 학원: 더 클래식")).toBeVisible();
  await expect(page.getByText("오늘 출석 확인")).toBeVisible();
  await expect(page.getByText("회차권 임박")).toBeVisible();
  await expect(page.getByText("미납 확인")).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });

  await expect(navigation.getByRole("link", { name: /레슨 시간표/ })).toHaveAttribute(
    "href",
    "/lessons/academy",
  );
  await expect(navigation.getByRole("link", { name: /회차권/ })).toHaveAttribute(
    "href",
    "/passes",
  );
});

test("원생 메뉴에서 원생 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "인원·거래처" })).toHaveAttribute(
    "href",
    "/management/students",
  );
  await page.getByRole("link", { name: "원생" }).click();
  await expect(page).toHaveURL(/\/management\/students$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "원생 검색" })).toBeVisible();
});

test("레슨 시간표 메뉴에서 개인레슨 등록 화면으로 이동할 수 있다", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-05T12:00:00+09:00"));
  await page.goto("/");

  await page.getByRole("link", { name: "레슨 시간표" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "레슨 시간표" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "레슨관리표" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("레슨 관리 날짜")).toHaveCount(0);
  const academyCalendar = page.getByRole("grid", {
    name: "2026년 9월 학원레슨 캘린더",
  });
  await expect(academyCalendar).toBeVisible();
  const todayCell = academyCalendar.getByRole("gridcell", { name: /5 오늘/ });
  await expect(todayCell).toHaveAttribute("aria-current", "date");
  await todayCell.click();
  const attendanceDialog = page.getByRole("dialog", { name: "2026-09-05 출석 확인" });
  await expect(attendanceDialog.getByRole("tab", { name: "출석관리" })).toBeVisible();
  await expect(
    attendanceDialog.getByRole("tab", { name: "메모 0" }),
  ).toBeVisible();
  await attendanceDialog.getByRole("tab", { name: "메모 0" }).click();
  await expect(attendanceDialog.getByLabel("메모 대상 유형")).toHaveCount(0);
  await expect(attendanceDialog.getByLabel("관련 원생")).toBeVisible();
  await expect(attendanceDialog.getByLabel("관련 선생님")).toBeVisible();
  await expect(attendanceDialog.getByLabel("메모 내용")).toBeVisible();
  await page.keyboard.press("Escape");

  await page
    .getByRole("navigation", { name: "레슨 시간표 하위 메뉴" })
    .getByRole("link", { name: "개인레슨표" })
    .click();
  await expect(page).toHaveURL(/\/lessons\/private$/);
  await expect(
    page.getByRole("grid", { name: "2026년 9월 개인레슨 캘린더" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "레슨원생 검색" }).click();
  const searchDialog = page.getByRole("dialog", { name: "레슨원생 검색" });
  await expect(searchDialog.getByText("한서아")).toBeVisible();
  await expect(searchDialog.getByText("바이올린 2회")).toBeVisible();
  await expect(searchDialog.getByText("김민지")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "개인레슨 등록" }).click();
  await expect(page.getByRole("dialog", { name: "개인레슨 등록" })).toBeVisible();
});

test("회차권 메뉴에서 회차권 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "회차권" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "회차권 관리" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "회차권 검색" })).toBeVisible();

  await page.getByRole("button", { name: "회차권 등록" }).click();
  await expect(page.getByRole("dialog", { name: "회차권 등록" })).toBeVisible();
});

test("선생님 메뉴에서 선생님 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "선생님", exact: true }).click();
  await expect(page).toHaveURL(/\/management\/teachers$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "선생님 검색" }),
  ).toBeVisible();
});

test("휴원/퇴원 메뉴에서 비활성 원생과 선생님을 관리할 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "휴원/퇴원" }).click();
  await expect(page).toHaveURL(/\/management\/status$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(page.getByText("박지호")).toBeVisible();

  await page.getByRole("button", { name: "박지호 재원 처리" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "상태 변경 확인" }),
  ).toBeVisible();
  await expect(page.getByLabel("상태 변경 메모")).toHaveCount(0);
  await page.getByRole("button", { name: "취소" }).click();

  await page.getByRole("tab", { name: "퇴원" }).click();
  await expect(page.getByText("유하린")).toBeVisible();
  await expect(page.getByText("2026-09-10")).toBeVisible();

  await page.getByRole("tab", { name: "선생님" }).click();
  await expect(page.getByText("문서준")).toBeVisible();
  await page.getByRole("tab", { name: "퇴사" }).click();
  await expect(page.getByText("정예린")).toBeVisible();
});

test("거래처 메뉴에서 거래처 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "거래처", exact: true }).click();
  await expect(page).toHaveURL(/\/management\/vendors$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "인원·거래처" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "거래처 검색" }),
  ).toBeVisible();
});

test("교재 메뉴에서 교재 구매 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "교재", exact: true }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "교재 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "교재 구매 검색" }),
  ).toBeVisible();
});

test("수입 관리 메뉴에서 입출금 내역 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "수입 관리" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "수입 관리" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/finance\/ledger/);
  await expect(
    page.getByRole("searchbox", { name: "입출금 내역 검색" }),
  ).toBeVisible();
});

test("좁은 화면에서도 레슨수입과 수납 액션을 가로 잘림 없이 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/finance/lesson-income");

  await expect(page.getByRole("heading", { level: 1, name: "수입 관리" })).toBeVisible();
  await expect(page.getByRole("button", { name: "작업 메뉴 열기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "김민지 수납 처리" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

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
    "/lessons",
  );
  await expect(navigation.getByRole("link", { name: /회차권/ })).toHaveAttribute(
    "href",
    "/passes",
  );
});

test("원생 메뉴에서 원생 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "원생" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "원생 관리" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "원생 검색" })).toBeVisible();
});

test("레슨 시간표 메뉴에서 개인레슨 등록 화면으로 이동할 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "레슨 시간표" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "레슨 시간표" }),
  ).toBeVisible();
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

  await page.getByRole("link", { name: "선생님" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "선생님 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "선생님 검색" }),
  ).toBeVisible();
});

test("거래처 메뉴에서 거래처 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "거래처" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "거래처 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "거래처 검색" }),
  ).toBeVisible();
});

test("교재 메뉴에서 교재 구매 목록 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "교재" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "교재 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "교재 구매 검색" }),
  ).toBeVisible();
});

test("수입 메뉴에서 입출입 내역 화면으로 이동할 수 있다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "수입" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "수입 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "입출입 내역 검색" }),
  ).toBeVisible();
});

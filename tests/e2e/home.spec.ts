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

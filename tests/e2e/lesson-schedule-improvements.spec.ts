import { expect, test } from "@playwright/test";

test("개인레슨 달력에서 설정을 분리하고 데스크톱 설정 메뉴에서 연다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  const calendar = page.getByRole("grid", { name: /개인레슨 캘린더/ });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("예정", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: "시간표 설정" })).toHaveCount(0);
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await navigation.getByRole("button", { name: "설정 하위 메뉴 펼치기" }).click();
  await navigation.getByRole("link", { name: "레슨시간표" }).click();
  const settings = page.getByRole("region", { name: "레슨시간표 설정" });
  await expect(settings.getByRole("button", { name: /기본 색/ })).toHaveCount(8);
  await expect(settings.getByLabel("직접 색상 선택")).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "기본 색 2" })).toHaveCSS("background-color", "rgb(207, 222, 238)");
  await expect(settings.getByLabel("휴원 종류")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("private-calendar-settings-desktop.png") });
});

test("개인레슨 출석 카드와 모바일 일별 표의 악기 태그는 밝은·어두운 테마에서 진한 글자를 유지한다", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  await page.getByRole("gridcell", { name: /2026-08-21/ }).click();
  const dialog = page.getByRole("dialog", { name: /개인레슨 출석 확인/ });
  const card = dialog.locator("div.grid.rounded-md").filter({ hasText: "한서아" }).first();
  const detail = card.getByText(/바이올린 · 오유진/);
  const cardColor = await card.evaluate((element) => getComputedStyle(element).color);
  await expect(detail).toHaveCSS("color", cardColor);
  await expect(card).toHaveCSS("background-color", /rgb\(2[0-5][0-9], 2[0-5][0-9], 2[0-5][0-9]\)/);
  await page.screenshot({ path: testInfo.outputPath("private-attendance-light-desktop.png") });

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(detail).toHaveCSS("color", cardColor);
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("private-attendance-dark-desktop.png") });

  await dialog.getByRole("button", { name: "닫기" }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole("tab", { name: /개인레슨 일별 테이블뷰/ }).click();
  const row = page.getByRole("row", { name: /한서아/ });
  const instrumentTag = row.getByText("바이올린", { exact: true });
  const studentName = row.locator('td[data-label="원생"]').getByText("한서아", { exact: true });
  await expect(row).not.toHaveAttribute("data-instrument-color", "");
  await expect(instrumentTag).toHaveCSS("background-color", /rgb\(/);
  await expect(instrumentTag).toHaveCSS("color", cardColor);
  await expect(studentName).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await instrumentTag.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(await row.evaluate((element) => getComputedStyle(element).backgroundColor));
  await page.screenshot({ path: testInfo.outputPath("private-table-dark-mobile.png") });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await expect(instrumentTag).toHaveCSS("background-color", /rgb\(/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("private-table-light-mobile.png") });
});

test("모바일 설정 메뉴에서도 악기별 색상과 휴원일을 설정할 수 있다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  await expect(page.getByRole("button", { name: "시간표 설정" })).toHaveCount(0);
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  const navigation = page.getByRole("dialog", { name: "주요 메뉴" }).getByRole("navigation", { name: "모바일 주요 메뉴" });
  await navigation.getByRole("button", { name: "설정 하위 메뉴 펼치기" }).click();
  await navigation.getByRole("link", { name: "레슨시간표" }).click();
  const settings = page.getByRole("region", { name: "레슨시간표 설정" });
  await expect(settings.getByRole("button", { name: "기본 색 8" })).toBeVisible();
  await settings.getByLabel("휴원 종류").selectOption("weekly");
  await expect(settings.getByLabel("반복 요일")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("private-calendar-settings-mobile.png") });
});

test("회차권 등록은 악기를 선택한 뒤 원생을 고른다", async ({ page }) => {
  await page.goto("/passes");
  await page.getByRole("button", { name: "회차권 등록" }).click();
  const dialog = page.getByRole("dialog", { name: "회차권 등록" });
  await expect(dialog.getByLabel("원생")).toBeDisabled();
  await dialog.getByLabel("악기").selectOption("violin");
  await expect(dialog.getByRole("option", { name: "한서아" })).toBeAttached();
});

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
  await settings.getByRole("button", { name: "바이올린 색상" }).click();
  await expect(page.getByRole("button", { name: /바이올린 기본 색/ })).toHaveCount(8);
  await expect(settings.getByLabel("직접 색상 선택")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "바이올린 기본 색 2" })).toHaveCSS("background-color", "rgb(207, 222, 238)");
  await page.keyboard.press("Escape");
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
  await settings.getByRole("button", { name: "바이올린 색상" }).click();
  await expect(page.getByRole("button", { name: "바이올린 기본 색 8" })).toBeVisible();
  await page.keyboard.press("Escape");
  await settings.getByLabel("휴원 종류").selectOption("weekly");
  await expect(settings.getByLabel("반복 요일")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("private-calendar-settings-mobile.png") });
});

test("데모에서 악기 색상을 저장하고 시간표로 이동해도 유지한다", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/settings/lesson-schedule");
  await page.getByRole("button", { name: "바이올린 색상" }).click();
  await page.getByRole("button", { name: "바이올린 기본 색 4" }).click();
  await expect(page.getByRole("button", { name: "바이올린 색상" })).toContainText("기본 색 4");
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await navigation.getByRole("button", { name: "레슨 시간표 하위 메뉴 펼치기" }).click();
  await navigation.getByRole("link", { name: "개인레슨" }).click();
  const calendar = page.getByRole("grid", { name: /개인레슨 캘린더/ });
  await expect(calendar.getByText(/한서아 \(바이올린\)/).first().locator(".." )).toHaveCSS("background-color", "rgb(220, 228, 208)");
});

test("모바일 개인레슨 악기 필터가 달력과 출석창에 적용된다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.clock.setFixedTime(new Date("2026-08-21T12:00:00+09:00"));
  await page.goto("/lessons/private");
  await page.getByRole("button", { name: /악기 필터/ }).click();
  await page.getByRole("checkbox", { name: "바이올린" }).click();
  await page.keyboard.press("Escape");
  const calendar = page.getByRole("grid", { name: /개인레슨 캘린더/ });
  await expect(calendar.getByText(/한서아 \(바이올린\)/)).toBeAttached();
  await expect(calendar.getByText(/최도윤 \(첼로\)/)).toHaveCount(0);
  await calendar.getByRole("gridcell", { name: /2026-08-21/ }).click();
  const dialog = page.getByRole("dialog", { name: /개인레슨 출석 확인/ });
  await expect(dialog.getByText("한서아", { exact: true })).toBeVisible();
  await expect(dialog.getByText("최도윤", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("회차권 등록은 악기를 선택한 뒤 원생을 고른다", async ({ page }) => {
  await page.goto("/passes");
  await page.getByRole("button", { name: "회차권 등록" }).click();
  const dialog = page.getByRole("dialog", { name: "회차권 등록" });
  await expect(dialog.getByLabel("원생")).toBeDisabled();
  await dialog.getByLabel("악기").selectOption("violin");
  await expect(dialog.getByRole("option", { name: "한서아" })).toBeAttached();
});

test("회차권 상태를 탭으로 전환한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/passes");
  await expect(page.getByRole("tab", { name: "사용중" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("사용중 상세 필터")).toBeVisible();
  await page.getByRole("tab", { name: "사용완료" }).click();
  await expect(page.getByLabel("사용중 상세 필터")).toHaveCount(0);
  await page.getByRole("tab", { name: "사용취소" }).click();
  await expect(page.getByText("사용취소 이력이 없습니다.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("같은 원생의 새 구매는 기존 회차권과 별도 행으로 보인다", async ({ page }) => {
  await page.goto("/passes");
  await page.getByRole("button", { name: "회차권 등록" }).click();
  const dialog = page.getByRole("dialog", { name: "회차권 등록" });
  await dialog.getByLabel("악기").selectOption("violin");
  await dialog.getByLabel("원생").selectOption("student-4");
  await dialog.getByLabel("부여 회수").fill("4");
  await dialog.getByLabel("결제 금액").fill("160000");
  await dialog.getByRole("textbox", { name: "등록일" }).fill("2026-08-21");
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect(page.getByRole("row", { name: /한서아/ })).toHaveCount(2);
  await expect(page.getByRole("row", { name: /한서아/ }).filter({ hasText: "4회" })).toHaveCount(1);
});

test("320px 개인레슨 등록에서 원생별 횟수 선택지가 화면 밖으로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/lessons/private");
  await page.getByRole("button", { name: "작업 메뉴 열기" }).click();
  await page.getByRole("dialog", { name: "페이지 작업" })
    .getByRole("button", { name: "개인레슨 등록" }).click();
  const dialog = page.getByRole("dialog", { name: "레슨 일정 등록" });
  await dialog.getByRole("combobox", { name: "악기" }).selectOption("violin");
  const studentSelect = dialog.getByRole("combobox", { name: "원생" });
  await expect(studentSelect.getByRole("option", { name: /예약 가능 \d+회 · 실제 잔여 \d+회/ }).first()).toBeAttached();
  const box = await studentSelect.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
});

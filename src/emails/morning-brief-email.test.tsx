import { describe, expect, it } from "vitest";

import type { MorningBrief } from "@/domain/morning-brief";

import { renderMorningBriefEmail } from "./morning-brief-email";

const brief: MorningBrief = {
  subject: "[더 클래식] 11월 19일(목) 레슨 2건 · 할 일 1건",
  dateLabel: "11월 19일(목)",
  summary: [
    { label: "오늘 레슨", value: 2 },
    { label: "보강", value: 1 },
    { label: "할 일", value: 1 },
    { label: "답변 대기", value: 0 },
  ],
  closures: ["정기 휴원"],
  schedule: [
    {
      teacherName: "김선생",
      lessons: [
        { time: "14:00", studentName: "단율", instrumentName: "피아노", tag: null },
        { time: "15:00", studentName: "유나", instrumentName: "바이올린", tag: "보강" },
      ],
    },
  ],
  taskSections: [
    {
      title: "수납 확인",
      items: [{ title: "단율 피아노 11월 수강료 입금 확인", detail: "납입일 11/10 지남 · 150,000원", href: "/finance/lesson-income" }],
    },
  ],
  memoNotice: "읽지 않은 레슨 메모 1건이 있습니다.",
};

describe("renderMorningBriefEmail", () => {
  it("요약·휴원·선생님별 시간표·할 일을 담고 링크는 앱 절대 주소로 만든다", async () => {
    const { html, text } = await renderMorningBriefEmail(brief, "https://madimadi.example");

    expect(html).toContain("11월 19일(목)");
    expect(html).toContain("정기 휴원");
    expect(html).toContain("김선생");
    expect(html).toContain("유나");
    expect(html).toContain("보강");
    expect(html).toContain("150,000원");
    expect(html).toContain('href="https://madimadi.example/finance/lesson-income"');
    expect(html).toContain('href="https://madimadi.example/"');
    expect(html).toContain('href="https://madimadi.example/me/notifications"');
    expect(text).toContain("단율 피아노 11월 수강료 입금 확인");
    expect(text).toContain("읽지 않은 레슨 메모 1건이 있습니다.");
  });

  it("레슨과 할 일이 없는 날도 비어 있다고 알려 준다", async () => {
    const { text } = await renderMorningBriefEmail(
      { ...brief, closures: [], schedule: [], taskSections: [], memoNotice: null },
      "https://madimadi.example",
    );

    expect(text).toContain("오늘 예정된 레슨이 없습니다.");
    expect(text).toContain("오늘 챙길 일이 없습니다.");
  });
});

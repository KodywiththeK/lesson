import { describe, expect, it } from "vitest";

import { buildConsultationList, type ConsultationListRow } from "./consultation-list";

function consultation(overrides: Partial<ConsultationListRow>): ConsultationListRow {
  return {
    academyId: "academy-1",
    consultationId: "consultation-1",
    name: "김하늘",
    age: 9,
    instrumentNames: ["피아노"],
    phone: "010-1111-2222",
    school: "새봄초",
    memo: "",
    receivedAt: "2026-10-10T01:00:00.000Z",
    ...overrides,
  };
}

const consultations: ConsultationListRow[] = [
  consultation({
    consultationId: "consultation-1",
    name: "김하늘",
    instrumentNames: ["피아노"],
    receivedAt: "2026-10-01T01:00:00.000Z",
  }),
  consultation({
    consultationId: "consultation-2",
    name: "박서준",
    school: "한빛중",
    phone: "010-3333-4444",
    instrumentNames: ["바이올린", "첼로"],
    memo: "체험 수업 희망",
    receivedAt: "2026-10-12T01:00:00.000Z",
  }),
  consultation({
    consultationId: "consultation-3",
    name: "다른학원",
    academyId: "academy-2",
    receivedAt: "2026-10-13T01:00:00.000Z",
  }),
];

describe("buildConsultationList", () => {
  it("같은 학원의 상담만 접수일 최신순으로 보여 준다", () => {
    const view = buildConsultationList(consultations, { academyId: "academy-1" });

    expect(view.items.map((item) => item.name)).toEqual(["박서준", "김하늘"]);
    expect(view.totalItems).toBe(2);
  });

  it("접수 시각이 같으면 id 순서로 고정해 페이지 경계에서 중복·누락이 없다", () => {
    const sameTime = Array.from({ length: 12 }, (_, index) =>
      consultation({
        consultationId: `consultation-${String(12 - index).padStart(2, "0")}`,
        name: `상담${index}`,
        receivedAt: "2026-10-10T01:00:00.000Z",
      }),
    );

    const firstPage = buildConsultationList(sameTime, { academyId: "academy-1", page: 1, pageSize: 10 });
    const secondPage = buildConsultationList(sameTime, { academyId: "academy-1", page: 2, pageSize: 10 });

    expect(firstPage.items.map((item) => item.consultationId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `consultation-${String(index + 1).padStart(2, "0")}`),
    );
    expect(secondPage.items.map((item) => item.consultationId)).toEqual([
      "consultation-11",
      "consultation-12",
    ]);
  });

  it.each([
    ["이름", "서준"],
    ["학교", "한빛"],
    ["전화번호", "3333"],
    ["악기", "첼로"],
    ["특이사항", "체험"],
  ])("%s로 검색할 수 있다", (_field, search) => {
    const view = buildConsultationList(consultations, { academyId: "academy-1", search });

    expect(view.items.map((item) => item.name)).toEqual(["박서준"]);
  });

  it("검색어 앞뒤 공백과 영문 대소문자는 무시한다", () => {
    const view = buildConsultationList(
      [consultation({ name: "Amy Kim" })],
      { academyId: "academy-1", search: "  amy " },
    );

    expect(view.totalItems).toBe(1);
  });

  it("악기 필터는 선택한 악기를 포함한 상담만 남긴다", () => {
    const view = buildConsultationList(consultations, {
      academyId: "academy-1",
      filters: { instrumentName: "바이올린" },
    });

    expect(view.items.map((item) => item.name)).toEqual(["박서준"]);
  });

  it("요청한 페이지와 페이지 크기만큼만 보여 주고 총 건수를 함께 준다", () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      consultation({
        consultationId: `consultation-${String(index + 1).padStart(2, "0")}`,
        name: `상담${index + 1}`,
        receivedAt: `2026-09-${String(index + 1).padStart(2, "0")}T01:00:00.000Z`,
      }),
    );

    const view = buildConsultationList(many, { academyId: "academy-1", page: 3, pageSize: 10 });

    expect(view.items.map((item) => item.name)).toEqual([
      "상담5",
      "상담4",
      "상담3",
      "상담2",
      "상담1",
    ]);
    expect(view).toMatchObject({ page: 3, pageSize: 10, totalItems: 25, totalPages: 3 });
  });
});

import { describe, expect, it, vi } from "vitest";

import { fetchAllRows } from "./paged-query";

describe("fetchAllRows", () => {
  it("1000건을 넘는 응답을 range로 끝까지 읽어 이어 붙인다", async () => {
    const rows = Array.from({ length: 1200 }, (_, index) => ({ id: index }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));

    await expect(fetchAllRows("목록을 불러오지 못했습니다", fetchPage)).resolves.toHaveLength(1200);
    expect(fetchPage.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("조회 오류는 실패 문구와 원인을 함께 담은 오류로 바꾼다", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(fetchAllRows("목록을 불러오지 못했습니다", fetchPage)).rejects.toThrow(
      "목록을 불러오지 못했습니다: permission denied",
    );
  });
});

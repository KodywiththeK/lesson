import { describe, expect, it, vi } from "vitest";

import { fetchAllPages, MAX_FETCH_PAGES } from "./fetch-all-pages";

function pageOf(start: number, size: number) {
  return Array.from({ length: size }, (_, index) => ({ id: start + index }));
}

describe("fetchAllPages", () => {
  it("한 페이지보다 적으면 한 번만 읽는다", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: pageOf(0, 3), error: null });

    await expect(fetchAllPages(fetchPage, 1000)).resolves.toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage).toHaveBeenCalledWith(0, 999);
  });

  it("정확히 한 페이지 크기이면 다음 페이지까지 읽어 끝을 확인한다(1000행 경계)", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: pageOf(0, 1000), error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toHaveLength(1000);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("여러 페이지를 이어 붙인다", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: pageOf(0, 1000), error: null })
      .mockResolvedValueOnce({ data: pageOf(1000, 1000), error: null })
      .mockResolvedValueOnce({ data: pageOf(2000, 5), error: null });

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toHaveLength(2005);
    expect(rows.at(-1)).toEqual({ id: 2004 });
  });

  it("data가 null이면 빈 목록으로 본다", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: null });

    await expect(fetchAllPages(fetchPage, 1000)).resolves.toEqual([]);
  });

  it("조회 오류는 그대로 던진다", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: new Error("permission denied") });

    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow("permission denied");
  });

  it("비정상적으로 많으면 조용히 자르지 않고 한국어 오류로 알린다", async () => {
    const fetchPage = vi.fn().mockImplementation(async (from: number) => ({
      data: pageOf(from, 2),
      error: null,
    }));

    await expect(fetchAllPages(fetchPage, 2)).rejects.toThrow(
      "데이터가 너무 많아 모두 불러오지 못했습니다. 조회 기간을 좁혀 주세요.",
    );
    expect(fetchPage).toHaveBeenCalledTimes(MAX_FETCH_PAGES);
  });
});

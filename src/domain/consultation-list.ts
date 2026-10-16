import { compareKoreanNames, paginateItems, type ListView, type PageSizeOption } from "./common-list";
import type { ConsultationProfile } from "./consultation";

export type ConsultationListRow = ConsultationProfile & {
  academyId: string;
  consultationId: string;
  /** 접수 시각(ISO 8601). 서버가 생성 시각으로 정한다. */
  receivedAt: string;
};

export type ConsultationListFilters = {
  instrumentName?: string;
};

export type BuildConsultationListOptions = {
  academyId: string;
  search?: string;
  filters?: ConsultationListFilters;
  page?: number;
  pageSize?: PageSizeOption;
};

/** 접수일 최신순으로 정렬한다. 같은 시각이면 id로 순서를 고정해 페이지 경계의 중복·누락을 막는다. */
export function buildConsultationList(
  consultations: ConsultationListRow[],
  options: BuildConsultationListOptions,
): ListView<ConsultationListRow> {
  const matchedConsultations = consultations
    .filter((consultation) => consultation.academyId === options.academyId)
    .filter((consultation) => matchesInstrument(consultation, options.filters))
    .filter((consultation) => matchesSearch(consultation, options.search))
    .sort(compareNewestFirst);

  return paginateItems(matchedConsultations, { page: options.page, pageSize: options.pageSize });
}

function compareNewestFirst(left: ConsultationListRow, right: ConsultationListRow) {
  return (
    Date.parse(right.receivedAt) - Date.parse(left.receivedAt) ||
    compareKoreanNames(left.consultationId, right.consultationId)
  );
}

function matchesInstrument(
  consultation: ConsultationListRow,
  filters: ConsultationListFilters | undefined,
) {
  return !filters?.instrumentName || consultation.instrumentNames.includes(filters.instrumentName);
}

function matchesSearch(consultation: ConsultationListRow, search: string | undefined) {
  const keyword = search?.trim().toLocaleLowerCase("ko-KR");

  if (!keyword) {
    return true;
  }

  return [
    consultation.name,
    consultation.school,
    consultation.phone,
    consultation.instrumentNames.join(" "),
    consultation.memo,
  ].some((text) => text.toLocaleLowerCase("ko-KR").includes(keyword));
}

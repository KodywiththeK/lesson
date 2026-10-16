import type { LedgerEntry } from "@/domain/book-sale";
import { buildFinanceLedgerCsvFileName, exportFinanceLedgerCsv } from "@/domain/finance-ledger";

/** 엑셀이 한글 CSV를 UTF-8로 알아보도록 파일 맨 앞에 붙이는 BOM. */
const UTF8_BOM = "﻿";
const REVOKE_URL_DELAY_MS = 1000;

export function downloadFinanceCsv(entries: LedgerEntry[], range: { from: string; to: string }) {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([UTF8_BOM, exportFinanceLedgerCsv(entries)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildFinanceLedgerCsvFileName(range);
  anchor.click();
  // 다운로드가 시작될 시간을 준 뒤 해제한다.
  setTimeout(() => {
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }, REVOKE_URL_DELAY_MS);
}

# PDF 수집

원본 PDF는 텍스트와 이미지를 함께 포함한다. 텍스트 추출만으로는 충분하지 않으므로 PDF 요구사항이 업데이트되거나 다시 읽어야 할 때 이 절차를 따른다.

## 도구

필수 도구:

- Poppler: `pdfinfo`, `pdftotext`, `pdftoppm`
- Python: `pdfplumber`
- OCR fallback: `tesseract` 또는 `ocrmypdf`

macOS 선택 fallback:

- Python PDF library를 사용할 수 없을 때 Swift PDFKit으로 텍스트를 추출할 수 있다.

## 절차

1. PDF를 임시 작업 디렉터리로 복사한다.
2. `pdfinfo`로 페이지 수와 메타데이터를 기록한다.
3. `pdftotext -layout`으로 레이아웃 보존 텍스트를 추출한다.
4. `pdfplumber`로 텍스트와 표 성격 내용을 교차 확인한다.
5. `pdftoppm -png`로 모든 페이지를 렌더링한다.
6. 렌더 페이지에서 이미지, UI 예시, 표, 텍스트 추출 누락 가능성을 확인한다.
7. 이미지에만 포함된 텍스트 또는 추출 텍스트가 비정상적으로 적은 페이지는 OCR을 실행한다.
8. 다음 산출물을 만든다.
   - `pdf-text.md`
   - `pdf-image-notes.md`
   - `pdf-ingestion-report.md`
9. `docs/product/functional-spec.md`, `docs/product/open-questions.md`, `docs/product/traceability-matrix.md`를 갱신한다.

## 정확도 확인

- ingestion report의 페이지 수가 렌더 이미지 수와 일치한다.
- 텍스트가 0인 페이지는 이미지/OCR 노트를 가진다.
- 확인 필요 항목은 모두 `open-questions.md`에 복사한다.
- 이미지 기반 UI 세부사항은 `pdf-image-notes.md`에 요약한다.

## 현재 원본

초기 원본은 첨부 파일 `학원관리앱 기획안 및 기능명세서.pdf`다. 사용자가 명시적으로 요청하지 않는 한 원본 PDF는 커밋하지 않는다.

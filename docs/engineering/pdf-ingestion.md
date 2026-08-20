# PDF Ingestion

The source PDF contains text and images. Text extraction alone is not sufficient. Use this workflow whenever PDF requirements are updated or re-read.

## Tools

Required target tooling:

- Poppler: `pdfinfo`, `pdftotext`, `pdftoppm`
- Python: `pdfplumber`
- OCR fallback: `tesseract` or `ocrmypdf`

Optional macOS fallback:

- PDFKit via Swift can extract text when Python PDF libraries are unavailable.

## Workflow

1. Copy the PDF to a temporary work directory.
2. Run `pdfinfo` to capture page count and metadata.
3. Run `pdftotext -layout` for layout-preserving text.
4. Run `pdfplumber` to cross-check text and table-like content.
5. Render every page with `pdftoppm -png`.
6. Inspect rendered pages for images, UI examples, tables, or visual requirements that text extraction may miss.
7. Run OCR on pages with text embedded in images or pages with suspiciously low extracted text.
8. Create:
   - `pdf-text.md`
   - `pdf-image-notes.md`
   - `pdf-ingestion-report.md`
9. Update `docs/product/functional-spec.md`, `docs/product/open-questions.md`, and `docs/product/traceability-matrix.md`.

## Accuracy Checks

- Page count in report matches rendered image count.
- No page has zero text without an image/OCR note.
- Every "needs confirmation" item is copied to `open-questions.md`.
- Image-only UI details are summarized in `pdf-image-notes.md`.

## Current Source

The initial source is the attached file named `학원관리앱 기획안 및 기능명세서.pdf`. Do not commit the original PDF unless explicitly requested.


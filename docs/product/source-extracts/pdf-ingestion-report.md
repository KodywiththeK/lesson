# PDF 수집 리포트

## 원본

- 파일명: `학원관리앱 기획안 및 기능명세서.pdf`
- 위치: `/Users/kody/Downloads/학원관리앱 기획안 및 기능명세서.pdf`
- 제목 메타데이터: `학원관리앱 - Google Docs`
- 생성 도구: Google Docs / Chrome / Skia PDF
- 생성일: 2026-08-20 20:36:23 KST
- 페이지: 21
- 크기: 1,570,236 bytes
- 페이지 크기: A4
- 암호화: 없음

## 사용한 도구

- `pdfinfo`: 성공
- `pdftotext -layout`: 성공, 939줄 추출
- `pdfplumber`: 성공, 21페이지 추출
- `pdftoppm -png`: 성공, 21페이지 렌더링
- `tesseract`: 설치됨
- `ocrmypdf`: 설치되지 않음

## 확인 결과

- PDF는 텍스트 레이어가 포함된 문서라 OCR 없이도 주요 본문 요구사항을 읽을 수 있었다.
- 모든 페이지를 PNG로 렌더링해 확인했다.
- 문서 안의 이미지는 주로 예시 화면, 폼 배치, 버튼/테이블 UI 참고 이미지다.
- PDF 본문에 "사용된 이미지는 예시 사진이므로 필수적인 요소가 아님"이라고 명시되어 있어 이미지를 필수 자산으로 취급하지 않는다.
- 다만 교재 관리, 수입 관리, 학생/선생님 등록 예시는 향후 shadcn 기반 UI 흐름 설계 참고로 사용한다.

## 산출물 위치

- 임시 분석 디렉터리: `/tmp/mingyu_pdf_ingest_full`
- 렌더 이미지: `/tmp/mingyu_pdf_ingest_full/rendered-pages`
- 접촉시트: `/tmp/mingyu_pdf_ingest_full/contact-1.jpg` ~ `contact-4.jpg`


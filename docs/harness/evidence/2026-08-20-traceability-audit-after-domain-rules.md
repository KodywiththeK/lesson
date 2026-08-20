# 2026-08-20 도메인 규칙 구현 후 추적성 감사

## 목표

PDF 핵심 도메인 규칙 구현 후, `docs/product/functional-spec.md` 전체와 `docs/product/traceability-matrix.md`를 대조해 누락된 요구사항을 다시 추적표에 올린다.

## 확인 결과

- 기존 추적표는 출석, 회차권, 일정, 원생 상태, 교재, 수강료, 급여 같은 핵심 도메인 규칙을 잘 따라가고 있었다.
- 다만 PDF의 전체 제품 완성 기준에는 UI, 권한, 목록, 메모, 검색, 그래프, Supabase RLS, shadcn 운영 화면 구현이 더 필요하다.
- 따라서 구현 완료로 볼 수 없으며, 목표는 계속 active 상태로 둔다.

## 보강한 추적 항목

- 역할별 로그인과 권한
- 공통 목록 동작과 검색/필터
- 학원 피아노 레슨표 UI 세부 동작
- 월별 메모
- 개인레슨 등록 UI와 검색 결과 표시
- 회차권 수동 수정 권한
- 원생/선생님/거래처 등록 및 목록
- 교재 판매 UI 세부 항목
- 수동 입출입 내역
- 전체 수입 그래프
- 월급제/시급제 급여
- Supabase tenant RLS
- shadcn 기반 운영 UI

## 검증 결과

| 확인 | 결과 | 비고 |
| --- | --- | --- |
| `git status --short --branch` | 깨끗한 상태에서 시작 | 감사 전 작업트리 변경 없음 |
| `docs/product/functional-spec.md` 대조 | 완료 | 명세 섹션별 추적 누락 확인 |
| `docs/product/traceability-matrix.md` 보강 | 완료 | 누락 항목을 `미작성`/`미구현`으로 재등록 |

## 다음 구현 순서

1. Supabase tenant/RLS 기반 스키마와 권한 테스트 계획
2. 역할별 인증/권한 도메인과 RLS migration
3. shadcn 운영 UI shell 확장
4. 목록/검색/필터 공통 패턴
5. 일정/출석/메모 UI
6. 원생/선생님/거래처/교재/수입 화면

## 남은 리스크

- 실제 Supabase project 연결 여부와 로컬/원격 migration 적용 방식은 확인이 필요하다.
- 주민등록번호 저장, 급여 수정/취소, 퇴원 삭제 방식 같은 민감 정책은 아직 open question에 남아 있다.

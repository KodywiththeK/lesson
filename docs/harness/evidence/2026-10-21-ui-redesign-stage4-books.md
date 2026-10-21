# UI 디자인 시스템 정비 4단계-2: 교재(books) 영역 적용

## 요약

- 목표: 교재 재고·출고·결제 완료·발주·입고 화면에 공용 컴포넌트를 적용하고 반복되던 표·카드·제목 클래스를 걷어 낸다. 로직은 건드리지 않는 스타일 전용 작업이다.
- 이전: [4단계-1 수입](./2026-10-21-ui-redesign-stage4-finance.md). 다음 영역은 원생·선생님·휴원퇴원·거래처·상담이다.

## 변경 내용 (`src/features/books/`)

- 표 3개(`book-stock-table`, `book-shipment-table`, `book-paid-table`): `TableHeader`의 `bg-muted text-muted-foreground`와 `TableHead`·`TableCell`의 `px-4 py-3`을 지웠다(`ui/table.tsx` 기본값과 동일, 42곳). 빈 목록 문구는 `EmptyState`로 바꿨다.
- 재고 화면(`book-stock-screen`): 화면 제목과 등록 버튼 영역을 `SectionHeader`(액션 슬롯에 `PageHeaderActionFallback`)로, 표 카드를 `SectionCard padded={false}`로, 카드 안 "교재 재고 상태" 제목을 `SectionHeader`로 바꿨다. 로딩 문구는 `EmptyState`다.
- 출고 화면(`book-shipment-screen`): "도서 구매 목록" 구획을 `SectionCard role="region" aria-labelledby`로, "출고목록" 제목을 `SectionHeader`(`headingId`)로, 표 카드를 `SectionCard`로 바꿨다. 검색 영역의 아래 테두리가 `sm:max-w-md`에 걸려 일부만 그어지던 기존 문제는 안쪽 상자로 폭 제한을 옮겨 해결했다.
- 결제 완료 화면(`book-paid-screen`): 제목·설명을 `SectionHeader`(`headingId`)로, 카드를 `SectionCard`로 바꿨다.
- 발주·입고 화면(`book-order-screen`): 카드 없이 바탕에 놓여 있던 발주 표와 빈 안내를 `SectionCard padded={false}`로 감쌌다. 빈 문구는 `EmptyState`다.

## 바꾸지 않은 것

- 상태 판정, 권한(`canRecordPayment`, `canCancelPayment`, `canPay`), 폼·다이얼로그 코드, 쿼리와 mutation은 수정하지 않았다.
- 다이얼로그 안의 안내 문구(`text-sm text-muted-foreground`, `aria-describedby`로 연결된 비활성 사유)는 접근성 연결이 있어 그대로 두었다.
- `book-order-screen`의 조회 전용 안내와 로딩 `<p>`는 한 줄 텍스트라 유지했다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. `docs/product/book-management-spec.md`의 재고·출고·결제 완료·발주 흐름과 `design-system.md`의 표 반응형 기준을 그대로 지켰다.

## 먼저 작성한 테스트

새 동작이 없는 스타일 전용 변경이라 새 실패 테스트는 없다. 기존 교재 테스트(`src/features/books`, `src/app/books`의 10개 파일·117개 테스트)와 e2e의 교재 시나리오(재고·출고·결제 완료 탭 이동, 320px 쉼표 금액 입력, 데모 발주 빈 목록)를 안전망으로 썼고 수정 없이 통과했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 162개 파일·1,891개 테스트 통과 | 수입 영역 이후 개수 변동 없음 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함 |
| 가로 넘침 | 0px | 1280(재고·출고·결제 완료·발주 입고), 390(출고·결제 완료) |

## 브라우저 증거

- 데모 production build로 촬영해 직접 확인한 화면: 1280px 재고·출고·발주 입고(수정 전후), 390px 결제 완료.
- 확인한 것: 제목·설명과 카드 간격, 표 헤더 배경, 출고 검색 영역의 전체 폭 테두리(수정 후), 발주 빈 안내가 카드 안에 들어간 모습, 모바일 결제 완료 카드.
- 스크린샷에서 발견해 고친 문제: 출고 검색 아래 테두리가 일부 폭만 그어짐, 발주 화면이 카드 없이 바탕에 놓임. 결제 완료 1280px와 출고 390px는 촬영만 하고 직접 확인하지 않았다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 교재 화면 파일에서 `rounded-lg border border-border bg-card`와 제목 `<div><h2/><p/></div>` 반복이 사라지고 `SectionCard`·`SectionHeader`로 읽힌다.
- 예측 가능성: 구획 제목은 h2 `text-lg`로 통일됐고, 구획 이름(`aria-labelledby`)과 표 이름(`aria-label`)은 이전과 같다.
- 응집도: 표 모양은 `ui/table.tsx`, 카드 모양은 `SectionCard`, 빈 안내는 `EmptyState`가 각각 한 곳에서 정한다.
- 결합도: 화면은 공용 부품의 props만 쓰고 서로의 클래스를 모른다. 표의 `data-label`·`data-responsive-table` 계약은 그대로다.
- simplify 결과: 변경된 파일을 다시 읽어 `SectionCard` 안으로 들어간 발주 표의 들여쓰기를 정리했고, 한 줄 텍스트와 접근성 연결이 있는 안내는 억지로 바꾸지 않았다.
- Warning(남김): `EmptyState`의 가운데 정렬·넓은 여백이 재고·출고 표의 빈 상태에서 이전 한 줄보다 세로 공간을 더 쓴다. 실제 빈 화면에서 과해 보이면 여백을 줄인다.

## 남은 위험 또는 미확정 질문

- 원생·선생님·휴원퇴원·거래처·상담, 회차권·출석·개인레슨, 레슨 워크스페이스는 아직 이전 스타일이다.

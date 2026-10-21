# UI 디자인 시스템 정비 4단계-4: 회차권·출석·개인레슨 영역

## 요약

- 목표: 회차권 목록에 공용 부품을 적용하고 반복 클래스를 걷어 낸다. 로직은 건드리지 않는 스타일 전용 작업이다.
- 이전: [4단계-3 인원](./2026-10-21-ui-redesign-stage4-people.md). 다음은 마지막 영역인 레슨 워크스페이스다.
- 범위 확인: 학원레슨 출석 화면(`academy-lessons/academy-lesson-attendance-screen.tsx`)은 실제 화면에서 쓰이지 않고 테스트에서만 렌더된다. 개인레슨 등록 화면(`private-lessons/private-lesson-registration-screen.tsx`)은 레슨 워크스페이스에서 `button`·`dialog` 모드로만 쓰여 `text-2xl` 제목(`section` 모드)이 화면에 나타나지 않는다. 그래서 두 화면은 바꾸지 않고, 쓰이는 다이얼로그 스타일은 1단계 ui 부품 변경으로 이미 반영됐다.

## 변경 내용 (`src/features/lesson-tickets/lesson-ticket-list-screen.tsx`)

- 표 카드 래퍼를 `SectionCard padded={false}`로 바꿨다(닫는 태그 위치를 코드로 확인).
- 표 중복 클래스(`TableHeader`의 `bg-muted text-muted-foreground`, `px-4 py-3`) 21곳을 지웠다. "잔여" 칸의 조건부 클래스는 `"px-4 py-3 font-semibold text-destructive"`에서 기본값을 빼 `needsAttention ? "font-semibold text-destructive" : undefined`로 줄였다. 조건 판단 자체는 그대로다.
- 빈 목록·로딩 문구 2곳을 `EmptyState`로 바꿨다.

## 바꾸지 않은 것

- 회차권 등록 폼(`lesson-ticket-registration-form.tsx`)·조정 다이얼로그(`lesson-ticket-adjust-dialog.tsx`)는 안쪽 구성이라 그대로 두었다. 다이얼로그 껍데기는 1단계에서 이미 바뀌었다.
- 회차권 상태 판정, 남은 일수 계산, 만료 임박 강조 조건, 입력 파서는 수정하지 않았다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. 회차권 목록의 조회·등록·수정·상태 표시와 `design-system.md`의 표 반응형 기준을 그대로 지켰다.

## 먼저 작성한 테스트

새 동작이 없는 스타일 전용 변경이라 새 실패 테스트는 없다. 기존 회차권 테스트(`src/features/lesson-tickets`, `src/app/passes`의 2개 파일·29개 테스트)와 e2e의 회차권 이동, 반응형 표(데스크톱 표·태블릿 행·모바일 카드), 320px 등록·수정 다이얼로그 시나리오를 안전망으로 썼고 수정 없이 통과했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 162개 파일·1,891개 테스트 통과 | 개수 변동 없음 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함 |
| 가로 넘침 | 0px | 1280, 390에서 `/passes` 측정 |

## 브라우저 증거

- 데모 production build로 촬영해 직접 확인한 화면: 1280px 회차권 관리. 390px는 촬영하고 가로 넘침만 측정했으며 직접 보지는 않았다.
- 확인한 것: 표 카드와 헤더 배경, "잔여 부족" 행의 연한 빨강 강조와 배지, 잔여 회수의 빨강 글자, 등록 버튼과 필터 정렬.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 회차권 목록 파일에서 카드·표 반복 클래스가 사라져 조건(만료 임박·잔여 부족) 판단 코드가 더 눈에 띈다.
- 예측 가능성: 다른 목록 화면과 같은 카드·표·빈 안내 모양을 쓴다.
- 응집도·결합도: 표 모양은 `ui/table.tsx`, 카드는 `SectionCard`가 정한다. 화면은 상태 판단과 데이터만 알고 모양은 모른다.
- simplify 결과: 조건부 `className`에서 기본값과 겹치는 `px-4 py-3`을 지워 분기 두 갈래의 차이(`font-semibold text-destructive`)만 남겼다.
- Warning(남김): 사용되지 않는 `AcademyLessonAttendanceScreen`과 `section` 모드의 개인레슨 등록 제목(`text-2xl`)은 그대로 있다. 제거나 정리는 스타일이 아닌 코드 정리 작업이라 이번 범위에 넣지 않았다.

## 남은 위험 또는 미확정 질문

- 레슨 워크스페이스(`lesson-management-workspace.tsx` 1,279줄, `lesson-month-calendar.tsx`)와 그 다이얼로그들은 아직 이전 스타일이고, 하드코딩 색 3곳과 이를 단언하는 테스트가 있다.

# UI 디자인 시스템 정비 4단계-3: 원생·선생님·휴원퇴원·거래처·상담 영역 적용

## 요약

- 목표: 인원·거래처 5개 목록 화면에 공용 부품을 적용하고 반복되던 표·카드·빈 안내 클래스를 걷어 낸다. 로직은 건드리지 않는 스타일 전용 작업이다.
- 이전: [4단계-1 수입](./2026-10-21-ui-redesign-stage4-finance.md), [4단계-2 교재](./2026-10-21-ui-redesign-stage4-books.md). 다음 영역은 회차권·출석·개인레슨 등록이다.
- 이 영역의 큰 파일(`student-list-screen.tsx` 1,057줄, `status-management-screen.tsx` 820줄, `teacher-list-screen.tsx` 626줄)은 구조나 로직을 손대지 않고 클래스·래퍼만 바꿨다.

## 변경 내용

- 대상 파일(전체 목록 화면과 표): `students/student-list-screen`, `students/teacher-student-roster-screen`, `teachers/teacher-list-screen`, `teachers/teacher-list-table`, `status-management/status-management-screen`, `vendors/vendor-list-screen`, `consultations/consultation-list-screen`, `consultations/consultation-list-table`.
- 표 카드: `rounded-lg border border-border bg-card` 래퍼 6곳을 `SectionCard padded={false}`로 바꿨다. 열고 닫는 `div`는 중첩 깊이를 세는 스크립트로 짝을 찾았고, 닫는 위치를 코드로 직접 확인했다.
- 표 중복 클래스: `TableHeader`의 `bg-muted text-muted-foreground`와 `TableHead`·`TableCell`의 `px-4 py-3`을 지웠다(`ui/table.tsx` 기본값과 동일, 59곳).
- 빈 목록·로딩 문구 `p-4 text-sm text-muted-foreground` 12곳을 `EmptyState`로 바꿨다.

## 바꾸지 않은 것

- 원생 상세·등록·수정 다이얼로그 안쪽의 구획(`rounded-md border border-border bg-background p-4`)과 소제목(`h3`)은 다이얼로그 안쪽 구성이라 그대로 두었다. 바탕색이 하늘색으로 바뀌어 흰 다이얼로그 안에서 자연스럽게 안쪽 구획으로 보인다.
- 역할 분기(`TeacherStudentRosterScreen`), 권한 prop, 폼 상태, 쿼리·mutation, 학년·악기·수강료 입력 코드는 수정하지 않았다.
- 목록 화면 상단의 `PageHeaderActionFallback`(헤더 액션 슬롯)은 이 화면들에 제목 블록이 없어 그대로 두었다.
- `student-list-screen.test.tsx`가 툴바 클래스(`min-w-0`, `grid-cols-2`, `md:grid-cols-3`)를 단언한다. 이번 변경은 툴바 안쪽을 건드리지 않아 테스트가 통과했다. 이 단언을 동작 기준으로 바꾸는 일은 계획대로 원생 툴바를 손볼 때 한다.

## 연결된 요구사항

- 기능 요구사항 변경 없음. `docs/product/`의 원생·선생님·휴원/퇴원·거래처·상담 명세와 `design-system.md`의 표 반응형 기준을 그대로 지켰다.

## 먼저 작성한 테스트

새 동작이 없는 스타일 전용 변경이라 새 실패 테스트는 없다. 기존 테스트(`src/features/students`, `teachers`, `status-management`, `vendors`, `consultations`, `src/app/management`의 24개 파일·244개 테스트)와 e2e의 원생·선생님·휴원퇴원·거래처·상담 이동, 관리·재무 목록의 작은 화면 표 시나리오를 안전망으로 썼고 수정 없이 통과했다.

## 검증

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm lint` | 통과 | |
| `pnpm typecheck` | 통과 | |
| `pnpm test:run` | 162개 파일·1,891개 테스트 통과 | 개수 변동 없음 |
| `pnpm test:e2e` | 20개 통과 | 데모 production build 포함 |
| 가로 넘침 | 0px | 1280(선생님·휴원퇴원·거래처·상담), 390(원생) |

## 브라우저 증거

- 데모 production build로 촬영해 직접 확인한 화면: 1280px 휴원/퇴원, 원생 등록 다이얼로그, 원생 상세 다이얼로그. 선생님·거래처·상담 1280px와 원생 390px는 촬영했고 가로 넘침만 측정했으며 직접 보지는 않았다.
- 확인한 것: 표 카드와 헤더 배경, 이중 탭(휴원/퇴원 안의 원생·선생님, 휴원·퇴원) 모양, 다이얼로그의 둥근 모서리와 안쪽 구획(연한 파랑), 입력·선택 상자와 버튼 높이.
- 1단계에서 바꾼 다이얼로그 스타일이 실제 화면에서 어떻게 보이는지 이번에 처음 확인했다. 수정이 필요한 문제는 발견하지 못했다.

## Supabase 증거

해당 없음. DB, migration, RLS를 건드리지 않았다.

## Quality Consolidation

- 가독성: 목록 화면 8개 파일에서 카드·표·빈 안내의 반복 클래스가 사라져 화면 구조(툴바, 표, 페이지네이션)가 먼저 읽힌다.
- 예측 가능성: 모든 목록 화면이 같은 카드·표 헤더·빈 안내 모양을 쓴다. 표 `label`과 `data-responsive-table` 계약은 그대로다.
- 응집도: 카드·표·빈 안내 모양은 각각 `SectionCard`, `ui/table.tsx`, `EmptyState`가 정한다.
- 결합도: 화면은 공용 부품의 props만 쓰고, 역할별 화면 분기나 데이터 코드와 스타일이 더 얽히지 않았다.
- simplify 결과: 변경 파일을 다시 읽어 닫는 태그 위치를 확인했고, 삭제한 클래스가 `ui/table.tsx` 기본값과 같은지 대조했다. 다이얼로그 안쪽 구획은 억지로 공용화하지 않았다.
- Warning(남김): 원생 상세·등록 다이얼로그의 안쪽 구획이 같은 클래스(`rounded-md border border-border bg-background p-4`)를 반복한다. 다이얼로그마다 안쪽 구성이 달라 이번에는 공용화 근거(함께 바뀌는 책임)가 부족하다고 판단했다. 이후 화면에서 같은 구획이 더 늘면 `SectionCard`의 inset 변형을 검토한다.
- Warning(남김): `student-list-screen.test.tsx`의 툴바 클래스 단언이 남아 있어 툴바 스타일을 바꾸면 깨진다.

## 남은 위험 또는 미확정 질문

- 회차권·출석·개인레슨 등록 화면과 레슨 워크스페이스는 아직 이전 스타일이다. 레슨 영역에는 하드코딩 색 3곳과 이를 단언하는 테스트가 있다.

# 2026-08-21 shadcn UI 기준 세팅 증거

## 목표

학원관리 서비스의 UI 구현 기준을 shadcn/ui 중심으로 고정하고, 현재 프로젝트 구성에서 설치 가능한 컴포넌트를 미리 받아둔다. 이후 화면 구현은 직접 만든 기본 UI보다 shadcn 컴포넌트 조합을 우선한다.

## 사용자 지시

- UI는 shadcn/ui를 활용한다.
- shadcn 컴포넌트를 가능한 모두 받아두고 컴포넌트별 사용 상황을 문서화한다.
- `toast` 같은 알림 컴포넌트도 고려한다.
- table이 필요하면 TanStack Table 같은 TanStack 도구 활용도 허용한다.

## 구현 내용

- `src/components/ui/`
  - 현재 `components.json`의 `new-york`, RSC, TypeScript, CSS variables 기준에서 설치 가능한 shadcn 컴포넌트를 추가했다.
  - 공식 All Components 목록과 대조해 누락됐던 `Sidebar`를 추가했다.
  - `sonner` Toaster를 앱 루트에 연결했다.
  - shadcn 생성 컴포넌트 중 프로젝트 lint와 충돌한 `carousel`, `combobox`를 동작 변경 없이 최소 보정했다.
- `src/hooks/use-mobile.ts`
  - shadcn `Sidebar`가 사용하는 모바일 breakpoint hook을 추가했다.
- `src/app/providers.tsx`
  - 전역 `TooltipProvider`를 연결해 shadcn `Tooltip`과 `Sidebar` tooltip 사용 기준을 맞췄다.
- `package.json`
  - `Data Table` 조합 구현을 위해 `@tanstack/react-table`을 추가했다.
- `src/components/management/list-controls.tsx`
  - 목록 화면에서 반복되는 검색 입력, 단순 필터, 오류 알림을 shadcn `Input`, `NativeSelect`, `Alert` 조합으로 공통화했다.
- `src/features/students/student-list-screen.tsx`
  - 직접 만든 input/select/table/alert를 shadcn 조합으로 교체했다.
- `src/features/teachers/teacher-list-screen.tsx`
  - 직접 만든 input/select/table/alert를 shadcn 조합으로 교체했다.
- `src/features/vendors/vendor-list-screen.tsx`
  - 거래처 목록 화면도 같은 shadcn 조합 규칙을 사용하게 맞췄다.
- `docs/engineering/design-system.md`
  - shadcn 우선, TanStack은 headless 엔진으로 사용하는 원칙을 추가했다.
- `docs/engineering/shadcn-component-guide.md`
  - 설치된 컴포넌트별 사용 상황, 조합 규칙, 금지 규칙을 문서화했다.

## 공식 CLI 확인 결과

| 항목 | 결과 | 처리 |
| --- | --- | --- |
| `shadcn add --all` | `questionnaire` 레지스트리 항목을 찾지 못해 실패 | 명시 컴포넌트 설치로 전환 |
| `toast` | CLI가 Base UI 프로젝트 전용이며 현재 구성은 `sonner` 사용을 안내 | 현재 표준은 `Sonner`로 고정 |
| `date-picker` | `new-york-v4` 레지스트리 단일 파일 없음 | `Calendar` + `Popover` 조합 항목으로 문서화 |
| `data-table` | `new-york-v4` 레지스트리 단일 파일 없음 | shadcn `Table` + TanStack Table 조합 항목으로 문서화 |
| `typography` | `new-york-v4` 레지스트리 단일 파일 없음 | 텍스트 토큰/타입 규칙으로 문서화 |
| `sidebar` | `src/components/ui/sidebar.tsx`, `src/hooks/use-mobile.ts` 생성 | 앱 shell 리팩터링 후보로 확보 |

## 2026-08-21 추가 대조 결과

| 확인 | 결과 | 처리 |
| --- | --- | --- |
| 공식 All Components 목록 재확인 | `Toast`, `Sidebar`, `Data Table`, `Date Picker`, `Typography` 상태를 재대조 | 컴포넌트 가이드에 전체 대조표 추가 |
| `pnpm dlx shadcn@latest add toast sidebar data-table date-picker typography` | `Toast`가 Base UI 전용이라 명령이 중단됨 | `Toast`는 미설치 사유를 문서화하고 `Sonner` 유지 |
| `pnpm dlx shadcn@latest add sidebar` | 통과 | `Sidebar`와 `use-mobile` 추가 |
| `pnpm dlx shadcn@latest add data-table` | 단일 레지스트리 항목 없음 | `@tanstack/react-table` + shadcn `Table` 조합으로 표준화 |
| `pnpm dlx shadcn@latest add date-picker` | 단일 레지스트리 항목 없음 | `Calendar` + `Popover` + `Button` + `Field` 조합으로 표준화 |
| `pnpm dlx shadcn@latest add typography` | 단일 레지스트리 항목 없음 | 디자인 시스템의 텍스트 규칙으로 관리 |

## 검증 결과

| 명령 또는 확인 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test:run src/features/students/student-list-screen.test.tsx src/features/teachers/teacher-list-screen.test.tsx src/features/vendors/vendor-list-screen.test.tsx` | 통과 | 3개 파일, 9개 테스트 통과 |
| `pnpm test:run src/app/providers.test.tsx` | 통과 | 전역 QueryClient/Tooltip provider 구성 확인 |
| `pnpm lint` | 통과 | `Sidebar` 생성 코드의 랜덤 skeleton 폭과 `use-mobile` effect state를 React compiler 규칙에 맞게 보정 후 통과 |
| `pnpm test:run` | 통과 | 37개 파일, 151개 테스트 통과 |
| `pnpm lint` | 통과 | shadcn 생성 파일 lint 보정 후 통과 |
| `pnpm typecheck` | 통과 | route type 생성 및 `tsc --noEmit` 통과 |
| `pnpm build` | 통과 | `/`, `/students`, `/teachers`, `/vendors` 빌드 확인 |
| `pnpm test:e2e` | 통과 | 4개 E2E 통과 |

## Quality Consolidation

- 목록 화면에 반복되던 직접 스타일링 UI를 `src/components/management/list-controls.tsx`로 묶었다.
- 단순 필터는 Radix Select보다 shadcn `NativeSelect`가 테스트와 사용자 기대에 더 안정적이라 목록 툴바 표준으로 정했다.
- 복잡한 table state는 추후 TanStack Table을 headless 엔진으로 사용하고, 시각 표현은 shadcn `Table`로 유지하도록 문서화했다.
- `Toast`는 현재 프로젝트 스타일에서 설치 불가하므로 임의 이식하지 않고 `Sonner`를 공식 표준으로 연결했다.

## 남은 리스크

- shadcn CLI가 Node `>=20.18.1`을 권장하지만 현재 로컬은 Node `20.13.1`이다.
- Supabase JS도 빌드 중 Node 22 이상 업그레이드를 권장한다.
- Base UI 기반 `Toast`가 꼭 필요해지면 shadcn 스타일 체계 전환 여부를 사용자에게 먼저 질문해야 한다.

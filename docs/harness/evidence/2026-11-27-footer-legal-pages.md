# 2026-11-27 푸터·이용약관·개인정보처리방침

## 요약

- 목표: 로그인 전·후 모든 화면에 푸터를 두고, 개인정보처리방침·이용약관을 공개한다.
- 완료한 변경
  - `src/components/layout/app-footer.tsx`
    - 문의 메일·오픈채팅, 약관 링크, 저작권·버전
    - `<main>` 안에 있어 `role="contentinfo"`를 직접 준다.
  - 푸터를 넣은 곳: `AppShell`(본문 열 맨 아래), 로그인·가입 화면(`SessionShell`), 문서 화면
  - `src/app/service-info.ts`: 운영자(김동성)·메일·오픈채팅·버전·시행일을 한 곳에 둔다.
  - `/privacy`, `/terms`
    - `LegalPageLayout`으로 로그인 없이 읽는다.
    - 사이트맵에 넣었고 검색 제외 헤더는 없다.
- 커버한 요구사항: 사용자 결정 2026-11-27
  - 위치: 로그인 화면 + 앱 모든 화면
  - 내용: 약관·처리방침, 문의, 저작권·버전. 사업자 정보는 제외했다.

## 먼저 작성한 테스트

- `app-footer.test.tsx`: 링크 주소, 새 창, 저작권, 버전
- `legal-pages.test.tsx`: 처리방침에 책임자·국외 이전(도쿄)·주민등록번호 암호화·시행일이 있는지, 약관 목적·학원 정보 조항
- `seo-routes.test.tsx`: 사이트맵 3개
- `app-shell.test.tsx`·`academy-session-gate.test.tsx`: 로그인 후·전 화면의 푸터
- E2E 2건
  - 푸터 → 처리방침 이동, 검색 제외 헤더 없음, 사이트맵
  - 320px에서 가로 넘침 없음
- 초기 실패: 모듈 없음, contentinfo 없음, 사이트맵 1건으로 실패했다.
  - E2E에서 `<main>` 안 `<footer>`가 랜드마크가 아니어서 한 번 더 실패했고, 역할을 직접 지정해 고쳤다.

## 검증

| 명령 또는 확인 | 결과 |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | 통과 |
| `pnpm test:run` | 284 파일 / 2643 테스트 통과 |
| `pnpm test:e2e` | 45 통과 |

## 브라우저 증거

- 데모 빌드 `next start`
- 1280px 대시보드: 본문 맨 아래 푸터
- 375px `/privacy`: 가로 넘침 없음(scrollWidth 375), 맨 아래 푸터

## 처리방침 사실 확인

- 카카오 동의: `account_email` 필수(`docs/engineering/kakao-auth-setup.md`)
- DB 리전: `ap-northeast-1`(일본 도쿄). `supabase projects list`로 확인했다.
- 선생님 주민등록번호: 암호화 저장, 원장만 원문 열람(`20261018090200` migration)
- 보관 기간
  - 상담 1년(`src/domain/consultation.ts`)
  - 알림 30일·할 일 상태 90일·브리핑 기록 90일(`20261119000300` migration)
- 분석·광고 도구 없음(`package.json`, `layout.tsx` 확인)

## 품질 정리

- 가독성: 운영 정보 상수 한 곳, 문서 화면 공통 레이아웃 한 곳
- 예측 가능성: 푸터와 처리방침이 같은 상수를 써서 연락처가 어긋나지 않는다.
- 응집도: 푸터·문서 레이아웃은 `components/layout`, 운영 정보는 `seo.ts` 옆 `service-info.ts`
- 결합도: 페이지는 상수와 레이아웃만 쓴다.
- simplify 결과: 작은 변경이라 같은 네 관점(재사용·단순화·효율·높이)으로 직접 검토했다.
  - 표 대신 목록을 써서 모바일 넘침과 쓰지 않는 표 스타일을 없앴다.
  - 메일 링크가 세 곳에 있지만 모두 같은 상수를 쓴다.

## 남은 위험·질문

- 약관·처리방침은 법률 검토를 받지 않은 초안이다. 유료 판매나 사업자 등록 시 사업자 정보와 함께 검토가 필요하다.
- Resend 법인명은 확인하지 않아 서비스명으로만 적었다.

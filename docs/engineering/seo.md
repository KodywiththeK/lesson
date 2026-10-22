# 브랜드와 검색 노출

## 기준

- 서비스명은 `마디마디`, 대표 문구는 “모든 수업의 마디마다, 더 편리한 음악학원 관리”다.
- 공식 주소는 `https://lesson-pi-ten.vercel.app/`다. 도메인이 바뀌면 `src/app/seo.ts`의 `siteUrl`과 검색 콘솔 등록 주소를 함께 바꾼다.
- 원본 로고는 `public/brand/madimadi-logo.webp`, 공유 썸네일은 `public/brand/madimadi-thumbnail.webp`다. 공유 이미지는 원본 비율 1672×941과 대체 텍스트를 메타데이터에 명시한다.
- `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`는 `src/app/layout.tsx`의 `icons`에 연결한다. Android 192·512px 아이콘은 `src/app/manifest.ts`에서 참조한다. `public`에 파일을 넣는 것만으로 메타데이터 링크가 자동 생성되지는 않는다.
- manifest는 현재 브라우저 표시(`display: browser`)만 선언한다. 별도 설치형 앱 동작은 제품 결정 전까지 약속하지 않는다.
- 로고는 `BrandLogo` 한 곳에서 렌더하고 데스크톱 사이드바·모바일 메뉴의 현재 학원명 위와 로그인 전 화면에 재사용한다. 학원명은 학원 데이터이며 서비스명과 혼동하지 않는다.

## 공개 범위

- `/`는 로그인 전 공개 진입점으로 검색과 공유가 가능하다. 제목, 설명, canonical, Open Graph, Twitter 카드에 같은 브랜드 문구를 사용한다. 로그인 전 대기 화면에도 로고와 문구를 표시한다.
- `/sitemap.xml`에는 `/`만 넣는다. 로그인 뒤 운영 경로는 `next.config.ts`의 `X-Robots-Tag: noindex, nofollow`로 검색에서 제외한다. 새 운영 경로를 추가하면 `privateRouteSources`도 갱신하고 `src/app/seo-routes.test.tsx`로 메뉴 경로 전체가 포함되는지 확인한다.
- `robots.txt`가 내부 경로를 막지 않는 것은 의도적이다. 크롤러가 해당 응답의 `noindex` 헤더를 확인할 수 있어야 한다. 내부 데이터 접근 제어는 검색 설정이 아니라 인증과 RLS가 맡는다.
- 공개 소개 페이지는 아직 없다. 현재 검색 가능한 본문은 로그인 전 브랜드·로그인 화면이므로 제품 설명으로 검색 유입을 늘리려면 별도 공개 콘텐츠와 인수 기준을 결정해야 한다.

## 검증

- 단위 테스트: `src/app/layout.test.tsx`, `src/app/seo-routes.test.tsx`.
- 실제 빌드: `tests/e2e/home.spec.ts`에서 canonical·OG 이미지 응답·파비콘 링크와 응답·manifest·사이드바/320px 메뉴 로고·운영 경로 헤더·사이트맵을 확인한다.
- 이미지 원본이나 공식 도메인을 바꾸면 메타데이터, 사이트맵, 스크린샷을 함께 확인한다.

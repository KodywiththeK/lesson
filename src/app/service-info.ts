import { version } from "../../package.json";

/** 푸터·약관·개인정보처리방침이 같이 쓰는 운영 정보. 바뀌면 이 파일 한 곳만 고친다. */
export const serviceOperator = {
  name: "김동성",
  email: "kody.withe.k@gmail.com",
  openChatUrl: "https://open.kakao.com/o/s7t9hSYi",
} as const;

export const appVersion = version;

/** 약관·개인정보처리방침 시행일. 내용을 바꾸면 함께 바꾸고 이전 내용은 git 이력으로 확인한다. */
export const legalEffectiveDate = "2026년 11월 27일";

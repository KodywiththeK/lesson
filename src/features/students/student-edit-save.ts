import { toUserMessage } from "@/lib/errors/user-message";

/**
 * 원생 수정은 이름·기본 정보·수강 변경을 한 트랜잭션으로 저장하므로, 실패하면 아무것도 저장되지 않는다.
 * 화면에는 그 사실과 원인을 함께 알린다.
 */
export function toStudentSaveFailureMessage(error: unknown) {
  return `저장되지 않았습니다. ${toUserMessage(error)}`;
}

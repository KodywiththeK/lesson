const GENERIC_MESSAGE =
  "일시적인 문제가 발생했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.";

const HANGUL_PATTERN = /[가-힣]/;

/** 먼저 일치한 규칙의 문구를 쓴다. 영문 DB/RPC 예외와 내부 용어를 사용자 문구로 바꾼다. */
const MESSAGE_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /not allowed|permission denied|row-level security|not authorized|\b42501\b/i,
    message: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
  },
  {
    pattern: /student not found/i,
    message: "원생 정보를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
  },
  {
    pattern: /jwt expired|invalid jwt|refresh token/i,
    message: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  },
  {
    pattern: /failed to fetch|networkerror|network request failed|load failed/i,
    message: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  },
  {
    pattern: /duplicate key value|already exists/i,
    message: "이미 등록된 내용입니다. 목록을 확인해 주세요.",
  },
  {
    pattern: /사용 가능한 .+ 회차권이 없습니다/,
    message: "사용할 수 있는 회차권이 없습니다. 회차권 메뉴에서 등록하거나 유효기간을 확인해 주세요.",
  },
  {
    pattern: /환경변수|Supabase client/,
    message: "서비스 연결 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.",
  },
];

/**
 * 오류를 화면에 보여 줄 사용자 문구로 바꾼다. 저장하거나 기록하지 않는다.
 * 이미 읽을 수 있는 한글 검증 메시지는 그대로 두고, 영문·내부 원인은 숨긴다.
 */
export function toUserMessage(error: unknown): string {
  const raw = readRawMessage(error);
  if (!raw) {
    return GENERIC_MESSAGE;
  }

  const rule = MESSAGE_RULES.find(({ pattern }) => pattern.test(raw));
  if (rule) {
    return rule.message;
  }

  const separatorIndex = raw.indexOf(": ");
  if (separatorIndex === -1) {
    return HANGUL_PATTERN.test(raw) ? raw : GENERIC_MESSAGE;
  }

  const prefix = raw.slice(0, separatorIndex).trim();
  const cause = raw.slice(separatorIndex + 2).trim();
  if (HANGUL_PATTERN.test(cause)) {
    return cause;
  }

  return HANGUL_PATTERN.test(prefix)
    ? `${prefix.replace(/[.。]$/, "")}. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.`
    : GENERIC_MESSAGE;
}

function readRawMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim();
  }

  return typeof error === "string" ? error.trim() : "";
}

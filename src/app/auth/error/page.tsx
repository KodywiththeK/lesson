import Link from "next/link";

export default function AuthErrorPage() {
  return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="grid max-w-md gap-4 rounded-2xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">로그인을 완료하지 못했습니다</h1><p>카카오 인증을 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.</p><Link className="text-primary underline" href="/">로그인으로 돌아가기</Link></div></main>;
}

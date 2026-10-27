"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (token) {
      window.sessionStorage.setItem("academy-invite-token", token);
      window.history.replaceState(null, "", "/join");
      router.replace("/");
    }
  }, [router]);
  return <main className="grid min-h-screen place-items-center bg-background p-6"><p>초대 링크를 확인하고 있습니다. 링크가 열리지 않으면 원장에게 새 초대를 요청해 주세요.</p></main>;
}

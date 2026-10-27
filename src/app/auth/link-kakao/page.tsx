import { connection } from "next/server";
import { notFound } from "next/navigation";

import { LinkOwnerKakao } from "@/features/auth/link-owner-kakao";

export default async function LinkKakaoPage() {
  await connection();
  if (process.env.LEGACY_OWNER_LINK_ENABLED !== "1") notFound();
  return <LinkOwnerKakao />;
}

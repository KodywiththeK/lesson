import { connection } from "next/server";
import { notFound } from "next/navigation";

import { LegacyOwnerSignIn } from "@/features/auth/legacy-owner-sign-in";

export default async function LegacyLinkPage() {
  await connection();
  if (process.env.LEGACY_OWNER_LINK_ENABLED !== "1") notFound();
  return <LegacyOwnerSignIn />;
}

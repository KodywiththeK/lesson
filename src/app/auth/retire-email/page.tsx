import { connection } from "next/server";
import { notFound } from "next/navigation";

import { LegacyOwnerRetirementScreen } from "@/features/auth/legacy-owner-retirement-screen";

export default async function RetireEmailPage() {
  await connection();
  if (process.env.LEGACY_OWNER_LINK_ENABLED !== "1") notFound();
  return <LegacyOwnerRetirementScreen />;
}

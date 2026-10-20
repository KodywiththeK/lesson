import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("교재 결제 완료는 출고 등록에서만 가능하고 사후 완료 RPC 실행 권한은 없다", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261020090700_book_payment_at_registration_only.sql"), "utf8");
  expect(sql).toMatch(/revoke execute on function public\.complete_book_release_payment\(uuid, uuid, date\) from authenticated/);
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync("supabase/migrations/20261117000200_drop_legacy_paid_rpcs.sql", "utf8");

const LEGACY = [
  {
    publicSignature: "public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text)",
    privateName: "mark_fixed_income_snapshot_paid_without_card_fee",
    wrapper: "public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text, uuid, integer)",
  },
  {
    publicSignature: "public.mark_lesson_ticket_paid(uuid, uuid, date, text)",
    privateName: "mark_lesson_ticket_paid_without_card_fee",
    wrapper: "public.mark_lesson_ticket_paid(uuid, uuid, date, text, uuid, integer)",
  },
];

describe("옛 4인자 입금 RPC 정리", () => {
  it("옛 4인자 입금 RPC는 앱에서 부를 수 없는 private 함수로 옮겨 카드사 필수 검사를 건너뛰지 못하게 한다", () => {
    const text = sql();
    for (const { publicSignature, privateName } of LEGACY) {
      expect(text).toContain(`alter function ${publicSignature} set schema private;`);
      expect(text).toContain(`rename to ${privateName};`);
      expect(text).toMatch(new RegExp(`revoke all on function private\\.${privateName}\\(uuid, uuid, date, text\\)\\s+from public, anon, authenticated;`));
    }
  });

  it("6인자 입금 RPC는 옮긴 private 함수를 부르도록 다시 만들고 실행 권한을 유지한다", () => {
    const text = sql();
    for (const { privateName, wrapper } of LEGACY) {
      expect(text).toContain(`private.${privateName}(p_academy_id`);
      expect(text).toContain(`grant execute on function ${wrapper} to authenticated;`);
    }
    expect(text).not.toMatch(/:= public\.mark_/);
    expect(text).toContain("notify pgrst, 'reload schema'");
  });
});

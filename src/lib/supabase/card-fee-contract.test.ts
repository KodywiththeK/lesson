import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync("supabase/migrations/20261117000000_card_fee.sql", "utf8");

function body(name: string) {
  const text = sql();
  const start = text.indexOf(`function ${name}(`);
  expect(start, `${name} 정의`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf("$$;", start));
}

describe("카드 수수료 DB 경계", () => {
  it("카드사 수수료율은 학원별 표에 두고 원장·데스크만 읽으며 쓰기는 원장 RPC로만 한다", () => {
    const text = sql();
    expect(text).toContain("create table public.card_fee_rates");
    expect(text).toContain("references public.academies(id) on delete cascade");
    expect(text).toContain("rate_percent numeric(4,2) not null check (rate_percent >= 0 and rate_percent <= 10)");
    expect(text).toContain("alter table public.card_fee_rates enable row level security");
    expect(text).toContain("revoke all on public.card_fee_rates from public, anon, authenticated");
    expect(text).toMatch(/for select to authenticated\s+using \(private\.has_academy_role\(academy_id, array\['owner'::public\.academy_member_role, 'desk'::public\.academy_member_role\]\)\)/);
    for (const name of ["public.save_card_fee_rate", "public.archive_card_fee_rate"]) {
      expect(body(name)).toContain("array['owner'::public.academy_member_role]");
      expect(body(name)).toContain("insert into public.audit_events");
    }
  });

  it("수수료 행은 수입 행에 연결되어 수입이 지워지면 같이 지워진다", () => {
    const text = sql();
    expect(text).toContain("add column fee_for_entry_id uuid");
    expect(text).toMatch(/foreign key \(academy_id, fee_for_entry_id\)\s+references public\.ledger_entries\(academy_id, id\) on delete cascade/);
    expect(text).toContain("'card-fee'");
  });

  it("연결된 수입 금액이 바뀌면(환불 등) 수수료도 같은 비율로 바뀌고 0원이면 지운다", () => {
    const scale = body("private.scale_card_fee_with_income");
    expect(scale).toContain("round(fee.amount::numeric * new.amount / old.amount)");
    expect(scale).toContain("delete from public.ledger_entries");
    expect(sql()).toContain("after update of amount on public.ledger_entries");
  });

  it("수수료 기록은 카드 결제만, 활성 카드사가 있으면 선택 필수, 금액은 0원~결제 금액", () => {
    const record = body("private.record_card_fee");
    expect(record).toContain("p_payment_method <> 'card'");
    expect(record).toContain("카드사를 선택해 주세요.");
    expect(record).toContain("round(v_income.amount::numeric * v_rate.rate_percent / 100)");
    expect(record).toContain("p_fee_amount < 0 or p_fee_amount > v_income.amount");
    expect(record).toContain("'expense', v_income.source, 'card-fee'");
  });

  it("수강료·회차권 입금 RPC에 카드 수수료 인자를 받는 새 시그니처를 두고 옛 4인자는 유지한다", () => {
    const tuition = body("public.mark_fixed_income_snapshot_paid");
    expect(tuition).toContain("p_card_fee_rate_id uuid, p_card_fee_amount integer");
    expect(tuition).toContain("public.mark_fixed_income_snapshot_paid(p_academy_id, p_snapshot_id, p_paid_at, p_payment_method)");
    expect(tuition).toContain("private.record_card_fee(");

    const ticket = body("public.mark_lesson_ticket_paid");
    expect(ticket).toContain("p_card_fee_rate_id uuid, p_card_fee_amount integer");
    expect(ticket).toContain("public.mark_lesson_ticket_paid(p_academy_id, p_ticket_id, p_paid_on, p_payment_method)");
    // 데스크도 수수료 행을 쓸 수 있도록 회차권 원장 가드 설정을 켠다.
    expect(ticket).toContain("set_config('app.ledger_rpc', 'lesson-ticket', true)");
    expect(sql()).not.toMatch(/drop function public\.mark_(fixed_income_snapshot|lesson_ticket)_paid/);
  });
});

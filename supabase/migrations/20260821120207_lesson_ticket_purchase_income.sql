alter type public.ledger_entry_source add value if not exists 'lesson-ticket';

alter table public.lesson_ticket_grants
  add column if not exists paid_amount integer not null default 0
    check (paid_amount >= 0),
  add column if not exists paid_at date;

comment on column public.lesson_ticket_grants.paid_amount is
  '회차권 구매 시 실제 수납된 금액. 구매 수입 ledger_entries와 대조한다.';

comment on column public.lesson_ticket_grants.paid_at is
  '회차권 구매 수납일. 값이 없으면 registered_at 기준으로 처리한다.';

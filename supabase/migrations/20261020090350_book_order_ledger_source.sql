-- Enum 값은 추가한 트랜잭션 안에서 사용할 수 없으므로 발주 RPC보다 앞선 migration으로 분리한다.
alter type public.ledger_entry_source add value if not exists 'book-order';

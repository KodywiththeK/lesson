-- 교재 입금 확인은 출고 등록과 같은 트랜잭션에서만 확정한다.
revoke execute on function public.complete_book_release_payment(uuid, uuid, date) from authenticated;
notify pgrst, 'reload schema';

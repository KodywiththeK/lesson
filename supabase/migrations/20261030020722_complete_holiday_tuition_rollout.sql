-- 새 앱 배포가 준비된 후에만 실행한다. 이전 앱이 사용하는 입금 API를 제거하고
-- 공휴일을 확인할 수 없는 달의 신규 자동 배정을 보류한다.
update private.academy_holiday_rollout set enabled = true where singleton;
drop function public.mark_fixed_income_snapshot_paid(uuid, uuid, date);
notify pgrst, 'reload schema';

-- 원생의 최초 등록일을 수정하면 입금 전 수강료의 납입일도 새 등록일 기준으로 다시 계산한다(2026-11-14 학원 피드백).
-- 월 수강료 snapshot은 그 달이 처음 조회될 때 납입일(due_on)이 한 번 정해지고 이후 고정되어,
-- 등록일을 고쳐도 이미 만들어진 달의 납입일이 그대로 남던 문제를 막는다.
-- 갱신 대상: 이번 달(서울 기준) 이후의 입금 전(미입금·미납) snapshot만. 입금 완료와 지난달 기록은 그대로 둔다.
-- 납입일 규칙은 ensure_monthly_fixed_income_snapshots와 같다(등록일의 일을 그 달에 적용, 그 달에 없는 날이면 다음 달 1일).
-- 적용된 migration은 고치지 않고 trigger만 새로 추가한다.

create function private.student_registered_on_due_on_sync() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_today_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_snapshot public.fixed_income_snapshots%rowtype;
  v_month_start date;
  v_month_end date;
  v_due_on date;
begin
  if old.registered_on is not distinct from new.registered_on or new.registered_on is null then
    return new;
  end if;

  for v_snapshot in select * from public.fixed_income_snapshots
    where academy_id = new.academy_id and student_id = new.id
      and status in ('unpaid', 'overdue')
      and month >= v_today_month
    order by month, id for update
  loop
    -- 같은 잠금을 기다리는 입금이 먼저 완료되면 READ COMMITTED에서 잠금 후 다시 확인한다.
    if v_snapshot.status not in ('unpaid', 'overdue') then continue; end if;

    v_month_start := to_date(v_snapshot.month || '-01', 'YYYY-MM-DD');
    v_month_end := (v_month_start + interval '1 month - 1 day')::date;
    v_due_on := case
      when extract(day from new.registered_on)::int <= extract(day from v_month_end)::int
        then make_date(
          extract(year from v_month_start)::int,
          extract(month from v_month_start)::int,
          extract(day from new.registered_on)::int
        )
      else v_month_end + 1
    end;

    if v_due_on is distinct from v_snapshot.due_on then
      update public.fixed_income_snapshots set due_on = v_due_on
      where id = v_snapshot.id and academy_id = new.academy_id and status in ('unpaid', 'overdue');

      insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
      values (new.academy_id, (select auth.uid()), 'tuition.due_on_synced', 'fixed_income_snapshots', v_snapshot.id::text,
        jsonb_build_object('month', v_snapshot.month, 'previous_due_on', v_snapshot.due_on, 'due_on', v_due_on));
    end if;
  end loop;

  return new;
end;
$$;
revoke all on function private.student_registered_on_due_on_sync() from public, anon, authenticated;

create trigger student_registered_on_due_on_sync after update of registered_on on public.students
  for each row execute function private.student_registered_on_due_on_sync();

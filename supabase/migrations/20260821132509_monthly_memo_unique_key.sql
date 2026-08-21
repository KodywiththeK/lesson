delete from public.monthly_memos older
using public.monthly_memos newer
where older.academy_id = newer.academy_id
  and older.month = newer.month
  and older.updated_at < newer.updated_at;

alter table public.monthly_memos
  add constraint monthly_memos_academy_month_key unique (academy_id, month);

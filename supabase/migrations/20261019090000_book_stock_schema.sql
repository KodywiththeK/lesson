-- 교재 관리 재고 스키마 (2026-10-17 교재 관리 명세, docs/product/book-management-spec.md)
--
-- 1. books: 교재 한 줄 = 현재 재고 권수(quantity), 최근 입고일(stocked_on), 정규화 도서명(title_key).
--    보관하지 않은(active) 교재는 학원 안에서 title_key가 유일하다. active=false가 "삭제(보관)"다.
-- 2. book_releases: 출고 한 건의 수량(quantity). price는 단가이고 금액은 price × quantity다.
-- 3. 기존 데이터 이행: 같은 학원·정규화 도서명의 교재를 가장 최근에 출고된 한 줄로 합치고,
--    출고 기록은 그 교재로 옮긴다. 재고는 0권, 입고일은 교재 행 생성일(KST)이다.
-- 4. 원생을 삭제해도 판매 기록이 지워지지 않는다(원생 연결만 끊김, 이름 스냅샷 유지).
-- 5. books·book_releases는 브라우저에서 직접 쓰지 못한다(다음 migration의 RPC로만 변경).
--
-- book_inventory_batches는 앱이 쓰지 않으므로 그대로 둔다(입고 이력은 남기지 않기로 했다).

create or replace function private.normalize_book_title(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- 공백류를 한 칸으로 줄인 뒤 앞뒤를 지운다(탭·줄바꿈이 앞뒤에 붙어도 앱의 normalizeBookTitle과 같은 결과).
  select lower(btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g')));
$$;

revoke all on function private.normalize_book_title(text) from public, anon;
grant execute on function private.normalize_book_title(text) to authenticated;

alter table public.books
  add column if not exists quantity integer not null default 0 check (quantity >= 0),
  add column if not exists stocked_on date,
  add column if not exists title_key text;

alter table public.book_releases
  add column if not exists quantity integer not null default 1 check (quantity >= 1);

update public.books
set title_key = private.normalize_book_title(title)
where title_key is null;

-- 같은 학원·정규화 도서명끼리 합친다. 보관한(active=false) 교재와 활성 교재는 따로 묶는다(보관한 교재와 같은 도서명은 중복이 아니다). 대표 행은 가장 최근에 출고된 교재(출고가 없으면 가장 최근에 만든 교재)이고,
-- 교재 행은 출고마다 새로 만들어졌으므로 대표 행의 가격이 곧 가장 최근 출고 가격이다.
create temporary table pg_temp.book_merge_map as
select
  book.id as old_id,
  first_value(book.id) over (
    partition by book.academy_id, book.title_key, book.active
    order by coalesce(latest_release.created_at, book.created_at) desc, book.id
  ) as keep_id
from public.books book
left join lateral (
  select max(release.created_at) as created_at
  from public.book_releases release
  where release.academy_id = book.academy_id
    and release.book_id = book.id
) latest_release on true;

update public.book_releases release
set book_id = merge_map.keep_id
from pg_temp.book_merge_map merge_map
where release.book_id = merge_map.old_id
  and merge_map.old_id <> merge_map.keep_id;

-- 입고 이력은 앱이 쓰지 않지만 있다면 합쳐지는 교재를 지울 때 cascade로 사라지지 않게 대표 교재로 옮긴다.
update public.book_inventory_batches batch
set book_id = merge_map.keep_id
from pg_temp.book_merge_map merge_map
where batch.book_id = merge_map.old_id
  and merge_map.old_id <> merge_map.keep_id;

delete from public.books book
using pg_temp.book_merge_map merge_map
where book.id = merge_map.old_id
  and merge_map.old_id <> merge_map.keep_id;

drop table pg_temp.book_merge_map;

update public.books
set stocked_on = (created_at at time zone 'Asia/Seoul')::date
where stocked_on is null;

alter table public.books
  alter column title_key set not null,
  alter column stocked_on set not null,
  drop constraint if exists books_title_key_check,
  add constraint books_title_key_check check (title_key = private.normalize_book_title(title));

create unique index if not exists books_academy_title_key_active_key
on public.books (academy_id, title_key)
where active;

-- 원생을 삭제해도 영구 보존 판매 기록은 남긴다. 원생 이름은 student_name 스냅샷으로 계속 보인다.
alter table public.book_releases
  alter column student_id drop not null;

alter table public.book_releases
  drop constraint if exists book_releases_student_id_fkey,
  drop constraint if exists book_releases_academy_student_fk;

alter table public.book_releases
  add constraint book_releases_academy_student_fk
  foreign key (academy_id, student_id)
  references public.students (academy_id, id)
  on delete set null (student_id);

-- 출고 탭(결제 대기만)과 결제 완료 탭(입금일 월 범위)이 필요한 행만 읽도록 한다.
create index if not exists book_releases_academy_status_paid_idx
on public.book_releases (academy_id, status, paid_at);

-- 교재·출고는 RPC로만 바꾼다. 데스크가 상태를 paid로 직접 바꾸는 우회로를 막는다.
revoke all on public.books from anon, authenticated;
revoke all on public.book_releases from anon, authenticated;
grant select on public.books to authenticated;
grant select on public.book_releases to authenticated;

notify pgrst, 'reload schema';

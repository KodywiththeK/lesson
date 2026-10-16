import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 이 migration 파일 하나의 계약만 확인한다(이전 migration의 같은 문자열 때문에 통과하는 일을 막는다).
const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261019090000_book_stock_schema.sql"),
  "utf8",
).toLocaleLowerCase();

describe("교재 재고 스키마 migration 계약", () => {
  it("교재 한 줄이 현재 재고 권수·최근 입고일·정규화 도서명을 가진다", () => {
    expect(sql).toContain("add column if not exists quantity integer not null default 0");
    expect(sql).toContain("check (quantity >= 0)");
    expect(sql).toContain("add column if not exists stocked_on date");
    expect(sql).toContain("add column if not exists title_key text");
    expect(sql).toContain("create or replace function private.normalize_book_title");
    // 치환(공백류 → 한 칸)을 먼저 하고 trim을 뒤에 둬 앱의 normalizeBookTitle과 같은 결과가 나오게 한다.
    expect(sql).toContain("lower(btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g')))");
    expect(sql).toContain("check (title_key = private.normalize_book_title(title))");
  });

  it("보관하지 않은 교재는 학원 안에서 정규화 도서명이 유일하다(재입고 합산의 동시성 기준)", () => {
    expect(sql).toMatch(/create unique index[^;]*books[^;]*\(academy_id, title_key\)\s*where active/);
  });

  it("출고 한 건은 수량을 가지며 기존 건은 1권으로 이전된다", () => {
    expect(sql).toContain("alter table public.book_releases");
    expect(sql).toContain("add column if not exists quantity integer not null default 1");
    expect(sql).toContain("check (quantity >= 1)");
  });

  it("같은 학원·도서명의 교재는 가장 최근에 출고된 교재 한 줄로 합치고 출고 기록은 그 교재로 옮긴다", () => {
    expect(sql).toContain("pg_temp.book_merge_map");
    // 보관한 교재와 활성 교재는 같은 그룹으로 묶지 않는다(보관한 교재와 같은 도서명은 중복이 아니다).
    expect(sql).toContain("partition by book.academy_id, book.title_key, book.active");
    expect(sql).toMatch(/update public\.book_releases[\s\S]*set book_id = /);
    expect(sql).toMatch(/delete from public\.books[\s\S]*book_merge_map/);
    expect(sql).toContain("(created_at at time zone 'asia/seoul')::date");
  });

  it("합쳐져 삭제되는 교재의 입고 이력은 삭제(cascade)되지 않고 대표 교재로 옮긴다", () => {
    expect(sql).toMatch(/update public\.book_inventory_batches[\s\S]*set book_id = /);
  });

  it("원생을 삭제해도 판매 기록이 지워지지 않고 원생 연결만 끊긴다", () => {
    expect(sql).toContain("alter column student_id drop not null");
    expect(sql).toContain("drop constraint if exists book_releases_student_id_fkey");
    expect(sql).toContain("drop constraint if exists book_releases_academy_student_fk");
    expect(sql).toMatch(
      /foreign key \(academy_id, student_id\)\s+references public\.students \(academy_id, id\)\s+on delete set null \(student_id\)/,
    );
  });

  it("교재·출고는 브라우저에서 직접 쓰지 못하고 조회만 남긴다", () => {
    expect(sql).toContain("revoke all on public.books from anon, authenticated");
    expect(sql).toContain("revoke all on public.book_releases from anon, authenticated");
    expect(sql).toContain("grant select on public.books to authenticated");
    expect(sql).toContain("grant select on public.book_releases to authenticated");
  });

  it("탭별 조회(대기만·결제 완료 월 범위)용 인덱스를 둔다", () => {
    expect(sql).toMatch(/create index[^;]*book_releases[^;]*\(academy_id, status, paid_at\)/);
  });
});

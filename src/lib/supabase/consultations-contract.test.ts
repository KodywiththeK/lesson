import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261018100000_consultations.sql"),
  "utf8",
).toLowerCase();

const OWNER_DESK_ONLY =
  "private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])";

describe("상담 테이블 migration 계약", () => {
  it("상담 기록 필드와 입력 검증 제약을 학원 범위 테이블로 만든다", () => {
    expect(sql).toContain("create table public.consultations");
    expect(sql).toContain("academy_id uuid not null references public.academies (id) on delete cascade");
    expect(sql).toContain("instrument_names text[] not null default '{}'");
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("constraint consultations_name_check");
    expect(sql).toContain("constraint consultations_phone_check");
    expect(sql).toContain("constraint consultations_age_check");
    expect(sql).toContain("regexp_replace(phone, '\\d', '', 'g')) >= 4");
    expect(sql).toContain("constraint consultations_academy_id_id_key unique (academy_id, id)");
  });

  it("학원별 접수일 최신순 조회 인덱스와 updated_at 트리거를 둔다", () => {
    expect(sql).toContain("create index consultations_academy_created_idx");
    expect(sql).toContain("on public.consultations (academy_id, created_at desc)");
    expect(sql).toContain("create trigger consultations_set_updated_at");
    expect(sql).toContain("before update on public.consultations");
    expect(sql).toContain("execute function private.set_updated_at()");
  });

  it("RLS를 켜고 select·insert·update·delete 모두 원장·데스크만 허용하며 선생님 role은 어디에도 쓰지 않는다", () => {
    expect(sql).toContain("alter table public.consultations enable row level security");

    for (const [policy, command] of [
      ["consultations_select_owner_desk", "for select"],
      ["consultations_insert_owner_desk", "for insert"],
      ["consultations_update_owner_desk", "for update"],
      ["consultations_delete_owner_desk", "for delete"],
    ]) {
      expect(sql).toContain(`create policy "${policy}"`);
      expect(sql).toMatch(
        new RegExp(`create policy "${policy}"\\s+on public\\.consultations ${command}\\s+to authenticated`),
      );
    }

    const policyBlocks = sql.split("create policy").slice(1);
    expect(policyBlocks).toHaveLength(4);
    for (const block of policyBlocks) {
      expect(block).toContain(OWNER_DESK_ONLY);
      expect(block).not.toContain("'teacher'");
    }
    expect(policyBlocks.find((block) => block.includes("for insert"))).toContain(`with check (${OWNER_DESK_ONLY})`);
    expect(policyBlocks.find((block) => block.includes("for update"))).toContain(`with check (${OWNER_DESK_ONLY})`);
  });

  it("anon에는 아무 권한도 주지 않고, authenticated에는 조회·삭제와 접수일을 바꿀 수 없는 컬럼 단위 쓰기만 준다", () => {
    expect(sql).toContain("revoke all on public.consultations from public, anon, authenticated");
    expect(sql).toContain("grant select, delete on public.consultations to authenticated");
    expect(sql).toContain(
      "grant insert (academy_id, name, age, instrument_names, phone, school, memo)\n  on public.consultations to authenticated",
    );
    expect(sql).toContain(
      "grant update (name, age, instrument_names, phone, school, memo)\n  on public.consultations to authenticated",
    );
    expect(sql).not.toMatch(/grant [^;]*on public\.consultations to anon/);
  });

  it("접수일로부터 1년이 지난 상담을 지우는 함수는 service_role과 postgres만 실행한다", () => {
    expect(sql).toContain("create function public.delete_expired_consultations(p_now timestamptz default now())");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("delete from public.consultations");
    expect(sql).toContain("where created_at < p_now - interval '1 year'");
    expect(sql).toContain(
      "revoke all on function public.delete_expired_consultations(timestamptz) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.delete_expired_consultations(timestamptz) to service_role",
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.delete_expired_consultations\(timestamptz\) to (authenticated|anon|public)/,
    );
  });

  it("cron 스키마가 있을 때만 매일 한 번 만료 상담 삭제를 다시 등록한다", () => {
    expect(sql).toContain("from pg_namespace");
    expect(sql).toContain("nspname = 'cron'");
    expect(sql).toContain("jobname = 'lesson-delete-expired-consultations'");
    expect(sql).toContain("perform cron.unschedule('lesson-delete-expired-consultations')");
    expect(sql).toContain("perform cron.schedule(");
    expect(sql).toContain("'0 18 * * *'");
    expect(sql).toContain("'select public.delete_expired_consultations();'");
  });

  it("상담 개인정보를 감사 기록이나 로그에 남기지 않는다", () => {
    expect(sql).not.toContain("audit_events");
    expect(sql).not.toContain("raise notice");
    expect(sql).not.toContain("raise log");
  });
});

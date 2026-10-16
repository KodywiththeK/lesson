"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";

import { ListSearchField, ListStatusAlert } from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListView } from "@/domain/common-list";
import type {
  BuildTeacherStudentRosterOptions,
  TeacherStudentRosterRow,
} from "@/domain/teacher-student-roster";
import {
  createTeacherStudentRosterQueryOptions,
  type TeacherStudentRosterSupabaseClient,
} from "@/lib/api/teacher-student-roster";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TeacherStudentRosterQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<TeacherStudentRosterRow>>;
};

export type TeacherStudentRosterQueryOptionsFactory = (
  options: BuildTeacherStudentRosterOptions,
) => TeacherStudentRosterQueryOptions;

type SupabaseClientState =
  | { client: TeacherStudentRosterSupabaseClient; error: null }
  | { client: null; error: Error };

/**
 * 선생님 계정의 원생 화면. 담당 원생의 이름·악기·요일만 읽기 전용으로 보여 준다.
 * 학교·나이·수강료·연락처는 서버(RPC)가 내려주지 않으므로 화면에서 숨기는 것이 아니라 아예 받지 않는다.
 */
export function TeacherStudentRosterScreen({
  academyId,
  queryOptionsFactory,
}: {
  academyId: string;
  queryOptionsFactory?: TeacherStudentRosterQueryOptionsFactory;
}) {
  const [search, setSearch] = useState("");
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createSupabaseClientState()),
    [hasInjectedQueryOptions],
  );
  const currentOptions: BuildTeacherStudentRosterOptions = { academyId, search, page, pageSize };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(currentOptions, supabaseClientState);
  const rosterQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
    placeholderData: keepPreviousData,
  });
  const listView = rosterQuery.data;

  return (
    <section className="grid gap-4" aria-label="담당 원생">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <ListSearchField
            label="원생 검색"
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="이름, 악기, 요일"
          />
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="담당 원생 명단을 불러오지 못했습니다."
            detail={toUserMessage(supabaseClientState.error)}
          />
        ) : null}

        {rosterQuery.isError ? (
          <ListStatusAlert
            message="담당 원생 명단을 불러오지 못했습니다."
            detail={toUserMessage(rosterQuery.error)}
          />
        ) : null}

        {rosterQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">담당 원생 명단을 불러오는 중입니다.</p>
        ) : null}

        {listView && !rosterQuery.isError ? (
          <>
            <RosterTable rows={listView.items} />
            <ListPagination
              itemLabel="원생"
              countUnit="명"
              view={listView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function RosterTable({ rows }: { rows: TeacherStudentRosterRow[] }) {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">담당 원생이 없습니다.</p>;
  }

  return (
    <Table aria-label="담당 원생 목록">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">원생</TableHead>
          <TableHead className="px-4 py-3">악기</TableHead>
          <TableHead className="px-4 py-3">정기 요일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.studentId}>
            <TableCell label="원생" className="px-4 py-3 font-medium">
              {row.name}
            </TableCell>
            <TableCell label="악기" className="px-4 py-3">
              {row.instrumentNames.join(", ") || "-"}
            </TableCell>
            <TableCell label="정기 요일" className="px-4 py-3">
              {row.weekdayLabels.join(", ") || "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function createDefaultQueryOptions(
  options: BuildTeacherStudentRosterOptions,
  clientState: SupabaseClientState | null,
): TeacherStudentRosterQueryOptions {
  if (!clientState || clientState.error) {
    return {
      queryKey: ["teacher-roster", "unavailable", options.academyId],
      queryFn: async () => {
        throw clientState?.error ?? new Error("Supabase client 상태를 만들지 못했습니다.");
      },
    };
  }

  return createTeacherStudentRosterQueryOptions(clientState.client, options);
}

function createSupabaseClientState(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return { client: client as TeacherStudentRosterSupabaseClient, error: null };
  } catch (error) {
    return { client: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

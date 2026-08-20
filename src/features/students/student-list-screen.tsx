"use client";

import { useMemo, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { RotateCcw, UserPlus } from "lucide-react";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
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
  BuildStudentListOptions,
  StudentListRow,
} from "@/domain/student-list";
import {
  createStudentListQueryOptions,
  type StudentListSupabaseClient,
} from "@/lib/api/students";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StudentListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<StudentListRow>>;
};

export type StudentListQueryOptionsFactory = (
  options: BuildStudentListOptions,
) => StudentListQueryOptions;

type StudentListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: StudentListQueryOptionsFactory;
};

type SupabaseClientState =
  | {
      client: StudentListSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

export function StudentListScreen({
  academyId,
  academyName,
  queryOptionsFactory,
}: StudentListScreenProps) {
  const [search, setSearch] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [weekdayLabel, setWeekdayLabel] = useState("");
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createStudentListSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildStudentListOptions = {
    academyId,
    search,
    filters: {
      teacherName: teacherName || undefined,
      instrumentName: instrumentName || undefined,
      weekdayLabel: weekdayLabel || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const studentListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const students = studentListQuery.data?.items ?? [];
  const filterOptions = buildFilterOptions(studentListQuery.data?.items ?? []);

  return (
    <section className="grid gap-4" aria-labelledby="student-list-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="student-list-heading" className="text-2xl font-semibold">
            원생 목록
          </h2>
        </div>
        <Button type="button">
          <UserPlus aria-hidden="true" />
          원생 등록
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_repeat(3,11rem)_auto]">
          <ListSearchField
            label="원생 검색"
            value={search}
            onChange={setSearch}
            placeholder="이름, 선생님, 악기, 요일"
          />

          <ListFilterSelect
            label="선생님 필터"
            value={teacherName}
            options={filterOptions.teacherNames}
            onChange={setTeacherName}
          />
          <ListFilterSelect
            label="악기 필터"
            value={instrumentName}
            options={filterOptions.instrumentNames}
            onChange={setInstrumentName}
          />
          <ListFilterSelect
            label="요일 필터"
            value={weekdayLabel}
            options={filterOptions.weekdayLabels}
            onChange={setWeekdayLabel}
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setTeacherName("");
              setInstrumentName("");
              setWeekdayLabel("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 원생 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {studentListQuery.isError ? (
          <ListStatusAlert
            message="원생 목록을 불러오지 못했습니다."
            detail={studentListQuery.error.message}
          />
        ) : null}

        {studentListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            원생 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!studentListQuery.isLoading &&
        !studentListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <StudentListTable students={students} />
        ) : null}
      </div>
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildStudentListOptions,
  supabaseClientState: SupabaseClientState,
): StudentListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.students.list(options.academyId, {
        q: options.search,
        teacherName: options.filters?.teacherName,
        instrumentName: options.filters?.instrumentName,
        weekdayLabel: options.filters?.weekdayLabel,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createStudentListQueryOptions(supabaseClientState.client, options);
}

function createStudentListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as StudentListSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createMissingSupabaseClientState(): SupabaseClientState {
  return {
    client: null,
    error: new Error("Supabase client 상태를 만들지 못했습니다."),
  };
}

function StudentListTable({ students }: { students: StudentListRow[] }) {
  if (students.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 원생이 없습니다.
      </p>
    );
  }

  return (
    <Table aria-label="원생 목록" className="min-w-[42rem]">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">원생</TableHead>
          <TableHead className="px-4 py-3">선생님</TableHead>
          <TableHead className="px-4 py-3">악기</TableHead>
          <TableHead className="px-4 py-3">정기 요일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => (
          <TableRow key={student.studentId}>
            <TableCell className="px-4 py-3 font-medium">
              {student.name}
            </TableCell>
            <TableCell className="px-4 py-3">
              {formatJoinedValue(student.teacherNames)}
            </TableCell>
            <TableCell className="px-4 py-3">
              {formatJoinedValue(student.instrumentNames)}
            </TableCell>
            <TableCell className="px-4 py-3">
              {formatJoinedValue(student.weekdayLabels)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function buildFilterOptions(students: StudentListRow[]) {
  return {
    teacherNames: uniqueSorted(
      students.flatMap((student) => student.teacherNames),
    ),
    instrumentNames: uniqueSorted(
      students.flatMap((student) => student.instrumentNames),
    ),
    weekdayLabels: uniqueSorted(
      students.flatMap((student) => student.weekdayLabels),
    ),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
}

function formatJoinedValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

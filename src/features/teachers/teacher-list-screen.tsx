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
  BuildTeacherListOptions,
  TeacherListRow,
} from "@/domain/teacher-list";
import { formatTeacherPayType } from "@/domain/teacher-list";
import type { TeacherPayType } from "@/domain/teacher";
import {
  createTeacherListQueryOptions,
  type TeacherListSupabaseClient,
} from "@/lib/api/teachers";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TeacherListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<TeacherListRow>>;
};

export type TeacherListQueryOptionsFactory = (
  options: BuildTeacherListOptions,
) => TeacherListQueryOptions;

type TeacherListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: TeacherListQueryOptionsFactory;
};

type SupabaseClientState =
  | {
      client: TeacherListSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const teacherPayTypeOptions: Array<{
  value: TeacherPayType;
  label: string;
}> = [
  { value: "monthly", label: formatTeacherPayType("monthly") },
  { value: "hourly", label: formatTeacherPayType("hourly") },
  { value: "ratio", label: formatTeacherPayType("ratio") },
];

export function TeacherListScreen({
  academyId,
  academyName,
  queryOptionsFactory,
}: TeacherListScreenProps) {
  const [search, setSearch] = useState("");
  const [part, setPart] = useState("");
  const [payType, setPayType] = useState<TeacherPayType | "">("");
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createTeacherListSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildTeacherListOptions = {
    academyId,
    search,
    filters: {
      part: part || undefined,
      payType: payType || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const teacherListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const teachers = teacherListQuery.data?.items ?? [];
  const filterOptions = buildFilterOptions(teacherListQuery.data?.items ?? []);

  return (
    <section className="grid gap-4" aria-labelledby="teacher-list-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="teacher-list-heading" className="text-2xl font-semibold">
            선생님 목록
          </h2>
        </div>
        <Button type="button">
          <UserPlus aria-hidden="true" />
          선생님 등록
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto]">
          <ListSearchField
            label="선생님 검색"
            value={search}
            onChange={setSearch}
            placeholder="이름, 담당 파트, 연락처, 급여"
          />

          <ListFilterSelect
            label="담당 파트 필터"
            value={part}
            options={filterOptions.parts}
            onChange={setPart}
          />
          <ListFilterSelect
            label="급여 형태 필터"
            value={payType}
            options={teacherPayTypeOptions}
            onChange={(nextPayType) =>
              setPayType(nextPayType as TeacherPayType | "")
            }
          />

          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setPart("");
              setPayType("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 선생님 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {teacherListQuery.isError ? (
          <ListStatusAlert
            message="선생님 목록을 불러오지 못했습니다."
            detail={teacherListQuery.error.message}
          />
        ) : null}

        {teacherListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            선생님 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!teacherListQuery.isLoading &&
        !teacherListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <TeacherListTable teachers={teachers} />
        ) : null}
      </div>
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildTeacherListOptions,
  supabaseClientState: SupabaseClientState,
): TeacherListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.teachers.list(options.academyId, {
        q: options.search,
        part: options.filters?.part,
        payType: options.filters?.payType,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createTeacherListQueryOptions(supabaseClientState.client, options);
}

function createTeacherListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as TeacherListSupabaseClient,
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

function TeacherListTable({ teachers }: { teachers: TeacherListRow[] }) {
  if (teachers.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 선생님이 없습니다.
      </p>
    );
  }

  return (
    <Table aria-label="선생님 목록" className="min-w-[44rem]">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">선생님</TableHead>
          <TableHead className="px-4 py-3">담당 파트</TableHead>
          <TableHead className="px-4 py-3">연락처</TableHead>
          <TableHead className="px-4 py-3">등록일</TableHead>
          <TableHead className="px-4 py-3">급여 형태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teachers.map((teacher) => (
          <TableRow key={teacher.teacherId}>
            <TableCell className="px-4 py-3 font-medium">
              {teacher.name}
            </TableCell>
            <TableCell className="px-4 py-3">{teacher.part}</TableCell>
            <TableCell className="px-4 py-3">
              {teacher.contact || "-"}
            </TableCell>
            <TableCell className="px-4 py-3">{teacher.registeredAt}</TableCell>
            <TableCell className="px-4 py-3">
              {formatTeacherPayType(teacher.payType)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function buildFilterOptions(teachers: TeacherListRow[]) {
  return {
    parts: uniqueSorted(teachers.map((teacher) => teacher.part)),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );
}

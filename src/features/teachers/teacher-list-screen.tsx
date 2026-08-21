"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { RotateCcw, UserPlus } from "lucide-react";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
import type { DemoTeacherRegistrationInput } from "@/lib/demo/academy-demo-state";
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
  registerTeacher?: (input: DemoTeacherRegistrationInput) => void;
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
  registerTeacher,
}: TeacherListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [part, setPart] = useState("");
  const [payType, setPayType] = useState<TeacherPayType | "">("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
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
        <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <UserPlus aria-hidden="true" />
              선생님 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>선생님 등록</DialogTitle>
              <DialogDescription>
                담당 파트와 급여 형태를 함께 등록합니다.
              </DialogDescription>
            </DialogHeader>
            <TeacherRegistrationForm
              onSubmit={(input) => {
                registerTeacher?.(input);
                setIsRegistrationOpen(false);
                void queryClient.invalidateQueries({
                  queryKey: [...queryKeys.academy(academyId), "teachers"],
                });
              }}
            />
          </DialogContent>
        </Dialog>
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

function TeacherRegistrationForm({
  onSubmit,
}: {
  onSubmit: (input: DemoTeacherRegistrationInput) => void;
}) {
  const [name, setName] = useState("");
  const [part, setPart] = useState("피아노");
  const [contact, setContact] = useState("");
  const [registeredAt, setRegisteredAt] = useState("2026-08-21");
  const [payType, setPayType] = useState<TeacherPayType>("monthly");
  const canSubmit = Boolean(name.trim() && part.trim() && contact.trim());

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!canSubmit) {
          return;
        }

        onSubmit({
          name: name.trim(),
          part: part.trim(),
          contact: contact.trim(),
          registeredAt,
          payType,
        });
      }}
    >
      <Label className="grid gap-1">
        <span>선생님명</span>
        <Input
          aria-label="선생님명"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>담당 파트</span>
          <Input
            aria-label="담당 파트"
            value={part}
            onChange={(event) => setPart(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>연락처</span>
          <Input
            aria-label="연락처"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>등록일</span>
          <Input
            aria-label="등록일"
            type="date"
            value={registeredAt}
            onChange={(event) => setRegisteredAt(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>급여 형태</span>
          <NativeSelect
            aria-label="급여 형태"
            value={payType}
            onChange={(event) => setPayType(event.target.value as TeacherPayType)}
          >
            {teacherPayTypeOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          저장
        </Button>
      </DialogFooter>
    </form>
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
    <div className="overflow-x-auto">
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
              <TableCell className="px-4 py-3">
                {teacher.registeredAt}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatTeacherPayType(teacher.payType)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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

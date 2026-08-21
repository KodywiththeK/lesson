"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { BookOpenCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { Badge } from "@/components/ui/badge";
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
import {
  formatBookSaleStatus,
  type BookPurchaseListRow,
  type BookSaleStatus,
  type BuildBookPurchaseListOptions,
} from "@/domain/book-sale";
import type { StudentListRow } from "@/domain/student-list";
import {
  createBookPurchaseListQueryOptions,
  registerBookRelease as registerBookReleaseApi,
  type BookReleaseMutationSupabaseClient,
  type BookPurchaseListSupabaseClient,
  type RegisterBookReleaseInput,
} from "@/lib/api/books";
import { queryKeys } from "@/lib/api/query-keys";
import {
  createStudentListQueryOptions,
  type StudentListSupabaseClient,
} from "@/lib/api/students";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type BookPurchaseListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<BookPurchaseListRow[]>;
};

export type BookPurchaseListQueryOptionsFactory = (
  options: BuildBookPurchaseListOptions,
) => BookPurchaseListQueryOptions;

type BookPurchaseListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: BookPurchaseListQueryOptionsFactory;
  students?: StudentListRow[];
  registerBookRelease?: (input: {
    studentId: string;
    studentName?: string;
    bookTitle: string;
    price: number;
    shippedAt: string;
    status: BookSaleStatus;
  }) => void | Promise<void>;
};

type BookPurchaseSupabaseClient = BookPurchaseListSupabaseClient &
  BookReleaseMutationSupabaseClient &
  StudentListSupabaseClient;

type SupabaseClientState =
  | {
      client: BookPurchaseSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const statusFilterOptions: Array<{
  value: BookSaleStatus;
  label: string;
}> = [
  { value: "payment-pending", label: formatBookSaleStatus("payment-pending") },
  { value: "paid", label: formatBookSaleStatus("paid") },
];

export function BookPurchaseListScreen({
  academyId,
  academyName,
  queryOptionsFactory,
  students = [],
  registerBookRelease,
}: BookPurchaseListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookSaleStatus | "">("");
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () =>
      hasInjectedQueryOptions ? null : createBookPurchaseListSupabaseClient(),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildBookPurchaseListOptions = {
    academyId,
    search,
    filters: {
      status: status || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const bookPurchaseListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const studentOptionsQuery = useQuery({
    ...createDefaultStudentOptionsQueryOptions(
      academyId,
      supabaseClientState ?? createMissingSupabaseClientState(),
    ),
    enabled: !students.length && !supabaseClientState?.error,
  });
  const studentOptions = students.length
    ? students
    : studentOptionsQuery.data?.items ?? [];
  const registerMutation = useMutation({
    mutationFn: async (input: {
      studentId: string;
      studentName?: string;
      bookTitle: string;
      price: number;
      shippedAt: string;
      status: BookSaleStatus;
    }) => {
      if (registerBookRelease) {
        await registerBookRelease(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await registerBookReleaseApi(supabaseClientState.client, {
        academyId,
        studentId: input.studentId,
        studentName: input.studentName ?? "",
        bookTitle: input.bookTitle,
        price: input.price,
        shippedAt: input.shippedAt,
        status: input.status,
      } satisfies RegisterBookReleaseInput);
    },
    onSuccess: () => {
      setIsReleaseOpen(false);
      toast.success("교재 출고를 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "books"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "finance"],
      });
    },
    onError: (error) => {
      toast.error("교재 출고 등록에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const purchases = bookPurchaseListQuery.data ?? [];

  return (
    <section className="grid gap-4" aria-labelledby="book-purchase-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="book-purchase-heading" className="text-2xl font-semibold">
            교재 구매 목록
          </h2>
        </div>
        <Dialog open={isReleaseOpen} onOpenChange={setIsReleaseOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <BookOpenCheck aria-hidden="true" />
              교재 출고
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>교재 출고</DialogTitle>
              <DialogDescription>
                원생에게 출고한 교재와 결제 상태를 기록합니다.
              </DialogDescription>
            </DialogHeader>
            <BookReleaseForm
              students={studentOptions}
              onSubmit={(input) => {
                registerMutation.mutate(input);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="교재 구매 검색"
            value={search}
            onChange={setSearch}
            placeholder="원생명, 교재명, 출고일"
          />
          <ListFilterSelect
            label="결제 상태 필터"
            value={status}
            options={statusFilterOptions}
            onChange={(nextStatus) =>
              setStatus(nextStatus as BookSaleStatus | "")
            }
          />
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 교재 구매 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {bookPurchaseListQuery.isError ? (
          <ListStatusAlert
            message="교재 구매 목록을 불러오지 못했습니다."
            detail={bookPurchaseListQuery.error.message}
          />
        ) : null}

        {bookPurchaseListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            교재 구매 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!bookPurchaseListQuery.isLoading &&
        !bookPurchaseListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <BookPurchaseListTable purchases={purchases} />
        ) : null}
      </div>
    </section>
  );
}

function BookReleaseForm({
  students,
  onSubmit,
}: {
  students: StudentListRow[];
  onSubmit: (input: {
    studentId: string;
    studentName?: string;
    bookTitle: string;
    price: number;
    shippedAt: string;
    status: BookSaleStatus;
  }) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [shippedAt, setShippedAt] = useState("2026-08-21");
  const [status, setStatus] = useState<BookSaleStatus>("payment-pending");
  const selectedStudent = students.find((student) => student.studentId === studentId);
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(bookTitle.trim()) &&
    price > 0 &&
    Boolean(shippedAt);

  return (
    <form
      aria-label="교재 출고 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!selectedStudent || !canSubmit) {
          return;
        }

        onSubmit({
          studentId: selectedStudent.studentId,
          studentName: selectedStudent.name,
          bookTitle,
          price,
          shippedAt,
          status,
        });
      }}
    >
      <Label className="grid gap-1">
        <span>원생</span>
        <NativeSelect
          aria-label="원생"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
        >
          <NativeSelectOption value="">원생 선택</NativeSelectOption>
          {students.map((student) => (
            <NativeSelectOption key={student.studentId} value={student.studentId}>
              {student.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <Label className="grid gap-1">
        <span>교재명</span>
        <Input
          aria-label="교재명"
          value={bookTitle}
          onChange={(event) => setBookTitle(event.target.value)}
        />
      </Label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>가격</span>
          <Input
            aria-label="가격"
            type="number"
            min={1}
            step={1000}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
          />
        </Label>
        <Label className="grid gap-1">
          <span>출고일</span>
          <Input
            aria-label="출고일"
            type="date"
            value={shippedAt}
            onChange={(event) => setShippedAt(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>결제 상태</span>
          <NativeSelect
            aria-label="결제 상태"
            value={status}
            onChange={(event) => setStatus(event.target.value as BookSaleStatus)}
          >
            <NativeSelectOption value="payment-pending">결제 대기</NativeSelectOption>
            <NativeSelectOption value="paid">결제 완료</NativeSelectOption>
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
  options: BuildBookPurchaseListOptions,
  supabaseClientState: SupabaseClientState,
): BookPurchaseListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.books.purchaseList(options.academyId, {
        q: options.search,
        status: options.filters?.status,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createBookPurchaseListQueryOptions(supabaseClientState.client, options);
}

function createDefaultStudentOptionsQueryOptions(
  academyId: string,
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.students.list(academyId),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createStudentListQueryOptions(supabaseClientState.client, {
    academyId,
  });
}

function createBookPurchaseListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as BookPurchaseSupabaseClient,
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

function BookPurchaseListTable({
  purchases,
}: {
  purchases: BookPurchaseListRow[];
}) {
  if (purchases.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 교재 구매 내역이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="교재 구매 목록" className="min-w-[46rem]">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">원생</TableHead>
          <TableHead className="px-4 py-3">교재명</TableHead>
          <TableHead className="px-4 py-3">가격</TableHead>
          <TableHead className="px-4 py-3">출고일</TableHead>
          <TableHead className="px-4 py-3">결제 상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((purchase) => (
          <TableRow key={purchase.saleId}>
            <TableCell className="px-4 py-3 font-medium">
              {purchase.studentName}
            </TableCell>
            <TableCell className="px-4 py-3">{purchase.bookTitle}</TableCell>
            <TableCell className="px-4 py-3">
              {formatWon(purchase.autoFilledPrice)}
            </TableCell>
            <TableCell className="px-4 py-3">{purchase.shippedAt}</TableCell>
            <TableCell className="px-4 py-3">
              <Badge
                variant={
                  purchase.status === "paid" ? "secondary" : "outline"
                }
              >
                {formatBookSaleStatus(purchase.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  );
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

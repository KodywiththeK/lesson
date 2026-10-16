"use client";

import { Search } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type ListSearchFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function ListSearchField({
  label,
  value,
  onChange,
  placeholder,
}: ListSearchFieldProps) {
  return (
    <Label className="grid gap-1 text-sm font-medium">
      <span>검색</span>
      <span className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={label}
          className="pl-9"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </span>
    </Label>
  );
}

type ListFilterOption = {
  value: string;
  label: string;
};

type ListFilterSelectProps = {
  label: string;
  value: string;
  options: Array<string | ListFilterOption>;
  onChange: (value: string) => void;
};

export function ListFilterSelect({
  label,
  value,
  options,
  onChange,
}: ListFilterSelectProps) {
  return (
    <Label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <NativeSelect
        aria-label={label}
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">전체</NativeSelectOption>
        {options.map((option) => {
          const normalizedOption =
            typeof option === "string" ? { value: option, label: option } : option;

          return (
            <NativeSelectOption
              key={normalizedOption.value}
              value={normalizedOption.value}
            >
              {normalizedOption.label}
            </NativeSelectOption>
          );
        })}
      </NativeSelect>
    </Label>
  );
}

export function ListStatusAlert({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail: string;
  /** 있으면 "다시 불러오기" 버튼을 보여 준다. */
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="m-4">
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        <p>{detail}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            다시 불러오기
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

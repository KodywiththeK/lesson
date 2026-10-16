"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatYearlyMetric, type YearlyMetric, type YearlyMetricPoint } from "@/domain/finance-yearly-metrics";
import { formatWon } from "./finance-shared";

/** 수입 계열은 수입색, 지출은 지출색, 악기 지표는 합계색. 색만으로 뜻을 전하지 않도록 제목과 표를 함께 둔다. */
const METRIC_COLORS: Record<YearlyMetric, string> = {
  "all-instruments": "var(--total)",
  instrument: "var(--total)",
  "academy-income": "var(--income)",
  expense: "var(--expense)",
};

/** 12개월 세로 막대 그래프. 같은 값을 읽을 수 있는 표를 화면 밖에 함께 두어 보조기기와 차트가 그려지지 않는 환경을 돕는다. */
export function FinanceYearlyChart({
  year,
  metric,
  series,
}: {
  year: number;
  metric: YearlyMetric;
  series: YearlyMetricPoint[];
}) {
  const title = `${year}년 ${formatYearlyMetric(metric)}`;
  const config: ChartConfig = {
    amount: { label: formatYearlyMetric(metric), color: METRIC_COLORS[metric] },
  };

  return (
    <figure aria-label={`${title} 월별 그래프`} className="grid gap-2">
      <figcaption className="text-base font-semibold">{title}</figcaption>
      <div className="overflow-x-auto">
        <div aria-hidden="true" className="min-w-[40rem]">
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <BarChart data={series} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis
                width={84}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => value.toLocaleString("ko-KR")}
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4}>
                <LabelList
                  dataKey="amount"
                  position="top"
                  fontSize={11}
                  className="fill-foreground"
                  formatter={(value) => Number(value).toLocaleString("ko-KR")}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </div>
      <div className="sr-only">
        <Table aria-label={`${title} 월별 금액`}>
          <TableHeader>
            <TableRow>
              <TableHead>월</TableHead>
              <TableHead>금액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.map((point) => (
              <TableRow key={point.month}>
                <TableHead scope="row">{point.label}</TableHead>
                <TableCell label="금액">{formatWon(point.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}

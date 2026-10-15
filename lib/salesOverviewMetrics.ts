import { listPeriods } from "@/lib/salesOverviewPeriod";

export type SalesMetricInput = {
  period_month: string;
  revenue: number | string;
  total_cost: number | string;
};

export type OutstandingMetricInput = {
  due_date: string;
  outstanding_amount: number | string;
};

export type MacroSeriesPoint = {
  period_month: string;
  revenue: number;
  cost: number;
  sales_profit: number;
  total_outstanding: number;
};

export type MacroRangeSummary = Omit<MacroSeriesPoint, "period_month">;

function month(value: string) {
  return value.slice(0, 7);
}

export function buildMacroSeries(
  startPeriod: string,
  endPeriod: string,
  salesRows: SalesMetricInput[],
  outstandingRows: OutstandingMetricInput[],
) {
  const periods = listPeriods(startPeriod, endPeriod);
  const byPeriod = new Map(periods.map((period) => [period, { revenue: 0, cost: 0, total_outstanding: 0 }]));
  let hasData = false;

  for (const row of salesRows) {
    hasData = true;
    const period = month(row.period_month);
    const current = byPeriod.get(period) ?? { revenue: 0, cost: 0, total_outstanding: 0 };
    current.revenue += Number(row.revenue) || 0;
    current.cost += Number(row.total_cost) || 0;
    byPeriod.set(period, current);
  }

  for (const row of outstandingRows) {
    hasData = true;
    const period = month(row.due_date);
    const current = byPeriod.get(period) ?? { revenue: 0, cost: 0, total_outstanding: 0 };
    current.total_outstanding += Number(row.outstanding_amount) || 0;
    byPeriod.set(period, current);
  }

  const series = [...byPeriod.entries()].map(([period_month, values]) => ({
    period_month,
    revenue: values.revenue,
    cost: values.cost,
    sales_profit: values.revenue - values.cost,
    total_outstanding: values.total_outstanding,
  }));
  return { series, hasData };
}

export function summarizeMacroSeries(series: MacroSeriesPoint[], hasData: boolean): MacroRangeSummary | null {
  if (!hasData) return null;
  return series.reduce((summary, row) => ({
    revenue: summary.revenue + row.revenue,
    cost: summary.cost + row.cost,
    sales_profit: summary.sales_profit + row.sales_profit,
    total_outstanding: summary.total_outstanding + row.total_outstanding,
  }), { revenue: 0, cost: 0, sales_profit: 0, total_outstanding: 0 });
}

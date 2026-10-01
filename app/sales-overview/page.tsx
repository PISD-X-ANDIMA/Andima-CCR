"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SalesOverview, { MacroPoint, MacroSummary } from "@/components/Sales Overview/SalesOverview";
import HeaderAccount from "@/components/headeraccount";

type ResponseBody = { data: { summary: MacroSummary; series: MacroPoint[] } };

function currentMonth() {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function offsetMonth(value: string, offset: number) {
  const date = new Date(`${value}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function SalesOverviewPage() {
  const endDefault = useMemo(() => currentMonth(), []);
  const [startPeriod, setStartPeriod] = useState(() => offsetMonth(endDefault, -2));
  const [endPeriod, setEndPeriod] = useState(endDefault);
  const [summary, setSummary] = useState<MacroSummary>(null);
  const [series, setSeries] = useState<MacroPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/analytics/macro?start_period=${startPeriod}&end_period=${endPeriod}`, { cache: "no-store" });
      const body = await response.json() as ResponseBody & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Data Sales Overview gagal dimuat.");
      setSummary(body.data.summary);
      setSeries(body.data.series);
    } catch (reason) {
      setSummary(null);
      setSeries([]);
      setError(reason instanceof Error ? reason.message : "Data Sales Overview gagal dimuat.");
    } finally {
      setIsLoading(false);
    }
  }, [endPeriod, startPeriod]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <header className="flex h-16 items-center justify-end border-b border-slate-200 bg-white px-6">
        <HeaderAccount />
      </header>
      <SalesOverview summary={summary} series={series} startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={setStartPeriod} onEndPeriodChange={setEndPeriod} onRefresh={() => void load()} isLoading={isLoading} error={error} />
    </>
  );
}

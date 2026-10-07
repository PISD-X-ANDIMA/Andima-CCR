"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import SalesOverview, { AlertRow, MacroPoint, MacroSummary } from "@/components/Sales Overview/SalesOverview";
import Header from "@/components/Header";

type ResponseBody = { data: { summary: MacroSummary; series: MacroPoint[]; alerts?: AlertRow[]; meta?: { can_upload?: boolean } } };

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
  const [canUpload, setCanUpload] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/analytics/macro?start_period=${startPeriod}&end_period=${endPeriod}`, { cache: "no-store" });
      const body = await response.json() as ResponseBody & { error?: { message?: string } };
      if (version !== requestVersion.current) return;
      if (!response.ok) throw new Error(body.error?.message ?? "Data Sales Overview gagal dimuat.");
      setSummary(body.data.summary);
      setSeries(body.data.series);
      setAlerts(body.data.alerts ?? []);
      setCanUpload(Boolean(body.data.meta?.can_upload));
    } catch (reason) {
      if (version !== requestVersion.current) return;
      setSummary(null);
      setSeries([]);
      setAlerts([]);
      setCanUpload(false);
      setError(reason instanceof Error ? reason.message : "Data Sales Overview gagal dimuat.");
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [endPeriod, startPeriod]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <Header pageName="Sales Overview" />
      <SalesOverview summary={summary} series={series} startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={setStartPeriod} onEndPeriodChange={setEndPeriod} onRefresh={() => void load()} isLoading={isLoading} error={error} alerts={alerts} canUpload={canUpload} />
    </>
  );
}

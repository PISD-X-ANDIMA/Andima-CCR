"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import SalesOverview, { AlertRow, MacroPoint, MacroSummary, RecentDocument } from "@/components/Sales Overview/SalesOverview";
import Header from "@/components/Header";
import { shiftPeriod } from "@/lib/salesOverviewPeriod";
import type { StaffOption } from "@/types/overdue";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

type ResponseBody = { data: { summary: MacroSummary; series: MacroPoint[]; alerts?: AlertRow[]; meta?: { can_upload?: boolean } } };
type DocumentsBody = { data: RecentDocument[] };
type StaffBody = { data: StaffOption[]; canAssign?: boolean };

function currentMonth() {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function SalesOverviewPage() {
  const endDefault = useMemo(() => currentMonth(), []);
  const [startPeriod, setStartPeriod] = useState(() => shiftPeriod(endDefault, -2));
  const [endPeriod, setEndPeriod] = useState(endDefault);
  const [summary, setSummary] = useState<MacroSummary>(null);
  const [series, setSeries] = useState<MacroPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [canAssign, setCanAssign] = useState(false);

  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setError(null);
    try {
      const refreshToken = Date.now().toString();
      const [response, documentsResponse, staffResponse] = await Promise.all([
        fetch(`/api/v1/analytics/macro?start_period=${startPeriod}&end_period=${endPeriod}&refresh=${refreshToken}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
        fetch(`/api/v1/documents/recent?view=overview&limit=5&refresh=${refreshToken}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
        fetch(`/api/v1/overdue/staff?refresh=${refreshToken}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
      ]);
      const body = await readJsonResponse<ResponseBody & { error?: { message?: string } }>(response);
      const documentsBody = await readJsonResponse<DocumentsBody & { error?: { message?: string } }>(documentsResponse);
      const staffBody = await readJsonResponse<StaffBody>(staffResponse);
      if (version !== requestVersion.current) return;
      if (!response.ok || !body?.data) throw new Error(responseMessage(body, "Data Sales Overview gagal dimuat."));
      setSummary(body.data.summary);
      setSeries(body.data.series);
      setAlerts(body.data.alerts ?? []);
      setDocuments(documentsResponse.ok ? documentsBody?.data ?? [] : []);
      setDocumentsError(documentsResponse.ok ? null : responseMessage(documentsBody, "Daftar dokumen gagal dimuat."));
      setStaffOptions(staffResponse.ok ? staffBody?.data ?? [] : []);
      setCanAssign(staffResponse.ok && Boolean(staffBody?.canAssign));
    } catch (reason) {
      if (version !== requestVersion.current) return;
      setSummary(null);
      setSeries([]);
      setAlerts([]);
      setDocuments([]);
      setDocumentsError(reason instanceof Error ? reason.message : "Daftar dokumen gagal dimuat.");
      setStaffOptions([]);
      setCanAssign(false);
      setError(reason instanceof Error ? reason.message : "Data Sales Overview gagal dimuat.");
    } finally {
      if (version === requestVersion.current) { setIsLoading(false); setStaffLoading(false); }
    }
  }, [endPeriod, startPeriod]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <Header pageName="Sales Overview" />
      <SalesOverview summary={summary} series={series} startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={setStartPeriod} onEndPeriodChange={setEndPeriod} onRefresh={() => void load()} isLoading={isLoading} error={error} alerts={alerts} documents={documents} documentsLoading={isLoading} documentsError={documentsError} staffOptions={staffOptions} staffLoading={staffLoading} canAssign={canAssign} />
    </>
  );
}

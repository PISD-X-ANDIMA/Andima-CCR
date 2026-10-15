"use client";

import React, { useMemo, useState } from "react";
import Header from "@/components/Header";
import type { OverdueInvoiceItem, WarningLetterParams } from "@/types/overdue";
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock3, FileText, Mail, Save, Settings2 } from "lucide-react";
import { createWarningLetterPdf, getWarningLetterLevel, PAYMENT_ACCOUNT, warningLetterFilePart } from "@/lib/warningLetter";

interface WarningLetterGeneratorProps {
  invoice: OverdueInvoiceItem;
  onBack: () => void;
}

export const WarningLetterGenerator: React.FC<WarningLetterGeneratorProps> = ({ invoice, onBack }) => {
  const level = getWarningLetterLevel(invoice.days_overdue);
  const issueDateDefault = useMemo(() => formatDateInput(new Date()), []);
  const registrationNumber = useMemo(
    () => `SP/ANDIMA-CCR/${new Date().getFullYear()}/${warningLetterFilePart(invoice.invoice_number).slice(-12)}`,
    [invoice.invoice_number],
  );
  const picName = invoice.pic_display_name || invoice.pic_assigned || "Credit Controller";
  const picRole = invoice.pic_role || "Credit Controller";
  const [params, setParams] = useState<WarningLetterParams>(() => ({
    escalationLevel: level ?? "SP-1",
    registrationNumber,
    issueDate: issueDateDefault,
    deadlineDate: `${issueDateDefault}T17:00`,
    picName,
    internalNotes: "",
  }));
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

  function notify(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  }

  function downloadLetter(kind: "draft" | "send") {
    if (!level || isDownloading) return;
    setIsDownloading(true);
    try {
      const prefix = kind === "draft" ? "Draft-SP" : `Surat-Peringatan-${params.escalationLevel}`;
      const filename = `${prefix}-${warningLetterFilePart(invoice.invoice_number)}.pdf`;
      createWarningLetterPdf(invoice, params, filename);
      notify(kind === "draft" ? "Draft surat berhasil diunduh." : `Surat ${params.escalationLevel} berhasil diunduh.`);
    } catch {
      notify("PDF gagal dibuat. Silakan coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  }

  if (!level) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Header pageName="Warning Letter Generator" />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <section className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
            <h1 className="text-base font-bold text-slate-950">Surat belum tersedia</h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Invoice ini baru overdue {invoice.days_overdue} hari dan belum memenuhi batas penerbitan surat peringatan.</p>
            <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#203d70] px-4 py-2 text-xs font-bold text-white"><ArrowLeft className="h-4 w-4" />Kembali</button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {toastMessage && <div role="status" className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"><CheckCircle2 className="h-4 w-4 text-emerald-400" />{toastMessage}</div>}
      <div className="min-h-screen">
        <Header pageName="Warning Letter Generator" />
        <main className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-5">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"><AlertTriangle className="h-5 w-5 text-rose-600" />Surat Peringatan</h1><span className="rounded bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-800">{invoice.risk_status}</span></div><p className="mt-1 text-xs text-slate-500">Parameter surat dikunci dari status overdue invoice yang dipilih.</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />Kembali</button><button type="button" onClick={() => downloadLetter("draft")} disabled={isDownloading} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><Save className="h-4 w-4" />{isDownloading ? "Membuat PDF..." : "Simpan Draf"}</button><button type="button" onClick={() => downloadLetter("send")} disabled={isDownloading} className="inline-flex items-center gap-2 rounded-md bg-[#203d70] px-4 py-2 text-xs font-bold text-white hover:bg-[#162a4d] disabled:cursor-wait disabled:opacity-60"><Mail className="h-4 w-4" />{isDownloading ? "Membuat PDF..." : "Kirim SP Sekarang"}</button></div>
          </header>

          <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center"><div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><h2 className="truncate text-base font-bold text-slate-950">{invoice.customer_name}</h2><p className="mt-1 text-xs text-slate-500">Invoice {invoice.invoice_number} - Jatuh tempo {invoice.due_date}</p><p className="mt-1 text-xs text-slate-500">{invoice.branch || "Cabang belum tersedia"} {invoice.branch_code ? `(${invoice.branch_code})` : ""}</p></div></div><div className="grid grid-cols-2 gap-3 text-right lg:block"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding</p><p className="mt-1 text-lg font-bold text-rose-600">{money(invoice.amount_overdue)}</p></div><div className="mt-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aging</p><p className="mt-1 text-sm font-bold text-rose-600">{invoice.days_overdue} hari</p></div></div></section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 pb-3"><Settings2 className="h-4 w-4 text-slate-600" /><h2 className="text-sm font-bold text-slate-900">Parameter Surat</h2></div><div className="mt-4 space-y-4"><ReadonlyField label="Tingkat eskalasi" value={params.escalationLevel} /><ReadonlyField label="Nomor registrasi" value={params.registrationNumber} /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Tanggal terbit"><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" /><input type="date" value={params.issueDate} onChange={(event) => setParams((current) => ({ ...current, issueDate: event.target.value }))} className={`${inputClass} pl-9`} /></div></Field><Field label="Batas akhir pelunasan"><div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" /><input type="datetime-local" value={params.deadlineDate} onChange={(event) => setParams((current) => ({ ...current, deadlineDate: event.target.value }))} className={`${inputClass} pl-9`} /></div></Field></div><ReadonlyField label="Credit controller bertanggung jawab" value={params.picName} /><ReadonlyField label="Catatan internal" value={params.internalNotes || "Tidak ada catatan internal."} multiline /></div></section>

            <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-lg"><div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700"><FileText className="h-4 w-4" />Preview surat</div><span className="text-[10px] font-semibold text-slate-400">Format A4</span></div><div className="space-y-4 font-serif text-[10px] leading-relaxed text-slate-900"><div className="border-b-2 border-slate-900 pb-3 text-center"><p className="font-sans text-sm font-black">PT ANDIMA TRANSPORTINDO</p><p className="font-sans text-[8px] font-bold uppercase tracking-wider text-slate-500">Surat Peringatan {params.escalationLevel}</p></div><div className="grid grid-cols-2 gap-3 font-sans text-[9px]"><div><p><strong>NOMOR:</strong> {params.registrationNumber}</p><p><strong>SIFAT:</strong> PENTING</p></div><div className="text-right"><p>{params.issueDate}</p><p className="font-bold text-rose-600">{invoice.days_overdue} hari overdue</p></div></div><div className="font-sans"><p className="font-bold">PERIHAL: PERMINTAAN PELUNASAN PIUTANG</p><p className="mt-3">Kepada Direksi dan Bagian Keuangan {invoice.customer_name},</p><p className="mt-2">Berdasarkan catatan kami, invoice {invoice.invoice_number} dengan nilai {money(invoice.amount_overdue)} belum diselesaikan sampai tanggal surat ini.</p></div><div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-center font-sans"><p className="text-[9px] font-bold uppercase text-rose-600">Batas pelunasan</p><p className="mt-1 text-sm font-black text-rose-700">{params.deadlineDate.replace("T", " ")}</p></div><div className="rounded-md border border-blue-200 bg-blue-50 p-3 font-sans"><p className="text-[9px] font-bold uppercase text-blue-700">Informasi pembayaran</p><p className="mt-1">{PAYMENT_ACCOUNT.bank}</p><p>No. Rekening: {PAYMENT_ACCOUNT.number}</p><p>a.n. {PAYMENT_ACCOUNT.holder}</p></div><p className="font-sans">Mohon pelunasan dilakukan melalui rekening tersebut. Hubungi {params.picName} untuk konfirmasi pembayaran.</p><div className="border-t border-slate-200 pt-4 text-center font-sans text-[9px]"><p>Hormat kami,</p><p className="mt-8 font-bold">{params.picName}</p><p className="text-slate-500">{picRole}</p><p className="text-slate-500">PT Andima Transportindo</p></div></div></section>
          </div>
        </main>
      </div>
    </div>
  );
};

const inputClass = "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";
const readonlyClass = "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600";

function ReadonlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return <div><p className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</p>{multiline ? <div className={`${readonlyClass} min-h-16 whitespace-pre-wrap`}>{value}</div> : <div className={readonlyClass}>{value}</div>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}<span className="mt-1 block normal-case tracking-normal">{children}</span></label>;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default WarningLetterGenerator;

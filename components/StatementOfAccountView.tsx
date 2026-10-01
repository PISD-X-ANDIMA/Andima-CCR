"use client";

import React, { useState, useEffect } from "react";
import { StatementOfAccountData } from "@/types/customer";

interface StatementOfAccountViewProps {
  customerId: string;
  onBack: () => void;
}

export const StatementOfAccountView: React.FC<StatementOfAccountViewProps> = ({
  customerId,
  onBack,
}) => {
  const [statementData, setStatementData] = useState<StatementOfAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/customers/${customerId}/statement`)
      .then((res) => res.json())
      .then((data) => setStatementData(data))
      .catch((err) => console.error("Failed to load statement:", err))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading || !statementData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-md border border-slate-200">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-slate-700">Memuat Kartu Piutang Pelanggan...</span>
        </div>
      </div>
    );
  }

  const filteredMutations = statementData.mutations.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.reference_no.toLowerCase().includes(q) ||
      m.cargo_description.toLowerCase().includes(q) ||
      (m.bl_number && m.bl_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-12">
      {/* Top Header Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200/80 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>CCR MODULE</span>
            <span>&gt;</span>
            <span>CUSTOMER ANALYTICS</span>
            <span>&gt;</span>
            <span>KARTU PIUTANG</span>
            <span>&gt;</span>
            <span className="font-bold text-slate-900 uppercase">{statementData.legal_entity} ({statementData.customer_id})</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Page Title & Action Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Kartu Piutang Pelanggan (Statement of Account)
                </h1>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-xs font-bold">
                  REV-2026.07
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onBack}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Analisis Pelanggan
            </button>

            <button className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
              <span>🖨️</span>
              <span>Cetak PDF</span>
            </button>

            <button className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5">
              <span>📥</span>
              <span>Unduh .XLSX</span>
            </button>

            <button className="px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Kirim Tagihan / SP
            </button>
          </div>
        </div>

        {/* Customer Header Details Card Banner */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#3B6FF5]/10 text-[#3B6FF5] flex items-center justify-center font-extrabold text-lg shrink-0">
              AB
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900">
                  {statementData.customer_name}
                </h2>
                <span className="text-xs font-bold text-slate-500">
                  ({statementData.legal_entity})
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-extrabold text-xs">
                  {statementData.customer_id}
                </span>
              </div>

              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {statementData.status_badge}
              </div>

              <div className="mt-3 flex items-center gap-6 text-xs text-slate-500 flex-wrap">
                <div>
                  <span className="font-semibold text-slate-400">NPWP: </span>
                  <span className="font-bold text-slate-800">{statementData.npwp}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Kategori: </span>
                  <span className="font-bold text-slate-800">{statementData.category}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Segmentasi: </span>
                  <span className="font-bold text-slate-800">{statementData.segmentation}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Contacts Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 text-xs shrink-0 w-full lg:w-auto">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">HUB UTAMA KONTRAK</span>
              <span className="font-extrabold text-slate-900 block mt-0.5">{statementData.main_hub}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">PIC ACCOUNT OFFICER</span>
              <span className="font-extrabold text-slate-900 block mt-0.5">{statementData.pic_account_officer.name}</span>
              <span className="text-[11px] text-slate-500 font-medium">{statementData.pic_account_officer.phone}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">KONTAK FINANCE KLIEN</span>
              <span className="font-extrabold text-slate-900 block mt-0.5">{statementData.client_finance_contact.name}</span>
              <span className="text-[11px] text-blue-600 font-medium">{statementData.client_finance_contact.email}</span>
            </div>
          </div>
        </div>

        {/* 4 Financial Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Plafon Kredit */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">PLAFON KREDIT DISETUJUI</span>
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {formatRupiah(statementData.credit_limit)}
            </div>
            <div className="mt-2 text-[11px] font-semibold text-slate-500 flex justify-between">
              <span>Siklus Review: Tahunan</span>
              <span className="font-bold text-blue-600">{statementData.review_cycle}</span>
            </div>
          </div>

          {/* Piutang Berjalan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">PIUTANG BERJALAN (OUTSTANDING)</span>
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-xl font-extrabold text-blue-600">
              {formatRupiah(statementData.outstanding_balance)}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>Pemakaian Plafon</span>
                <span className="font-bold text-slate-800">{statementData.credit_usage_percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${statementData.credit_usage_percent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Saldo Lewat Jatuh Tempo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">SALDO LEWAT JATUH TEMPO</span>
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {formatRupiah(statementData.overdue_balance)}
            </div>
            <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{statementData.overdue_status_text}</span>
            </div>
          </div>

          {/* Ketepatan Bayar & Rata DSO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">KETEPATAN BAYAR &amp; RATA DSO</span>
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {statementData.payment_accuracy}% <span className="text-xs font-medium text-slate-500">/ {statementData.avg_dso_days} Hari</span>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-slate-500 flex justify-between">
              <span>Kebijakan Kontrak:</span>
              <span className="font-bold text-slate-900">TOP {statementData.top_days_policy} Hari</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
              <span>📅 Periode:</span>
              <span className="font-bold text-slate-900">Januari 2026 - Juli 2026 (YTD)</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
              <span>Status:</span>
              <span className="font-bold text-slate-900">Semua Status</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
              <span>Rute:</span>
              <span className="font-bold text-slate-900">Semua Rute Operasional</span>
            </div>
          </div>

          <div className="w-full md:w-72">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. Faktur, No. B/L, atau PD..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Buku Mutasi Piutang Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Table Header Subtitle */}
          <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-extrabold text-slate-900 uppercase">
                Buku Mutasi Piutang &amp; Penerimaan Pembayaran
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                {filteredMutations.length} Mutasi Ditemukan
              </span>
            </div>

            <div className="text-[11px] font-semibold text-slate-500">
              Metode Pembukuan: <span className="font-bold text-slate-800">FIFO (First-In, First-Out)</span> | Mata Uang: <span className="font-bold text-slate-800">IDR (Rupiah)</span>
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="px-5 py-3.5">TGL TRANSAKSI &amp; REFERENSI</th>
                  <th className="px-5 py-3.5">DESKRIPSI MUATAN &amp; RUTE LOGISTIK</th>
                  <th className="px-4 py-3.5">TGL JATUH TEMPO</th>
                  <th className="px-4 py-3.5 text-right">DEBET / NILAI FAKTUR (IDR)</th>
                  <th className="px-4 py-3.5 text-right">KREDIT / BAYAR MASUK (IDR)</th>
                  <th className="px-4 py-3.5 text-right">SALDO KUMULATIF (IDR)</th>
                  <th className="px-5 py-3.5 text-center">STATUS &amp; DOKUMEN</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredMutations.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 align-top">
                      <div className="font-extrabold text-slate-900">{row.trans_date}</div>
                      <div className="font-bold text-blue-700 text-[11px] mt-0.5">{row.reference_no}</div>
                      {row.bl_number && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{row.bl_number}</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 align-top">
                      <div className="font-semibold text-slate-800 whitespace-pre-line leading-relaxed">
                        {row.cargo_description}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-top font-bold text-slate-600">
                      {row.due_date || "-"}
                    </td>

                    <td className="px-4 py-3.5 align-top text-right font-extrabold text-slate-900">
                      {row.debit > 0 ? formatRupiah(row.debit) : "-"}
                    </td>

                    <td className="px-4 py-3.5 align-top text-right font-extrabold text-emerald-600">
                      {row.credit > 0 ? `(${formatRupiah(row.credit)})` : "Rp 0"}
                    </td>

                    <td className="px-4 py-3.5 align-top text-right font-extrabold text-slate-900">
                      {formatRupiah(row.cumulative_balance)}
                    </td>

                    <td className="px-5 py-3.5 align-top text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                        row.status.includes('Lunas')
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.status.includes('Belum Lunas')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.status}
                      </span>
                      {row.doc_action && (
                        <button className="block mx-auto mt-1 text-[11px] font-bold text-blue-600 hover:underline">
                          👁️ {row.doc_action}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot>
                <tr className="bg-slate-100 font-extrabold text-xs border-t-2 border-slate-300">
                  <td colSpan={3} className="px-5 py-4 text-slate-900">
                    TOTAL MUTASI &amp; SALDO AKHIR BERJALAN (NET OUTSTANDING)
                  </td>
                  <td className="px-4 py-4 text-right text-slate-900">
                    Rp 1,082,000,000
                  </td>
                  <td className="px-4 py-4 text-right text-emerald-600">
                    (Rp 1,000,000,000)
                  </td>
                  <td className="px-4 py-4 text-right text-blue-700 text-sm">
                    {formatRupiah(statementData.outstanding_balance)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-extrabold tracking-wide uppercase">
                      ✅ REKONSILIASI COCOK
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bottom 2 Cards Grid Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Rekonsiliasi Bank & Mutasi Terakhir */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Rekonsiliasi Bank &amp; Mutasi Terakhir
                    </h3>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-extrabold">
                  Auto-Match 100% (Host-to-Host)
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {statementData.bank_reconciliations.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900">{item.bank_name} <span className="font-normal text-slate-500">({item.account_no})</span></div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">{item.reference_no}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-emerald-600">+{formatRupiah(item.amount)}</div>
                      <div className="text-[10px] font-bold text-blue-600 mt-0.5">✓ {item.matched_invoice}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Semua mutasi telah mendapatkan verifikasi Kasir Pusat &amp; Rekonsiliasi Otomatis ERP.
              </span>
              <button className="font-bold text-blue-600 hover:underline text-xs">
                Audit Trail Penerimaan &gt;
              </button>
            </div>
          </div>

          {/* Card 2: Klausul Kredit & Perjanjian Termin */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Klausul Kredit &amp; Perjanjian Termin
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  AGR-2025/11-09
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>Term of Payment (TOP): 30 Hari Kalender</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Terhitung sejak Surat Tanda Penerimaan Faktur (STPF) ditandatangani atau e-Faktur terbit melalui e-Tax Portal ANDIMA.
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>Klausul Penahanan Bill of Lading (R/L Hold)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    B/L Original otomatis di-hold jika total tunggakan melampaui 90% plafon kredit atau terdapat invoice jatuh tempo &gt; 14 hari.
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>Deposit Kontainer &amp; Bebas Demurrage</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Bebas masa sewa demurrage: 7 hari kalender di pelabuhan muat &amp; bongkar. Jaminan kontainer tertanggung Bank Garansi aktif.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Status Legalitas: <span className="font-bold text-emerald-700">PKS Terverifikasi Legal Dept</span>
              </span>
              <button className="font-bold text-blue-600 hover:underline text-xs">
                Lihat Surat Perjanjian &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementOfAccountView;

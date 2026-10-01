"use client";

import React, { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/Header";
import { OverdueInvoiceItem, WarningLetterParams } from "@/types/overdue";

interface WarningLetterGeneratorProps {
  invoice: OverdueInvoiceItem;
  onBack: () => void;
}

export const WarningLetterGenerator: React.FC<WarningLetterGeneratorProps> = ({
  invoice,
  onBack,
}) => {
  const [params, setParams] = useState<WarningLetterParams>({
    escalationLevel: "SP-2",
    registrationNumber: `SP2/ANDIMA-CCR/VIII/2026/0842`,
    issueDate: "2026-09-28",
    deadlineDate: "2026-10-01T17:00",
    picName: "Hendra Kusuma (Wilayah Jawa & Kaltim)",
    escrowBank: "mandiri",
    channels: {
      email: true,
      whatsapp: true,
      courier: true,
      portal: true,
    },
    attachSoa: true,
    attachStpf: true,
    internalNotes: "Tuliskan catatan internal penagihan khusus untuk tim legal, auditor, atau instruksi serah terima fisik langsung di meja direksi...",
  });

  const [isPreviewPdfModal, setIsPreviewPdfModal] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSendSp = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setToastMsg(`Surat Peringatan (${params.escalationLevel}) berhasil diterbitkan dan didistribusikan secara multi-channel!`);
      setTimeout(() => {
        onBack();
      }, 2000);
    }, 1500);
  };

  const handleDownloadPdf = () => {
    setToastMsg("Draf Surat Peringatan (.PDF) berhasil diunduh!");
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      <Sidebar />

      <div className="flex flex-col min-h-screen transition-all duration-300 lg:pl-[260px]">
        {/* Top Header */}
        <Header />

        <main className="flex-1 p-6 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
          {/* Action Top Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>⚠️</span> Penerbitan Surat Peringatan Tagihan (SP)
                </h1>
                <span className="px-3 py-1 rounded bg-rose-100 text-rose-800 font-extrabold text-xs uppercase tracking-wider">
                  ESKALASI HUKUM TAHAP 2
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Generate, sesuaikan draf somasi resmi, dan kirim multi-channel ke penanggung jawab keuangan debitur.
              </p>
            </div>

            {/* Top Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>←</span>
                <span>Kembali ke Overdue Alerts</span>
              </button>

              <button
                onClick={() => setToastMsg("Draf tersimpan secara lokal.")}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>💾</span>
                <span>Simpan Draf</span>
              </button>

              <button
                onClick={() => setIsPreviewPdfModal(true)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>👁️</span>
                <span>Pratinjau PDF</span>
              </button>

              <button
                onClick={handleSendSp}
                disabled={isSending}
                className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2"
              >
                <span>✉️</span>
                <span>{isSending ? "Mengirim SP..." : "Kirim SP Sekarang"}</span>
              </button>
            </div>
          </div>

          {/* Customer Header Info Banner Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-base shrink-0">
                🏢
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-extrabold text-slate-900">{invoice.customer_name}</h2>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-xs">
                    {invoice.branch_code}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-3 flex-wrap">
                  <span>NPWP: <strong className="text-slate-800">{invoice.npwp}</strong></span>
                  <span>•</span>
                  <span>Faktur: <strong className="text-blue-700">INV-2026/07-8841</strong></span>
                  <span>•</span>
                  <span>Rute: <strong className="text-slate-800">{invoice.route}</strong></span>
                  <span>•</span>
                  <span>Jatuh Tempo: <strong className="text-rose-600">15 Juli 2026</strong></span>
                </div>
              </div>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 text-xs space-y-1.5 shrink-0 w-full lg:w-auto">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase">TOTAL TUNGGAKAN</span>
                <span className="text-lg font-black text-rose-600">{formatRupiah(1250000000)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase">DURASI TERLAMBAT</span>
                <span className="font-extrabold text-rose-600">75 Hari <span className="text-rose-700 font-black">Kritis</span></span>
              </div>
              <div className="text-[10px] text-rose-600 font-medium pt-1.5 border-t border-rose-200 leading-tight">
                ⚠️ <strong className="font-bold">SANKSI OPERASIONAL OTOMATIS</strong><br />
                Penahanan B/L pelayaran, pembekuan booking slot kontainer Tanjung Perak, serta delegasi legal partner.
              </div>
            </div>
          </div>

          {/* Main 2-Column Section */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="xl:col-span-7 space-y-6">
              {/* Parameter Surat Peringatan Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>⚙️</span> Parameter Surat Peringatan
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">STEP 1 OF 3</span>
                </div>

                {/* Level Escalation Buttons */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">TINGKAT ESKALASI SURAT</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { level: "SP-1", label: "SP-1 (Toleransi 7 Hari)" },
                      { level: "SP-2", label: "! SP-2 (Teguran Keras)" },
                      { level: "SP-3", label: "SP-3 / Somasi Hukum" },
                    ].map((item) => {
                      const isActive = params.escalationLevel === item.level;
                      return (
                        <button
                          key={item.level}
                          type="button"
                          onClick={() => setParams({ ...params, escalationLevel: item.level as any })}
                          className={`py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all ${
                            isActive
                              ? "bg-[#0F172A] text-white shadow-md"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">NOMOR REGISTRASI SURAT</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={params.registrationNumber}
                        onChange={(e) => setParams({ ...params, registrationNumber: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs cursor-pointer" title="Copy">📋</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">TANGGAL TERBIT DOKUMEN</label>
                    <input
                      type="date"
                      value={params.issueDate}
                      onChange={(e) => setParams({ ...params, issueDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">BATAS AKHIR PELUNASAN (DEADLINE)</label>
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-rose-700 text-xs flex items-center gap-1.5">
                        <span>⏰</span>
                        <span>01 Oktober 2026 (17:00 WIB)</span>
                      </div>
                      <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                        Tenggat 3 Hari Kerja sesuai SOP Somasi Niaga
                      </div>
                    </div>
                    <input
                      type="datetime-local"
                      value={params.deadlineDate}
                      onChange={(e) => setParams({ ...params, deadlineDate: e.target.value })}
                      className="bg-white border border-rose-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">CREDIT CONTROLLER BERTANGGUNG JAWAB</label>
                  <input
                    type="text"
                    value={params.picName}
                    onChange={(e) => setParams({ ...params, picName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">REKENING PENAMPUNGAN KHUSUS (OFFICIAL ESCROW ACCOUNT)</label>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className={`p-3 rounded-xl border cursor-pointer font-bold transition ${params.escrowBank === 'mandiri' ? 'bg-blue-50 border-blue-600 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        name="escrow"
                        checked={params.escrowBank === 'mandiri'}
                        onChange={() => setParams({ ...params, escrowBank: 'mandiri' })}
                        className="mr-2 accent-blue-600"
                      />
                      <span>Bank Mandiri Escrow</span>
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">001-992-81726 (PT Andima Multimoda)</span>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer font-bold transition ${params.escrowBank === 'bca' ? 'bg-blue-50 border-blue-600 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <input
                        type="radio"
                        name="escrow"
                        checked={params.escrowBank === 'bca'}
                        onChange={() => setParams({ ...params, escrowBank: 'bca' })}
                        className="mr-2 accent-blue-600"
                      />
                      <span>BCA Corporate Account</span>
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">5410-09-221 (PT Andima Multimoda)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Saluran Distribusi Multi-Channel Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>📡</span> Saluran Distribusi Multi-Channel
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                    4 KANAL AKTIF
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={params.channels.email}
                      onChange={(e) => setParams({ ...params, channels: { ...params.channels, email: e.target.checked } })}
                      className="mt-0.5 w-4 h-4 rounded accent-[#0F172A]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Surel Resmi Direksi &amp; Finance (Certified Email Dispatch)</span>
                        <span className="text-[10px] font-bold text-emerald-700">DKIM &amp; TLS 1.3 Verified</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Kepada: Bambang Wicaksono (Finance Director &lt;bambang@samuderaprk.co.id&gt;)<br />
                        CC: legal@samuderaprk.co.id | audit-internal@andima.co.id
                      </div>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={params.channels.whatsapp}
                      onChange={(e) => setParams({ ...params, channels: { ...params.channels, whatsapp: e.target.checked } })}
                      className="mt-0.5 w-4 h-4 rounded accent-[#0F172A]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">WhatsApp Corporate Notifier Gateway</span>
                        <span className="text-[10px] font-bold text-emerald-700">BSP META VERIFIED</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        No. Penanggung Jawab: +62 811-294-8812 (Direktur Keuangan) • Template: #ANDIMA_SP2_WARNING
                      </div>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={params.channels.courier}
                      onChange={(e) => setParams({ ...params, channels: { ...params.channels, courier: e.target.checked } })}
                      className="mt-0.5 w-4 h-4 rounded accent-[#0F172A]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Surat Fisik Kurir Khusus / Surat Tercatat Ekspedisi</span>
                        <span className="text-[10px] font-bold text-blue-700">Resi: AND-EXP-2609084</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Alamat Tujuan: Gedung Perkantoran Samudera Lt. 4, Jl. Tanjung Laut No. 42, Balikpapan Selatan 76114<br />
                        Armada: ANDIMA Express Balikpapan Hub • Estimasi Tiba: Besok Pagi, 09:00 WITA
                      </div>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={params.channels.portal}
                      onChange={(e) => setParams({ ...params, channels: { ...params.channels, portal: e.target.checked } })}
                      className="mt-0.5 w-4 h-4 rounded accent-[#0F172A]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">Portal Klien (Modal Interstitial Notification)</span>
                        <span className="text-[10px] font-bold text-rose-700">Blocking Interstitial</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Klien diwajibkan melakukan konfirmasi receipt sebelum dapat mengakses pemesanan kontainer baru.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Lampiran & Klausul Hukum Otomatis Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>📎</span> Lampiran &amp; Klausul Hukum Otomatis
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">AUTOMATED BINDING</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-extrabold text-slate-900">Sertakan Statement of Account (SoA) &amp; Faktur Asli</div>
                      <div className="text-[11px] text-slate-500">Rincian mutasi piutang periode Juli - September 2026 secara komprehensif.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={params.attachSoa}
                      onChange={(e) => setParams({ ...params, attachSoa: e.target.checked })}
                      className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <div>
                      <div className="font-extrabold text-slate-900">Lampirkan Surat Tanda Terima Muatan (STPF / Delivery Order)</div>
                      <div className="text-[11px] text-slate-500">Bukti fisik serah terima kontainer sah bertanda tangan pihak penerima.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={params.attachStpf}
                      onChange={(e) => setParams({ ...params, attachStpf: e.target.checked })}
                      className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase">CATATAN TAMBAHAN UNTUK PETUGAS PENAGIH / KURIR KHUSUS</label>
                  <textarea
                    rows={3}
                    value={params.internalNotes}
                    onChange={(e) => setParams({ ...params, internalNotes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive A4 Preview (5 cols) */}
            <div className="xl:col-span-5 space-y-3 sticky top-6">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5 text-blue-700 font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  LIVE INTERACTIVE PREVIEW
                </span>
                <span>• Standar Surat Somasi Hukum Niaga • A4 FORMAT [210 × 297 mm]</span>
              </div>

              {/* A4 Styled Preview Box */}
              <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-xl space-y-4 font-serif text-[10px] leading-relaxed text-slate-900 border-t-8 border-t-slate-900">
                {/* Letterhead */}
                <div className="text-center border-b-2 border-slate-900 pb-3 space-y-0.5">
                  <div className="font-sans text-sm font-black tracking-tight text-slate-900 uppercase">
                    PT ANDIMA MULTIMODA NUSANTARA
                  </div>
                  <div className="font-sans text-[8px] text-slate-600 font-bold uppercase tracking-wider">
                    LOGISTICS, HAULAGE &amp; MULTIMODAL MARINE FREIGHT SOLUTIONS
                  </div>
                  <div className="font-sans text-[8px] text-slate-500">
                    Menara Maritim Nusantara Lt. 18-20, Jl. Perak Timur No. 488, Surabaya 60165 | Telp: +62 31 329 8800 | Email: legal-ccr@andima.co.id | NPWP: 01.320.891.2-041.000
                  </div>
                </div>

                {/* Letter Header Meta */}
                <div className="grid grid-cols-2 text-[9px] font-sans">
                  <div>
                    <div><strong>NOMOR :</strong> {params.registrationNumber}</div>
                    <div><strong>SIFAT :</strong> PENTING &amp; RAHASIA (URGENT - TUNGGAKAN JATUH TEMPO)</div>
                    <div><strong>LAMPIRAN :</strong> 1 (Satu) Berkas Rekonsiliasi Faktur &amp; SoA</div>
                  </div>
                  <div className="text-right">
                    <div>Surabaya, <strong>28 September 2026</strong></div>
                    <div>Klasifikasi: Penagihan Piutang Macet (Overdue &gt; 60 Hari)</div>
                  </div>
                </div>

                {/* Subject & Recipient */}
                <div className="font-sans space-y-1">
                  <div className="font-extrabold text-slate-900 text-[10px] border-b border-slate-200 pb-1">
                    PERIHAL: SURAT PERINGATAN KEDUA (SP-2): TEGURAN PELUNASAN PIUTANG INVOICE NO. INV-2026/07-8841
                  </div>
                  <div className="text-[9px] pt-1">
                    Kepada Yang Terhormat,<br />
                    <strong>Direksi &amp; Bagian Keuangan (Credit Controller)</strong><br />
                    <strong className="text-blue-900">{invoice.customer_name}</strong><br />
                    Gedung Samudera Perdana Lt. 4, Jl. Tanjung Laut No. 42, Balikpapan Selatan, Kalimantan Timur
                  </div>
                </div>

                {/* Letter Body Paragraphs */}
                <div className="font-sans text-[9px] space-y-2 text-justify">
                  <p>Dengan hormat,</p>
                  <p>
                    Menindaklanjuti Surat Peringatan Pertama (SP-1) kami tertanggal <strong>18 Agustus 2026</strong> perihal kewajiban pelunasan atas jasa pengangkutan kontainer antarpulau rute <em>Tanjung Perak - Balikpapan Haulage</em>, hingga saat diterbitkannya surat ini, sistem rekonsiliasi keuangan kami mencatat belum adanya realisasi pembayaran ataupun kesepakatan restrukturisasi terjadwal dari pihak Saudara.
                  </p>
                  <p>
                    Adapun rincian kewajiban tertunggak yang telah melampaui batas waktu toleransi kredit operasional (Term of Payment) adalah sebagai berikut:
                  </p>

                  {/* Invoice Table */}
                  <table className="w-full text-center border-collapse text-[8px] font-sans my-2">
                    <thead>
                      <tr className="bg-slate-100 border border-slate-300 font-extrabold text-slate-800 uppercase">
                        <th className="p-1 border border-slate-300">NO. FAKTUR</th>
                        <th className="p-1 border border-slate-300">RINCIAN MUATAN</th>
                        <th className="p-1 border border-slate-300">JATUH TEMPO</th>
                        <th className="p-1 border border-slate-300">NILAI TAGIHAN</th>
                        <th className="p-1 border border-slate-300">KETERLAMBATAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border border-slate-300 font-semibold">
                        <td className="p-1 border border-slate-300 text-blue-700 font-bold">INV-2026/07-8841</td>
                        <td className="p-1 border border-slate-300">Freight &amp; Haulage 18x40ft GP</td>
                        <td className="p-1 border border-slate-300 text-rose-600 font-bold">15/07/2026</td>
                        <td className="p-1 border border-slate-300 font-extrabold">Rp 1.250.000.000</td>
                        <td className="p-1 border border-slate-300 text-slate-500 font-bold">(Waived)</td>
                      </tr>
                    </tbody>
                  </table>

                  <p>
                    Sehubungan dengan status keterlambatan yang telah mencapai <strong>75 (tujuh puluh lima) hari kalender</strong>, melalui surat ini kami memberikan tenggat waktu penyelesaian pembayaran secara penuh selambat-lambatnya pada:
                  </p>

                  {/* Red Highlight Deadline Box */}
                  <div className="p-2.5 bg-rose-50 border-2 border-rose-600 rounded-lg text-center font-sans">
                    <div className="text-[9px] font-bold text-rose-600 uppercase">BATAS WAKTU PELUNASAN FINAL SP-2</div>
                    <div className="text-xs font-black text-rose-700">Kamis, 01 Oktober 2026 — Pukul 17:00 WIB</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[8px] uppercase">
                      3 HARI KERJA TERSISA
                    </span>
                  </div>

                  <p>
                    Apabila sampai dengan batas waktu di atas Saudara tidak melaksanakan kewajiban pelunasan atau tidak mencapai nota kesepakatan tertulis dengan Divisi Credit Control kami, maka PT Andima Multimoda Nusantara dengan berat hati akan memberlakukan konsekuensi operasional dan hukum berupa:
                  </p>

                  <ul className="list-disc pl-4 space-y-1 font-medium text-slate-800">
                    <li>Penahanan Dokumen Bill of Lading (B/L) dan penangguhan pelepasan muatan berjalan di seluruh pelabuhan konsolidasi kami.</li>
                    <li>Pembekuan hak booking slot kapal &amp; armada darat (Blacklist akun) di seluruh jaringan terminal Andima Logistics.</li>
                    <li>Penerbitan Surat Peringatan Ketiga (SP-3 / Somasi Final) serta pelimpahan berkas perkara penagihan ke Kantor Hukum Rekanan (Advokat &amp; Kurator) untuk proses hukum perdata/niaga sesuai ketentuan perundang-undangan yang berlaku.</li>
                  </ul>

                  <p className="pt-1 font-semibold">
                    Pembayaran dapat disalurkan langsung melalui rekening resmi perusahaan berikut:<br />
                    <strong className="text-slate-900">Bank Mandiri Rek. Escrow 001-992-81726 a.n. PT ANDIMA MULTIMODA NUSANTARA</strong>
                  </p>
                </div>

                {/* Signatures & Stamp */}
                <div className="pt-3 border-t border-slate-200 font-sans grid grid-cols-2 text-center text-[8px]">
                  <div>
                    <div className="font-bold text-slate-600">HORMAT KAMI,</div>
                    <div className="my-2 p-1 bg-blue-50 border border-blue-200 rounded text-[7px] font-extrabold text-[#0F52BA]">
                      DIGITALLY SIGNED &amp; SEALED<br />
                      PT ANDIMA MULTIMODA<br />
                      verified_user CREDIT CONTROL &amp; RISK
                    </div>
                    <div className="font-extrabold text-slate-900">Hendra Kusuma, S.E., Ak.</div>
                    <div className="text-slate-500">Head of Credit Control &amp; Revenue</div>
                    <div className="text-[7px] text-slate-400 font-mono">ID: 2609-SP2-0842</div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-600">MENGETAHUI,</div>
                    <div className="my-3 font-serif text-sm font-bold text-slate-800 italic">Bambang S.</div>
                    <div className="font-extrabold text-slate-900">Bambang Supeno, M.M.</div>
                    <div className="text-slate-500">VP Multimodal Finance &amp; Accounting</div>
                  </div>
                </div>

                {/* Blockchain Ref Footer */}
                <div className="pt-2 border-t border-slate-100 font-sans text-[7px] text-slate-400 flex items-center justify-between">
                  <span>Validitas dokumen digital ini terenkripsi SHA-256 pada blockchain ledger ANDIMA.</span>
                  <span>DOC REF: ADM-SP2-772910</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Floating Control Status Bar */}
      <div className="fixed bottom-0 inset-x-0 lg:pl-[260px] bg-white border-t border-slate-200 p-3 shadow-2xl z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Draf surat tersinkronisasi otomatis (Tersimpan 10 detik lalu)
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">✓ Validasi Legal CCR Terpenuhi</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition"
            >
              Batal
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <span>Unduh Draf Surat (.PDF)</span>
            </button>

            <button
              onClick={handleSendSp}
              disabled={isSending}
              className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2"
            >
              <span>Kirim &amp; Eksekusi Distribusi (SP-2)</span>
            </button>
          </div>
        </div>
      </div>

      {/* PDF Modal Preview */}
      {isPreviewPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Pratinjau Dokumen Surat Peringatan (.PDF)</h3>
              <button onClick={() => setIsPreviewPdfModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>
            <div className="h-96 bg-slate-100 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 font-medium text-xs space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-2xl font-bold">
                📄
              </div>
              <p className="font-bold text-slate-800 text-sm">Dokumen PDF Berhasil Diformat &amp; Siap Diunduh</p>
              <p className="text-center max-w-md">
                Ref: {params.registrationNumber} • Format A4 Standar Hukum Niaga Indonesia dengan Digital Signature SHA-256.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsPreviewPdfModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setIsPreviewPdfModal(false);
                  handleDownloadPdf();
                }}
                className="px-5 py-2 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-700 shadow-md"
              >
                Unduh PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarningLetterGenerator;

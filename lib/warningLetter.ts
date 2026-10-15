import { jsPDF } from "jspdf";
import type { OverdueInvoiceItem, WarningLetterParams } from "@/types/overdue";

export const PAYMENT_ACCOUNT = {
  bank: "Bank Mandiri",
  number: "1234-5678-9012",
  holder: "PT Andima Transportindo",
} as const;

export function getWarningLetterLevel(daysOverdue: number): WarningLetterParams["escalationLevel"] | null {
  if (daysOverdue < 30) return null;
  if (daysOverdue <= 59) return "SP-1";
  if (daysOverdue <= 90) return "SP-2";
  return "SP-3";
}

export function warningLetterFilePart(value: string) {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "invoice";
}

export function createWarningLetterPdf(invoice: OverdueInvoiceItem, params: WarningLetterParams, filename: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  const right = 192;
  let y = 20;

  const addText = (text: string, size = 10, bold = false, align: "left" | "center" | "right" = "left") => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(text, align === "center" ? 105 : align === "right" ? right : left, y, { align });
  };

  const addWrapped = (text: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, right - left);
    pdf.text(lines, left, y);
    y += lines.length * (size * 0.48 + 1.8);
  };

  addText("PT ANDIMA TRANSPORTINDO", 15, true, "center");
  y += 6;
  addText(`SURAT PERINGATAN ${params.escalationLevel}`, 10, true, "center");
  y += 5;
  pdf.setDrawColor(20, 30, 45);
  pdf.line(left, y, right, y);
  y += 9;

  addText(`Nomor: ${params.registrationNumber}`, 9, true);
  y += 5;
  addText(`Tanggal terbit: ${params.issueDate}`, 9);
  y += 5;
  addText(`Kepada: ${invoice.customer_name}`, 9, true);
  y += 9;

  addWrapped("Perihal: Permintaan pelunasan piutang", 10, true);
  y += 3;
  addWrapped(`Berdasarkan catatan kami, invoice ${invoice.invoice_number} dengan nilai ${formatRupiah(invoice.amount_overdue)} belum diselesaikan sampai tanggal surat ini.`);
  y += 3;
  addWrapped(`Batas akhir pelunasan: ${params.deadlineDate.replace("T", " ")}`, 10, true);
  y += 3;
  addWrapped(`Pembayaran dapat dilakukan melalui ${PAYMENT_ACCOUNT.bank}, No. Rekening: ${PAYMENT_ACCOUNT.number}, a.n. ${PAYMENT_ACCOUNT.holder}.`);
  y += 3;
  const picRole = invoice.pic_role || "Credit Controller";
  addWrapped(`Untuk konfirmasi pembayaran, hubungi ${params.picName} selaku ${picRole}.`);
  if (params.internalNotes.trim()) {
    y += 3;
    addWrapped(`Catatan internal: ${params.internalNotes.trim()}`, 9);
  }

  y = Math.max(y + 12, 220);
  addText("Hormat kami,", 10, false, "center");
  y += 16;
  addText(params.picName, 10, true, "center");
  y += 5;
  addText(picRole, 9, false, "center");
  y += 5;
  addText("PT Andima Transportindo", 9, false, "center");

  pdf.save(filename);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

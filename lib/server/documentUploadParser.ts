import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as XLSX from "xlsx";
import { COMPANY_ALIASES, OUTSTANDING_ALIASES, normalize, numberValue, type DocumentType } from "@/lib/documentUploadValidation";

type PdfItem = { str: string; x: number; y: number };

export function parseFailureMessage(code: string) {
  return code === "PDF_TEXT_NOT_EXTRACTABLE"
    ? "PDF tidak memiliki text layer yang dapat dibaca."
    : code === "PDF_TABLE_NOT_FOUND"
      ? "Text PDF terbaca, tetapi baris tabel tidak ditemukan."
      : code === "MISSING_HEADER"
        ? "Header tabel tidak ditemukan atau tidak sesuai template."
        : code === "PDF_PARSE_FAILED"
          ? "PDF gagal dibaca oleh parser. Pastikan file tidak rusak dan memiliki text layer."
          : code === "EMPTY_WORKBOOK"
            ? "Workbook tidak berisi worksheet yang dapat dibaca."
            : "File tidak dapat diproses.";
}

function pdfItems(content: { items: unknown[] }): PdfItem[] {
  return content.items.flatMap((item) => {
    if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return [];
    const textItem = item as { str: string; transform: number[] };
    return textItem.str.trim() ? [{ str: textItem.str.trim(), x: textItem.transform[4], y: textItem.transform[5] }] : [];
  });
}

function nearest(items: PdfItem[], y: number, minX: number, maxX: number, tolerance = 7) {
  return items
    .filter((item) => item.x >= minX && item.x < maxX && Math.abs(item.y - y) <= tolerance)
    .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y) || a.x - b.x)[0]?.str ?? "";
}

function columnText(items: PdfItem[], y: number, minX: number, maxX: number, tolerance = 7) {
  return items
    .filter((item) => item.x >= minX && item.x < maxX && Math.abs(item.y - y) <= tolerance)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.str)
    .filter((value, index, values) => index === 0 || value !== values[index - 1])
    .join(" ");
}

async function parsePdf(buffer: Buffer, type: DocumentType) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const standardFontDataUrl = `${pathToFileURL(join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")).toString()}/`;
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as typeof globalThis & { pdfjsWorker?: typeof workerModule }).pdfjsWorker = workerModule;
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl,
      useSystemFonts: false,
      disableFontFace: true,
    }).promise;
    const rows: string[][] = [];
    let reportPeriod = "";
    let hasText = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      let items: PdfItem[];
      try {
        items = pdfItems(await page.getTextContent());
      } catch (error) {
        console.error("[document-upload] PDF page text extraction failed", {
          type,
          page: pageNumber,
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      hasText ||= items.length > 0;
      const periodItem = items.find((item) => /\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}/i.test(item.str));
      if (!reportPeriod && periodItem) {
        const match = periodItem.str.match(/(\d{4})-(\d{2})-\d{2}/);
        if (match) reportPeriod = `${match[1]}-${match[2]}`;
      }
      if (type === "COMPANY_SALES_REPORT") {
        for (const job of items.filter((item) => item.x < 75 && /\/[0-9]{2,}/.test(item.str))) {
          const customer = columnText(items, job.y, 75, 165);
          const revenue = nearest(items, job.y, 300, 390);
          const subTotal = nearest(items, job.y, 390, 470);
          const vat = nearest(items, job.y, 465, 530);
          const pph = nearest(items, job.y, 530, 590);
          const others = nearest(items, job.y, 590, 650);
          const dip = nearest(items, job.y, 650, 710);
          if (revenue) rows.push([reportPeriod, customer, revenue, subTotal, vat, pph, String((numberValue(others) ?? 0) + (numberValue(dip) ?? 0))]);
        }
      } else {
        for (const rowNumber of items.filter((item) => item.x < 65 && /^\d+$/.test(item.str))) {
          const job = nearest(items, rowNumber.y, 65, 200);
          const invoice = nearest(items, rowNumber.y, 190, 300);
          const customer = columnText(items, rowNumber.y, 295, 410);
          const mawb = nearest(items, rowNumber.y, 410, 530);
          const amount = nearest(items, rowNumber.y, 520, 640);
          const dueDate = nearest(items, rowNumber.y, 635, 715);
          const createDate = nearest(items, rowNumber.y, 715, 810);
          if (job && invoice && amount && dueDate) rows.push([invoice, customer, amount, dueDate, createDate, job, mawb]);
        }
      }
    }
    if (!hasText) throw new Error("PDF_TEXT_NOT_EXTRACTABLE");
    if (!rows.length) throw new Error("PDF_TABLE_NOT_FOUND");
    if (type === "COMPANY_SALES_REPORT") {
      if (!reportPeriod) throw new Error("MISSING_HEADER");
      return [["period", "customer", "revenue", "trucking cost", "handling cost", "storage cost", "other operational cost"], ...rows];
    }
    return [["invoice", "customer", "amount rp", "due date", "created date", "job", "mawb"], ...rows];
  } catch (error) {
    if (error instanceof Error && ["PDF_TEXT_NOT_EXTRACTABLE", "PDF_TABLE_NOT_FOUND", "MISSING_HEADER"].includes(error.message)) throw error;
    console.error("[document-upload] PDF parse failed", {
      type,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("PDF_PARSE_FAILED");
  }
}

export async function parseDocumentRows(file: File, type: DocumentType) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".pdf")) return parsePdf(buffer, type);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("EMPTY_WORKBOOK");
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const headerAliases = Object.values({ ...COMPANY_ALIASES, ...OUTSTANDING_ALIASES }).flat();
  const headerIndex = allRows.findIndex((row) => {
    const matches = row.map(normalize).filter((value) => headerAliases.includes(value));
    return matches.length >= 3;
  });
  if (headerIndex < 0) throw new Error("MISSING_HEADER");
  return allRows.slice(headerIndex);
}

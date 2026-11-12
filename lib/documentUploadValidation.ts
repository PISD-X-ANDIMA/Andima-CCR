export type ValidationError = { field: string; row?: number; code: string; message: string; rawValue?: string };
export type DocumentType = "COMPANY_SALES_REPORT" | "OUTSTANDING_REPORT";

export const COMPANY_ALIASES = {
  period: ["period", "period month", "bulan", "month"],
  customer: ["customer", "customer name", "company", "company name", "nama customer", "client", "nama pelanggan"],
  customerCode: ["customer code", "customer id", "company code", "company id", "kode customer", "kode pelanggan"],
  revenue: ["revenue", "sales", "sales value", "nilai penjualan", "nilai sales", "invoice nominal", "nominal invoice"],
  trucking: ["trucking cost", "trucking", "biaya trucking", "sub total", "subtotal", "cost sub total"],
  handling: ["handling cost", "handling", "biaya handling", "vat", "vat ppn", "ppn"],
  storage: ["storage cost", "storage", "biaya storage", "pph 23", "pph", "pph23"],
  otherCost: ["other operational cost", "other cost", "operational cost", "biaya operasional lain", "others", "dip iata", "dip", "others dip iata"],
  job: ["job", "job number", "nomor job"],
  mawb: ["mawb", "mawb no", "mawb number"],
};

export const OUTSTANDING_ALIASES = {
  invoice: ["invoice", "invoice number", "nomor invoice"],
  customer: ["customer", "customer name", "company", "company name", "nama customer", "client", "nama pelanggan"],
  customerCode: ["customer code", "customer id", "company code", "company id", "kode customer", "kode pelanggan"],
  amount: ["idr", "amount", "amount rp", "outstanding", "outstanding amount", "nominal tagihan"],
  dueDate: ["due date", "due", "tanggal jatuh tempo"],
  createDate: ["create date", "created date", "tanggal dibuat"],
  job: ["job", "job number", "nomor job"],
  mawb: ["mawb"],
};

export function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[()[\],.]/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findHeader(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(normalize(header)));
}

export function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.includes(",") && text.includes(".")
    ? text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "")
    : text.includes(",")
      ? text.replace(",", ".")
      : /\.\d{3}(?:\.|$)/.test(text) ? text.replace(/\./g, "") : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function periodValue(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? `${text}-01` : null;
}

export function validateRows(rows: unknown[][], type: DocumentType, customerMap: Map<string, string>) {
  const header = (rows[0] ?? []).map(normalize);
  const aliases = type === "COMPANY_SALES_REPORT" ? COMPANY_ALIASES : OUTSTANDING_ALIASES;
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, findHeader(header, values)]));
  const required = type === "COMPANY_SALES_REPORT"
    ? ["period", "customer", "revenue", "trucking", "handling", "storage", "otherCost"]
    : ["invoice", "customer", "amount", "dueDate"];
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  for (const field of required) if (indexes[field] === -1) errors.push({ field, code: "MISSING_HEADER", message: `Kolom wajib ${field} tidak ditemukan.` });
  if (errors.length) return { errors, warnings, rows: [] as Record<string, unknown>[], unmatchedCustomerCount: 0 };

  const valid: Record<string, unknown>[] = [];
  rows.slice(1).forEach((raw, index) => {
    if (raw.every((value) => String(value ?? "").trim() === "")) return;
    const row = index + 2;
    const value = (key: string) => indexes[key] >= 0 ? raw[indexes[key]] : undefined;
    if (type === "OUTSTANDING_REPORT"
      && !String(value("invoice") ?? "").trim()
      && !String(value("dueDate") ?? "").trim()
      && !String(value("job") ?? "").trim()
      && !String(value("mawb") ?? "").trim()
      && (String(value("createDate") ?? "").trim() || String(value("amount") ?? "").trim())) return;
    const customerValue = String(value("customer") ?? "").trim();
    const customerCode = String(value("customerCode") ?? "").trim();
    const customer = customerValue;
    const customerId = customerMap.get(normalize(customerCode)) ?? customerMap.get(normalize(customerValue)) ?? null;
    if (!customerValue) errors.push({ row, field: "customer", code: "REQUIRED", message: "Customer wajib diisi." });
    if (type === "COMPANY_SALES_REPORT") {
      const revenue = numberValue(value("revenue"));
      const period = periodValue(value("period"));
      if (!period) errors.push({ row, field: "period", code: "INVALID_PERIOD", message: "Periode bulan tidak valid." });
      const costs = ["trucking", "handling", "storage", "otherCost"] as const;
      const parsedCosts = costs.map((cost) => numberValue(value(cost)));
      if (revenue === null || revenue < 0) errors.push({ row, field: "revenue", code: "INVALID_NUMBER", message: "Revenue harus berupa angka tidak negatif." });
      parsedCosts.forEach((cost, costIndex) => {
        if (cost === null || cost < 0) errors.push({ row, field: costs[costIndex], code: "INVALID_NUMBER", message: "Komponen biaya harus berupa angka tidak negatif." });
      });
      const job = String(value("job") ?? "").trim();
      const mawb = String(value("mawb") ?? "").trim();
      if (period && customerValue && revenue !== null && revenue >= 0 && parsedCosts.every((cost) => cost !== null && cost >= 0)) valid.push({
        row_number: row,
        period_month: period,
        customer_name: customer,
        ...(customerCode ? { customer_code: customerCode } : {}),
        customer_id: customerId,
        revenue,
        trucking_cost: parsedCosts[0],
        handling_cost: parsedCosts[1],
        storage_cost: parsedCosts[2],
        other_operational_cost: parsedCosts[3],
        ...(job ? { job_number: job } : {}),
        ...(mawb ? { mawb } : {}),
      });
    } else {
      const amount = numberValue(value("amount"));
      const dueDate = dateValue(value("dueDate"));
      const invoice = String(value("invoice") ?? "").trim();
      if (!invoice) errors.push({ row, field: "invoice", code: "REQUIRED", message: "Invoice wajib diisi." });
      if (amount === null || amount < 0) errors.push({ row, field: "amount", code: "INVALID_NUMBER", message: "Nominal harus berupa angka tidak negatif." });
      if (!dueDate) errors.push({ row, field: "dueDate", code: "INVALID_DATE", message: "Due date tidak valid." });
      if (invoice && customerValue && amount !== null && amount >= 0 && dueDate) valid.push({ row_number: row, invoice_number: invoice, customer_name: customer, ...(customerCode ? { customer_code: customerCode } : {}), customer_id: customerId, outstanding_amount: amount, due_date: dueDate, create_date: dateValue(value("createDate")), job_number: String(value("job") ?? "").trim() || null, mawb: String(value("mawb") ?? "").trim() || null });
    }
  });
  if (type === "OUTSTANDING_REPORT") {
    const seenInvoices = new Set<string>();
    for (const [index, row] of rows.slice(1).entries()) {
      const invoiceIndex = indexes.invoice;
      if (invoiceIndex < 0) break;
      const invoice = String(row[invoiceIndex] ?? "").trim().toLowerCase();
      if (!invoice) continue;
      if (seenInvoices.has(invoice)) errors.push({ row: index + 2, field: "invoice", code: "DUPLICATE_INVOICE", message: "Invoice duplikat ditemukan.", rawValue: invoice });
      seenInvoices.add(invoice);
    }
    if (errors.some((error) => error.code === "DUPLICATE_INVOICE")) return { errors, warnings, rows: [] as Record<string, unknown>[], unmatchedCustomerCount: 0 };
  }
  return { errors, warnings, rows: valid, unmatchedCustomerCount: 0 };
}

export type FriendlyErrorReason = {
  title: string;
  description: string;
  suggestions: string[];
};

export function getFriendlyErrorReason(
  errors: { field?: string; row?: number; code?: string; message?: string }[] = [],
  documentType?: DocumentType | string
): FriendlyErrorReason {
  if (!errors.length) {
    return {
      title: "Document Validation Notice",
      description: "Validation did not pass. Please check the file formatting.",
      suggestions: ["Check that the document matches the expected template."],
    };
  }

  const codes = new Set(errors.map((e) => (e.code ?? "").toUpperCase()));
  const messages = errors.map((e) => (e.message ?? "").toLowerCase()).join(" ");

  if (codes.has("PARSE_FAILED") || messages.includes("parse") || messages.includes("extract")) {
    return {
      title: "File Could Not Be Read",
      description: "We could not extract readable table data from this file. Scanned PDF documents without selectable text cannot be processed automatically.",
      suggestions: [
        "If uploading a PDF, export it directly as a digital PDF from your accounting or ERP software.",
        "Ensure the file is not password-protected or corrupted.",
        "For spreadsheets, save as a standard Excel (.xlsx or .xls) file.",
      ],
    };
  }

  if (codes.has("MISSING_HEADER") || messages.includes("kolom wajib") || messages.includes("missing header")) {
    const isSales = documentType === "COMPANY_SALES_REPORT";
    return {
      title: "Required Columns Are Missing",
      description: "Some required column headers were not recognized. The system uses column names to organize your data.",
      suggestions: [
        "Make sure the table headers are located on the first row of your spreadsheet.",
        isSales
          ? "Ensure required columns exist: Period, Customer, Revenue, Trucking Cost, Handling Cost, Storage Cost, Other Cost."
          : "Ensure required columns exist: Invoice Number, Customer Name, Outstanding Amount, Due Date.",
        "Check that column headers do not have accidental typos.",
      ],
    };
  }

  if (codes.has("DUPLICATE_INVOICE") || messages.includes("duplikat")) {
    return {
      title: "Duplicate Invoices in File",
      description: "Multiple rows in your document have the exact same invoice number. To prevent recording duplicate receivables, each invoice must be unique.",
      suggestions: [
        "Search your document for duplicate invoice numbers highlighted in the list below.",
        "Merge or delete duplicate entries before re-uploading.",
      ],
    };
  }

  if (codes.has("REQUIRED") && (messages.includes("customer") || messages.includes("pelanggan"))) {
    return {
      title: "Missing Customer Information",
      description: "One or more transactions have an empty Customer field. Every entry must be linked to a customer for tracking.",
      suggestions: [
        "Check the highlighted rows below and fill in the customer name for each entry.",
        "Make sure there are no blank lines between rows in your spreadsheet.",
      ],
    };
  }

  if (codes.has("INVALID_NUMBER") || messages.includes("angka tidak negatif") || messages.includes("nominal")) {
    return {
      title: "Incorrect Amount or Cost Format",
      description: "Some financial values could not be parsed as valid numbers. Amounts cannot be negative and must not contain extra letters or broken formatting.",
      suggestions: [
        "Enter amounts as plain numbers (for example: 1250000 without 'Rp' or letters).",
        "Make sure operational costs and revenues are zero or positive numbers.",
      ],
    };
  }

  if (codes.has("INVALID_DATE") || codes.has("INVALID_PERIOD") || messages.includes("due date") || messages.includes("periode")) {
    return {
      title: "Unrecognized Date or Period Format",
      description: "Some dates or monthly periods do not match expected standard date formats.",
      suggestions: [
        "Format dates as YYYY-MM-DD (e.g. 2026-09-30) or DD/MM/YYYY.",
        "For monthly reports, use the format YYYY-MM (e.g. 2026-09).",
      ],
    };
  }

  return {
    title: "Document Contains Validation Errors",
    description: "Some rows in your document do not meet the system requirements. Review the detailed findings below to see which rows need adjustment.",
    suggestions: [
      "Check the specific row numbers and fields indicated in the findings table.",
      "Update your file and upload it again.",
    ],
  };
}

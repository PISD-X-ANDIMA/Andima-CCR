export type ValidationError = { field: string; row?: number; code: string; message: string; rawValue?: string };
export type DocumentType = "COMPANY_SALES_REPORT" | "OUTSTANDING_REPORT";

export const COMPANY_ALIASES = {
  period: ["period", "period month", "bulan", "month"],
  customer: ["customer", "customer name", "company", "company name", "nama customer", "client", "nama pelanggan"],
  customerCode: ["customer code", "customer id", "company code", "company id", "kode customer", "kode pelanggan"],
  revenue: ["revenue", "sales", "sales value", "nilai penjualan", "nilai sales"],
  trucking: ["trucking cost", "trucking", "biaya trucking"],
  handling: ["handling cost", "handling", "biaya handling"],
  storage: ["storage cost", "storage", "biaya storage"],
  otherCost: ["other operational cost", "other cost", "operational cost", "biaya operasional lain"],
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
    const customerId = customerMap.get(normalize(customerValue)) ?? customerMap.get(normalize(customerCode));
    if (!customerValue) errors.push({ row, field: "customer", code: "REQUIRED", message: "Customer wajib diisi." });
    else if (!customerId) errors.push({ row, field: "customer", code: "UNKNOWN_CUSTOMER", message: "Customer belum terhubung ke master customer.", rawValue: customerValue });
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
      if (period && customerId && revenue !== null && revenue >= 0 && parsedCosts.every((cost) => cost !== null && cost >= 0)) valid.push({ row_number: row, period_month: period, customer_name: customer, ...(customerCode ? { customer_code: customerCode } : {}), customer_id: customerId, revenue, trucking_cost: parsedCosts[0], handling_cost: parsedCosts[1], storage_cost: parsedCosts[2], other_operational_cost: parsedCosts[3] });
    } else {
      const amount = numberValue(value("amount"));
      const dueDate = dateValue(value("dueDate"));
      const invoice = String(value("invoice") ?? "").trim();
      if (!invoice) errors.push({ row, field: "invoice", code: "REQUIRED", message: "Invoice wajib diisi." });
      if (amount === null || amount < 0) errors.push({ row, field: "amount", code: "INVALID_NUMBER", message: "Nominal harus berupa angka tidak negatif." });
      if (!dueDate) errors.push({ row, field: "dueDate", code: "INVALID_DATE", message: "Due date tidak valid." });
      if (invoice && customerId && amount !== null && amount >= 0 && dueDate) valid.push({ row_number: row, invoice_number: invoice, customer_name: customer, ...(customerCode ? { customer_code: customerCode } : {}), customer_id: customerId, outstanding_amount: amount, due_date: dueDate, create_date: dateValue(value("createDate")), job_number: String(value("job") ?? "").trim() || null, mawb: String(value("mawb") ?? "").trim() || null });
    }
  });
  if (type === "OUTSTANDING_REPORT") {
    const seenInvoices = new Set<string>();
    for (const row of rows.slice(1)) {
      const invoiceIndex = indexes.invoice;
      if (invoiceIndex < 0) break;
      const invoice = String(row[invoiceIndex] ?? "").trim().toLowerCase();
      if (!invoice) continue;
      if (seenInvoices.has(invoice)) errors.push({ field: "invoice", code: "DUPLICATE_INVOICE", message: "Invoice duplikat ditemukan." });
      seenInvoices.add(invoice);
    }
    if (errors.some((error) => error.code === "DUPLICATE_INVOICE")) return { errors, warnings, rows: [] as Record<string, unknown>[], unmatchedCustomerCount: 0 };
  }
  return { errors, warnings, rows: valid, unmatchedCustomerCount: 0 };
}

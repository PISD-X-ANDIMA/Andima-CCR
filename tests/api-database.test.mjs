import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, mocks = {}, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (name === "server-only") return {}; if (name in mocks) return mocks[name]; throw new Error(`Missing mock: ${name}`); }, process, console, ...extras });
  return exports;
}
const position = "10da1bac-a6a8-472e-a171-e4984ab768d9";
const department = "1653db5f-2b64-418f-b28b-68cb7b9dae8e";
const user1 = "11111111-1111-4111-8111-111111111111";
const user2 = "22222222-2222-4222-8222-222222222222";
const doc1 = "33333333-3333-4333-8333-333333333333";
const doc2 = "44444444-4444-4444-8444-444444444444";
const registration = { full_name: "Andima Test", email: "test@andima.co.id", password: "Testing123!", phone: "08123456789", employment_status: "probation", position_id: position, department_id: department };

test("registration validates types, domain, password, and position/department on the server", () => {
  const { validateRegistration } = load("lib/server/registration.ts", { "./admin": {} });
  assert.equal(validateRegistration(registration).employment_status, "PROBATION");
  for (const bad of [null, {}, { ...registration, phone: 123 }, { ...registration, email: "test@gmail.com" }, { ...registration, password: "weak" }, { ...registration, department_id: user1 }]) assert.equal(validateRegistration(bad), null);
});

test("CCR authorization matrix allows chart access for management and staff", () => {
  const authorization = load("lib/server/authorization.ts", { "@/lib/server/admin": { createAdminClient: () => ({}) } });
  const profiles = [
    ...["CCR-003", "CCR-004", "CCR-005"].map(employee_id => ({ employee_id, resolved_role: "MANAGEMENT", registration_status: "PROVISIONED", is_active: true })),
    ...["CCR-006", "CCR-007", "CCR-008", "CCR-009", "CCR-010", "CCR-011", "CCR-012"].map(employee_id => ({ employee_id, resolved_role: "STAFF", registration_status: "PROVISIONED", is_active: true })),
  ];
  for (const profile of profiles) {
    assert.equal(authorization.canUseCcr(profile), true, profile.employee_id);
    assert.equal(authorization.canManage(profile), profile.resolved_role === "MANAGEMENT", profile.employee_id);
    assert.equal(authorization.canUpload(profile), profile.resolved_role === "STAFF", profile.employee_id);
  }
  for (const invalid of [
    { resolved_role: "STAFF", registration_status: "PENDING", is_active: true },
    { resolved_role: "MANAGEMENT", registration_status: "REJECTED", is_active: true },
    { resolved_role: "STAFF", registration_status: "PROVISIONED", is_active: false },
    { resolved_role: null, registration_status: "PROVISIONED", is_active: true },
  ]) {
    assert.equal(authorization.canUseCcr(invalid), false);
  }
});

test("document uploads require a customer name but allow names outside the A1 customer list", () => {
  const uploadRoute = load("lib/documentUploadValidation.ts", {
    "node:crypto": { createHash: () => ({ update() { return this; }, digest: () => "checksum" }) },
    "node:path": { join: (...parts) => parts.join("/") },
    "node:url": { pathToFileURL: value => ({ toString: () => String(value) }) },
    "next/server": { NextRequest: class {}, NextResponse: responseMock.NextResponse },
    "next/headers": { cookies: async () => ({}) },
    xlsx: { read: () => ({ Sheets: {}, SheetNames: [] }), utils: {} },
    "@/utils/supabase/server": { createClient: () => ({}) },
    "@/lib/server/admin": { createAdminClient: () => ({}) },
    "@/lib/server/http": { checkOrigin: () => null, apiError: () => responseMock.NextResponse.json({}) },
    "@/lib/supabaseOverdueApi": { describeSupabaseError: String, evaluateOverdueAlertsInSupabase: async () => ({}) },
    "@/lib/server/authorization": { getCcrProfile: async () => null, canUpload: () => false },
  });
  const customerMap = new Map([
    ["known co", "customer-known"],
    ["code 42", "customer-by-code"],
  ]);

  const sales = uploadRoute.validateRows([
    ["period", "customer", "customer code", "revenue", "trucking cost", "handling cost", "storage cost", "other operational cost"],
    ["2026-09", "Known Co", "", "100", "10", "20", "30", "40"],
    ["2026-09", "  File Only Co  ", "", "200", "20", "30", "40", "50"],
    ["2026-09", "Different Name", "CODE-42", "300", "30", "40", "50", "60"],
    ["2026-09", "", "", "400", "40", "50", "60", "70"],
  ], "COMPANY_SALES_REPORT", customerMap);
  assert.equal(sales.errors.filter(error => error.field === "customer").length, 1);
  assert.equal(sales.errors.some(error => error.code === "UNKNOWN_CUSTOMER"), false);
  assert.equal(sales.errors.some(error => error.code === "UNKNOWN_CUSTOMER" && error.rawValue === "Different Name"), false);
  assert.equal(sales.errors.some(error => error.code === "REQUIRED" && error.row === 5), true);
  assert.equal(sales.rows.length, 3);
  assert.equal(JSON.stringify(sales.rows[0]), JSON.stringify({
    row_number: 2,
    period_month: "2026-09-01",
    customer_name: "Known Co",
    customer_id: "customer-known",
    revenue: 100,
    trucking_cost: 10,
    handling_cost: 20,
    storage_cost: 30,
    other_operational_cost: 40,
  }));
  assert.equal(sales.rows[1].customer_name, "File Only Co");
  assert.equal(sales.rows[1].customer_id, null);
  assert.equal(sales.rows[2].customer_id, "customer-by-code");
  assert.equal(sales.unmatchedCustomerCount, 0);

  const outstanding = uploadRoute.validateRows([
    ["invoice", "customer", "amount", "due date"],
    ["INV-UNKNOWN", "File Outstanding Co", "500", "2026-10-15"],
  ], "OUTSTANDING_REPORT", customerMap);
  assert.equal(outstanding.errors.length, 0);
  assert.equal(outstanding.rows.length, 1);
  assert.equal(outstanding.rows[0].customer_id, null);
  assert.equal(outstanding.unmatchedCustomerCount, 0);

  const missingCustomerColumn = uploadRoute.validateRows([
    ["period", "revenue", "trucking cost", "handling cost", "storage cost", "other operational cost"],
    ["2026-09", "100", "10", "20", "30", "40"],
  ], "COMPANY_SALES_REPORT", customerMap);
  assert.equal(missingCustomerColumn.errors.length, 1);
  assert.equal(missingCustomerColumn.errors[0].code, "MISSING_HEADER");
  assert.equal(missingCustomerColumn.rows.length, 0);
});

test("upload resolver migration creates and cleans C1 upload customers without requiring A1", () => {
  const migration = read("supabase/migrations/20261024010000_resolve_uploaded_customers_without_a1.sql");
  assert.match(migration, /where lower\(trim\(c\.customer_code\)\) = lower\(item\.customer_code\)/);
  assert.match(migration, /where lower\(trim\(c\.customer_name\)\) = lower\(item\.customer_name\)/);
  assert.match(migration, /source_type, source_document_id\)[\s\S]*'UPLOAD', p_document_id/);
  assert.match(migration, /create or replace function public\.c1_cleanup_unreferenced_upload_customers/);
  assert.match(read("app/api/v1/documents/upload/route.ts"), /c1_resolve_uploaded_customers/);
  assert.match(read("app/api/v1/documents/upload/route.ts"), /c1_cleanup_unreferenced_upload_customers/);
});

test("uploaded customer resolver prioritizes code, falls back to name, and cleans unused inserts", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table c1_customer (
      customer_id uuid primary key default gen_random_uuid(), customer_code text, customer_name text not null,
      branch text not null, active_status boolean not null, source_type text not null,
      source_document_id uuid, created_at timestamptz not null default now()
    );
    create table c1_company_sales_staging_rows (c1_customer_id uuid);
    create table c1_outstanding_staging_rows (c1_customer_id uuid);
    create table c1_overdue_alert (c1_customer_id uuid);
    create table c1_customer_monthly_metrics (customer_id uuid);
    insert into c1_customer (customer_code, customer_name, branch, active_status, source_type)
      values ('CODE-1', 'Master Canonical Name', 'Jakarta', true, 'MASTER');`);
  await db.exec(read("supabase/migrations/20261024010000_resolve_uploaded_customers_without_a1.sql"));
  const result = await db.query("select public.c1_resolve_uploaded_customers($1::uuid, $2::jsonb) as resolved", [doc1, JSON.stringify([
    { customer_name: "Different Name", customer_code: "CODE-1" },
    { customer_name: "Master Canonical Name", customer_code: "OTHER-CODE" },
    { customer_name: "Fresh Upload Co", customer_code: null },
  ])]);
  const items = result.rows[0].resolved.items;
  assert.equal(items.find(item => item.requested_customer_code === "CODE-1").customer_name, "Master Canonical Name");
  assert.equal(items.find(item => item.requested_customer_code === "OTHER-CODE").customer_code, "CODE-1");
  assert.equal(items.find(item => item.requested_customer_name === "Fresh Upload Co").customer_code.startsWith("UPLOAD-"), true);
  const cleanup = await db.query("select public.c1_cleanup_unreferenced_upload_customers($1::uuid) as deleted", [doc1]);
  assert.equal(cleanup.rows[0].deleted, 1);
  const remaining = await db.query("select customer_name from c1_customer order by customer_name");
  assert.deepEqual(remaining.rows.map(row => row.customer_name), ["Master Canonical Name"]);
  await db.close();
});

test("document preview exposes all validation findings for client-side paging", () => {
  const source = read("app/api/v1/documents/[id]/preview/route.ts");
  assert.match(source, /select\("row_number, field_name, error_code, error_message, raw_value, severity"\)/);
  assert.doesNotMatch(source, /c1_document_validation_errors[\s\S]{0,200}\.limit\(500\)/);
  const panel = read("components/Sales Overview/DocumentsPanel.tsx");
  assert.match(panel, /errorPageSize = 25/);
  assert.match(panel, /Pagination currentPage=\{errorPage\}/);
  assert.match(panel, /Validation Warnings &amp; Errors[\s\S]*Source value/);
});

test("rejected download actions use an error toast and CCR page titles omit the prefix", () => {
  const overview = read("components/Sales Overview/SalesOverview.tsx");
  const documents = read("app/uploaded-documents/page.tsx");
  assert.match(overview, /role="alert"[\s\S]*bg-rose-50[\s\S]*onRejectedDownload/);
  assert.match(documents, /role="alert"[\s\S]*bg-rose-50/);
  assert.match(documents, /File asli tidak tersedia karena dokumen ditolak/);
  assert.match(read("app/customer-analytics/page.tsx"), /<h1[^>]*>Customer Analytics<\/h1>/);
  assert.match(read("components/OverdueAlertView.tsx"), /<h1[^>]*>Overdue Alerts &amp; Receivables Monitoring<\/h1>/);
});

test("upload preflight returns extracted rows and validation findings without persistence", async () => {
  class MockFile {
    constructor(name, type) { this.name = name; this.type = type; this.size = 32; }
  }
  const parsedRows = [
    ["period", "customer", "revenue"],
    ["2026-09", "Valid Co", "100"],
    ["bad-period", "Invalid Co", "200"],
    ["", "", ""],
    ["", "Ignored Co", ""],
  ];
  const route = load("app/api/v1/documents/preview/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { checkOrigin: () => null, requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "STAFF", is_active: true, registration_status: "PROVISIONED" }), canUpload: () => true },
    "@/lib/server/documentUploadParser": { parseDocumentRows: async () => parsedRows, parseFailureMessage: () => "Parse failed." },
    "@/lib/documentUploadValidation": { validateRows: () => ({
      rows: [{ row_number: 2, customer_name: "Valid Co" }],
      errors: [{ row: 3, field: "period", code: "INVALID_PERIOD", message: "Period invalid.", rawValue: "bad-period" }],
      warnings: [{ row: 2, field: "customer", code: "CUSTOMER_ALIAS", message: "Alias matched." }],
    }) },
  }, { performance, File: MockFile, Buffer, crypto: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  const file = new MockFile("sales.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const request = { formData: async () => ({ get: key => key === "file" ? file : "COMPANY_SALES_REPORT" }) };
  const response = await route.POST(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(body.data.rows.map(row => row.status), ["valid", "invalid", "ignored"]);
  assert.equal(body.data.errors[0].row, 3);
  assert.equal(body.data.warnings.length, 1);
  assert.equal(body.data.canFinalize, true);
});

test("upload preflight parse failures are non-finalizable and rejected documents return their record id", () => {
  const form = read("components/UploadForm/uploadform.tsx");
  const upload = read("app/api/v1/documents/upload/route.ts");
  assert.match(form, /\/api\/v1\/documents\/preview/);
  assert.match(form, /\/api\/v1\/documents\/upload/);
  assert.match(form, /error\?\.code === "PARSE_FAILED"/);
  assert.match(form, /disabled={!review\?\.canFinalize/);
  assert.match(upload, /"VALIDATION_FAILED", validationErrors, \{ documentId: document\.id \}\)/);
});

test("upload preflight reports parser failure without creating an upload record", async () => {
  class MockFile {
    constructor(name) { this.name = name; this.type = "application/pdf"; this.size = 32; }
  }
  const route = load("app/api/v1/documents/preview/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { checkOrigin: () => null, requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "STAFF", is_active: true, registration_status: "PROVISIONED" }), canUpload: () => true },
    "@/lib/server/documentUploadParser": { parseDocumentRows: async () => { throw new Error("PDF_TEXT_NOT_EXTRACTABLE"); }, parseFailureMessage: code => `${code} reason.` },
    "@/lib/documentUploadValidation": { validateRows: () => { throw new Error("must not validate parse failure"); } },
  }, { performance, File: MockFile, crypto: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  const file = new MockFile("scan.pdf");
  const response = await route.POST({ formData: async () => ({ get: key => key === "file" ? file : "OUTSTANDING_REPORT" }) });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(body.error.code, "PARSE_FAILED");
  assert.equal(body.error.errors[0].code, "PDF_TEXT_NOT_EXTRACTABLE");
  assert.equal(body.data, undefined);
});

test("finalizing a validation failure creates a Rejected document without storing the original file", async () => {
  class MockFile {
    constructor(name) { this.name = name; this.type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; this.size = 32; }
    async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; }
  }
  let rejectedUpdate = false;
  let storageUploadCalls = 0;
  const admin = {
    from(table) {
      if (table === "c1_document_uploads") return {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: doc1 }, error: null }) }) }),
        update: values => ({ eq: async () => { rejectedUpdate ||= values.validation_status === "rejected"; return { error: null }; } }),
      };
      return { insert: async () => ({ error: null }) };
    },
    storage: { from: () => ({ upload: async () => { storageUploadCalls += 1; return { error: null }; } }) },
  };
  const route = load("app/api/v1/documents/upload/route.ts", {
    "node:crypto": { createHash: () => ({ update() { return this; }, digest: () => "checksum" }) },
    "next/server": responseMock,
    "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: user1 } } }) }, from: () => ({ select: async () => ({ data: [], error: null }) }) }) },
    "@/lib/server/admin": { createAdminClient: () => admin },
    "@/lib/server/http": { checkOrigin: () => null },
    "@/lib/supabaseOverdueApi": { describeSupabaseError: String, evaluateOverdueAlertsInSupabase: async () => ({}) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "STAFF", is_active: true, registration_status: "PROVISIONED" }), canUpload: () => true },
    "@/lib/server/documentUploadParser": { parseDocumentRows: async () => [["period", "customer"], ["2026-09", "Bad Row"]], parseFailureMessage: () => "Parse failed." },
    "@/lib/documentUploadValidation": { normalize: value => String(value).toLowerCase(), validateRows: () => ({ rows: [], errors: [{ row: 2, field: "revenue", code: "INVALID_NUMBER", message: "Invalid number." }], warnings: [] }) },
  }, { performance, File: MockFile, Buffer, crypto: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  const file = new MockFile("bad-sales.xlsx");
  const response = await route.POST({ formData: async () => ({ get: key => key === "file" ? file : "COMPANY_SALES_REPORT" }) });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(body.error.code, "VALIDATION_FAILED");
  assert.equal(body.error.documentId, doc1);
  assert.equal(rejectedUpdate, true);
  assert.equal(storageUploadCalls, 0);
});

test("C1 upload exposes only spreadsheet and PDF formats", () => {
  const uploadSource = read("app/api/v1/documents/upload/route.ts");
  const formSource = read("components/UploadForm/uploadform.tsx");
  assert.match(uploadSource, /new Set\(\[\"xlsx\", \"xls\", \"pdf\"\]\)/);
  assert.doesNotMatch(uploadSource, /\"csv\"/);
  assert.match(formSource, /const ACCEPT = \"\.xlsx,\.xls,\.pdf\"/);
  assert.doesNotMatch(formSource, /\.csv/);
});

test("managed document listing forwards filters, pagination, and keeps Overview capped at five", async () => {
  let rpcArgs;
  const route = load("app/api/v1/documents/recent/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/admin": { createAdminClient: () => ({ rpc: async (_name, args) => { rpcArgs = args; return { data: { data: [], summary: { total: 12, validated: 10, rejected: 2 }, pagination: { page: args.p_page, page_size: args.p_page_size, total_items: 12, total_pages: 2 } }, error: null }; } }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "PROVISIONED" }), canUseCcr: () => true, canUpload: () => false },
  }, { performance });
  const managedResponse = await route.GET({ nextUrl: new URL("https://app.test/api/v1/documents/recent?search=acme&document_type=outstanding&file_type=pdf&page=2&limit=10") });
  assert.equal(managedResponse.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(rpcArgs)), { p_search: "acme", p_document_type: "OUTSTANDING_REPORT", p_file_type: "pdf", p_page: 2, p_page_size: 10 });
  assert.equal((await managedResponse.json()).permissions.can_manage_documents, false);

  await route.GET({ nextUrl: new URL("https://app.test/api/v1/documents/recent?view=overview&limit=5") });
  assert.equal(rpcArgs.p_page_size, 5);

  const notReadyRoute = load("app/api/v1/documents/recent/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/admin": { createAdminClient: () => ({ rpc: async () => ({ data: null, error: { code: "PGRST202", message: "function c1_list_managed_documents not found" } }) }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "PROVISIONED" }), canUseCcr: () => true, canUpload: () => false },
  }, { performance });
  const notReady = await notReadyRoute.GET({ nextUrl: new URL("https://app.test/api/v1/documents/recent") });
  assert.equal(notReady.status, 503);
  assert.equal((await notReady.json()).error.code, "DOCUMENT_MANAGEMENT_NOT_READY");
});

test("document delete is Staff-only and maps processing status to conflict", async () => {
  let rpcCalls = 0;
  const mocks = {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }), checkOrigin: () => null },
    "@/lib/server/admin": { createAdminClient: () => ({ rpc: async () => { rpcCalls += 1; return { data: null, error: { message: "DOCUMENT_PROCESSING" } }; } }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "PROVISIONED" }), canUpload: profile => profile.resolved_role === "STAFF" },
    "@/lib/server/documentStorageCleanup": { cleanupDocumentStorage: async () => ({ complete: true }) },
  };
  const route = load("app/api/v1/documents/[id]/route.ts", mocks);
  const denied = await route.DELETE({ method: "DELETE" }, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(denied.status, 403);
  assert.equal(rpcCalls, 0);

  mocks["@/lib/server/authorization"].getCcrProfile = async () => ({ resolved_role: "STAFF", is_active: true, registration_status: "PROVISIONED" });
  const staffRoute = load("app/api/v1/documents/[id]/route.ts", mocks);
  const conflict = await staffRoute.DELETE({ method: "DELETE" }, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, "DOCUMENT_PROCESSING");
  assert.equal(rpcCalls, 1);
});

test("document manager UI exposes read-only review, Staff actions, filters, paging, and delete confirmation details", () => {
  const page = read("app/uploaded-documents/page.tsx");
  const previewPanel = read("components/Sales Overview/DocumentsPanel.tsx");
  assert.match(page, /canManage && <button[\s\S]*Add Document/);
  assert.match(page, /canManage && row\.validation_status !== "processing"/);
  assert.match(page, /cleanup-pending/);
  assert.match(page, /document_type: documentType, file_type: fileType, page: String\(page\), limit: "10"/);
  assert.match(page, /role="alertdialog"[\s\S]*Delete document\?/);
  assert.match(page, /deleteTarget\.file_name/);
  assert.match(page, /deleteTarget\.document_type === "OUTSTANDING_REPORT"/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /Pending Storage Cleanup/);
  assert.match(page, /min-h-32 rounded-xl border border-slate-100 bg-white p-5 shadow-sm/);
  assert.match(page, /row\.validation_status === "rejected"/);
  assert.match(previewPanel, /The original file was not saved/);
  assert.match(page, /DocumentStatsSkeleton/);
  assert.match(page, /Array\.from\(\{ length: 10 \}/);
  assert.match(page, /aria-busy=\{loading\}/);
  assert.match(page, /Loading uploaded documents/);
});

test("C1 upload rejects CSV before persistence", async () => {
  class MockFile {
    constructor(name, type) {
      this.name = name;
      this.type = type;
      this.size = 32;
    }
  }
  const uploadRoute = load("app/api/v1/documents/upload/route.ts", {
    "node:crypto": { createHash: () => ({ update() { return this; }, digest: () => "checksum" }) },
    "node:path": { join: (...parts) => parts.join("/") },
    "node:url": { pathToFileURL: value => ({ toString: () => String(value) }) },
    "next/server": responseMock,
    "next/headers": { cookies: async () => ({}) },
    xlsx: { read: () => ({ Sheets: {}, SheetNames: [] }), utils: {} },
    "@/utils/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: user1 } } }) } }) },
    "@/lib/server/admin": { createAdminClient: () => ({}) },
    "@/lib/server/http": { checkOrigin: () => null },
    "@/lib/supabaseOverdueApi": { describeSupabaseError: String, evaluateOverdueAlertsInSupabase: async () => ({}) },
    "@/lib/documentUploadValidation": { COMPANY_ALIASES: {}, OUTSTANDING_ALIASES: {}, normalize: value => String(value), numberValue: () => null, dateValue: () => null, periodValue: () => null, validateRows: () => ({ errors: [], warnings: [], rows: [], unmatchedCustomerCount: 0 }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "STAFF", is_active: true, registration_status: "APPROVED" }), canUpload: () => true },
    "@/lib/server/documentUploadParser": { parseDocumentRows: async () => [], parseFailureMessage: () => "Parse failed." },
  }, { performance, File: MockFile });
  const file = new MockFile("sales.csv", "text/csv");
  const response = await uploadRoute.POST({ formData: async () => ({ get: key => key === "file" ? file : "COMPANY_SALES_REPORT" }) });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "UNSUPPORTED_FORMAT");
});

test("validation detail endpoint enforces CCR access and no-store responses", async () => {
  const unauthorized = load("app/api/v1/documents/[id]/validation/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ error: responseMock.NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }) }) },
    "@/lib/server/authorization": { getCcrProfile: async () => null, canUseCcr: () => false },
    "@/lib/server/admin": { createAdminClient: () => { throw new Error("database must not be queried"); } },
  }, { performance });
  const unauthorizedResponse = await unauthorized.GET({}, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(unauthorizedResponse.status, 401);
  assert.equal(unauthorizedResponse.headers.get("cache-control"), "no-store, max-age=0");

  let databaseCalls = 0;
  const admin = {
    from(table) {
      databaseCalls += 1;
      if (table === "c1_document_uploads") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: doc1, validation_status: "rejected" }, error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ row_number: 2, field_name: "customer", error_code: "REQUIRED", error_message: "Customer wajib diisi." }], error: null }) }) }) };
    },
  };
  const authorized = load("app/api/v1/documents/[id]/validation/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "APPROVED" }), canUseCcr: () => true },
    "@/lib/server/admin": { createAdminClient: () => admin },
  }, { performance });
  const authorizedResponse = await authorized.GET({}, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(authorizedResponse.status, 200);
  assert.equal(databaseCalls, 2);
  assert.equal(authorizedResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(authorizedResponse.headers.get("server-timing"), /auth/);
  assert.deepEqual((await authorizedResponse.json()).data.errors[0], { row_number: 2, field_name: "customer", error_code: "REQUIRED", error_message: "Customer wajib diisi." });
});

test("rejected document preview returns validation details without requesting a Storage URL", async () => {
  let signedUrlCalls = 0;
  const document = { id: doc1, file_name: "bad-sales.xlsx", document_type: "COMPANY_SALES_REPORT", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file_size_bytes: 1024, storage_bucket: "c1-document-uploads", storage_path: "staff/path/bad-sales.xlsx", uploaded_at: "2026-10-24T00:00:00Z", processed_at: "2026-10-24T00:01:00Z", validation_status: "rejected", row_count: 1, valid_row_count: 0, invalid_row_count: 1, error_summary: "Validation failed." };
  const validationErrors = [{ row_number: 2, field_name: "customer", error_code: "REQUIRED", error_message: "Customer is required.", raw_value: null, severity: "ERROR" }, ...Array.from({ length: 500 }, (_, index) => ({ row_number: index + 3, field_name: "revenue", error_code: "INVALID_NUMBER", error_message: "Revenue is invalid.", raw_value: "x", severity: index % 2 ? "WARNING" : "ERROR" }))];
  const admin = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        limit() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: table === "c1_document_validation_errors" ? validationErrors : [], error: null }).then(resolve, reject); },
        maybeSingle: async () => ({ data: document, error: null }),
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: async () => { signedUrlCalls += 1; return { data: { signedUrl: "https://storage.test/valid.xlsx" }, error: null }; } }) },
  };
  const route = load("app/api/v1/documents/[id]/preview/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "PROVISIONED" }), canUseCcr: () => true },
    "@/lib/server/admin": { createAdminClient: () => admin },
  }, { performance });
  const response = await route.GET({}, { params: Promise.resolve({ id: doc1 }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.document.validation_status, "rejected");
  assert.equal(body.data.signedUrl, null);
  assert.equal(body.data.errors[0].error_message, "Customer is required.");
  assert.equal(body.data.errors.length, 501);
  assert.equal(signedUrlCalls, 0);

  document.validation_status = "validated";
  const validatedResponse = await route.GET({}, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(validatedResponse.status, 200);
  assert.equal((await validatedResponse.json()).data.signedUrl, "https://storage.test/valid.xlsx");
  assert.equal(signedUrlCalls, 1);
});

test("rejected download reports unavailable original and validated missing object reports not found", async () => {
  let signedUrlCalls = 0;
  let storageResult = { data: null, error: { statusCode: "404", message: "Object not found" } };
  let currentDocument = { storage_bucket: "c1-document-uploads", storage_path: "staff/path/rejected.xlsx", validation_status: "rejected", error_summary: "Validation failed." };
  const admin = {
    from() {
      const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: currentDocument, error: null }) };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: async () => { signedUrlCalls += 1; return storageResult; } }) },
  };
  const route = load("app/api/v1/documents/[id]/download/route.ts", {
    "next/server": { NextResponse: { ...responseMock.NextResponse, redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "PROVISIONED" }), canUseCcr: () => true },
    "@/lib/server/admin": { createAdminClient: () => admin },
  });
  const rejected = await route.GET({}, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error.code, "ORIGINAL_FILE_UNAVAILABLE");
  assert.equal(signedUrlCalls, 0);

  currentDocument = { ...currentDocument, validation_status: "validated", error_summary: null };
  const missing = await route.GET({}, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "ORIGINAL_FILE_NOT_FOUND");
  assert.equal(signedUrlCalls, 1);

  storageResult = { data: { signedUrl: "https://storage.test/valid.xlsx" }, error: null };
  const valid = await route.GET({}, { params: Promise.resolve({ id: doc1 }) });
  assert.equal(valid.status, 302);
  assert.equal(valid.headers.get("location"), "https://storage.test/valid.xlsx");
  assert.equal(signedUrlCalls, 2);
});

test("legacy data upload route redirects to Sales Overview", () => {
  const redirects = [];
  const route = load("app/data-upload/page.tsx", { "next/navigation": { redirect: path => redirects.push(path) } });
  route.default();
  assert.deepEqual(redirects, ["/sales-overview"]);
});

test("Sales Overview quick periods preserve the selected end month", () => {
  const { quickPeriodRange, matchingQuickPeriod, listPeriods } = load("lib/salesOverviewPeriod.ts");
  assert.equal(JSON.stringify(quickPeriodRange("2026-09", 1)), JSON.stringify({ startPeriod: "2026-09", endPeriod: "2026-09" }));
  assert.equal(JSON.stringify(quickPeriodRange("2026-09", 3)), JSON.stringify({ startPeriod: "2026-07", endPeriod: "2026-09" }));
  assert.equal(JSON.stringify(quickPeriodRange("2026-09", 12)), JSON.stringify({ startPeriod: "2025-10", endPeriod: "2026-09" }));
  assert.equal(matchingQuickPeriod("2026-07", "2026-09"), 3);
  assert.equal(matchingQuickPeriod("2026-06", "2026-09"), null);
  assert.equal(JSON.stringify(listPeriods("2026-07", "2026-09")), JSON.stringify(["2026-07", "2026-08", "2026-09"]));
});

test("Sales Overview macro metrics aggregate the range and fill empty months", () => {
  const periods = load("lib/salesOverviewPeriod.ts");
  const { buildMacroSeries, summarizeMacroSeries } = load("lib/salesOverviewMetrics.ts", { "@/lib/salesOverviewPeriod": periods });
  const result = buildMacroSeries("2026-07", "2026-09", [
    { period_month: "2026-07-01", revenue: 1000, total_cost: 300 },
    { period_month: "2026-09-01", revenue: "500", total_cost: "200" },
  ], [
    { due_date: "2026-08-15", outstanding_amount: 700 },
  ]);
  assert.equal(result.hasData, true);
  assert.equal(JSON.stringify(result.series), JSON.stringify([
    { period_month: "2026-07", revenue: 1000, cost: 300, sales_profit: 700, total_outstanding: 0 },
    { period_month: "2026-08", revenue: 0, cost: 0, sales_profit: 0, total_outstanding: 700 },
    { period_month: "2026-09", revenue: 500, cost: 200, sales_profit: 300, total_outstanding: 0 },
  ]));
  assert.equal(JSON.stringify(summarizeMacroSeries(result.series, result.hasData)), JSON.stringify({ revenue: 1500, cost: 500, sales_profit: 1000, total_outstanding: 700 }));
  assert.equal(summarizeMacroSeries(result.series, false), null);
});

test("analytics routes authorize before one RPC and keep no-store responses", async () => {
  let macroRpcCalls = 0;
  const macroRoute = load("app/api/v1/analytics/macro/route.ts", {
    "next/server": responseMock,
    "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: user1 } }, error: null }) } }) },
    "@/lib/server/admin": { createAdminClient: () => ({ rpc: async () => { macroRpcCalls += 1; return { data: { summary: null, series: [], alerts: [] }, error: null }; } }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "APPROVED" }), canUseCcr: () => true },
  }, { performance });
  const macroResponse = await macroRoute.GET({ nextUrl: new URL("https://app.test/api/v1/analytics/macro?start_period=2026-08&end_period=2026-10") });
  assert.equal(macroRpcCalls, 1);
  assert.equal(macroResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(macroResponse.headers.get("server-timing"), /rpc/);

  const staffMacroRoute = load("app/api/v1/analytics/macro/route.ts", {
    "next/server": responseMock,
    "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: user2 } } }) } }) },
    "@/lib/server/admin": { createAdminClient: () => ({ rpc: async () => ({ data: { summary: null, series: [], alerts: [] }, error: null }) }) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "STAFF", is_active: true, registration_status: "PROVISIONED" }), canUseCcr: () => true },
  }, { performance });
  const staffMacroResponse = await staffMacroRoute.GET({ nextUrl: new URL("https://app.test/api/v1/analytics/macro?start_period=2026-08&end_period=2026-10") });
  assert.equal(staffMacroResponse.status, 200);
  assert.equal((await staffMacroResponse.json()).data.meta.can_upload, true);

  let customerRpcCalls = 0;
  let customerOptions;
  const customerRoute = load("app/api/v1/customers/analytics/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/supabaseApi": { fetchCustomerAnalyticsFromSupabase: async (options) => { customerRpcCalls += 1; customerOptions = options; return { customers: [], kpi: {}, totalItems: 0 }; } },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "APPROVED" }), canUseCcr: () => true },
  }, { performance, URL });
  const customerResponse = await customerRoute.GET({ url: "https://app.test/api/v1/customers/analytics?branch=Jakarta&search=%20Aurora%20&paymentCycle=Overdue%20(%3E%2030%20Hari)&sortBy=cost&sortOrder=asc&page=0&limit=1000" });
  assert.equal(customerRpcCalls, 1);
  assert.equal(JSON.stringify(customerOptions), JSON.stringify({ branch: "Jakarta", search: "aurora", paymentCycle: "Overdue (> 30 Hari)", sortBy: "cost", sortOrder: "asc", page: 1, limit: 100 }));
  assert.equal(customerResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(customerResponse.headers.get("server-timing"), /rpc/);

  let forbiddenCalls = 0;
  const forbiddenRoute = load("app/api/v1/customers/analytics/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/supabaseApi": { fetchCustomerAnalyticsFromSupabase: async () => { forbiddenCalls += 1; return { customers: [], kpi: {}, totalItems: 0 }; } },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: null, is_active: true, registration_status: "APPROVED" }), canUseCcr: () => false },
  }, { performance, URL });
  assert.equal((await forbiddenRoute.GET({ url: "https://app.test/api/v1/customers/analytics" })).status, 403);
  assert.equal(forbiddenCalls, 0);

  let detailCalls = 0;
  const detailRoute = load("app/api/v1/customers/[customerId]/analytics/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/supabaseApi": { fetchCustomerAnalyticsItemFromSupabase: async customerId => { detailCalls += 1; return customerId === "cust-1" ? { id: "cust-1", customer_id: "cust-1", customer_name: "Detail Co" } : null; } },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "PROVISIONED" }), canUseCcr: () => true },
  }, { performance });
  const detailResponse = await detailRoute.GET({}, { params: Promise.resolve({ customerId: "cust-1" }) });
  assert.equal(detailResponse.status, 200);
  assert.equal(detailCalls, 1);
  assert.equal(detailResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(detailResponse.headers.get("server-timing"), /db/);
  const missingDetail = await detailRoute.GET({}, { params: Promise.resolve({ customerId: "missing" }) });
  assert.equal(missingDetail.status, 404);
});

test("customer invoice detail is readable by CCR while payment mutation is Staff-only", async () => {
  const invoice = { invoice_id: "row-1", invoice_number: "INV-1", amount: 1000, remaining_amount: 1000, paid_amount: 0, payment_status: "UNPAID", bulk_close_status: "PENDING" };
  const baseMocks = {
    "next/server": responseMock,
    "@/lib/server/http": { checkOrigin: () => null, requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }) },
    "@/lib/supabaseApi": { fetchInvoicesFromSupabase: async () => [invoice], recordPaymentInSupabase: async () => ({ success: true, payment: { payment_id: "p-1", amount: 100 } }) },
  };
  const management = load("app/api/v1/customers/[customerId]/invoices/route.ts", {
    ...baseMocks,
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", registration_status: "PROVISIONED", is_active: true }), canUseCcr: () => true, canUpload: () => false },
  }, { performance, URL });
  const readResponse = await management.GET({ url: "https://app.test/api/v1/customers/cust-1/invoices" }, { params: Promise.resolve({ customerId: "cust-1" }) });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get("cache-control"), "no-store, max-age=0");
  const managementWrite = await management.PATCH({ headers: new Map(), json: async () => ({ action: "RECORD_PAYMENT", invoiceNumber: "INV-1", amount: 100, paymentDate: "2026-10-01", referenceNo: "PAY-1" }) }, { params: Promise.resolve({ customerId: "cust-1" }) });
  assert.equal(managementWrite.status, 403);

  const staff = load("app/api/v1/customers/[customerId]/invoices/route.ts", {
    ...baseMocks,
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "STAFF", registration_status: "PROVISIONED", is_active: true }), canUseCcr: () => true, canUpload: () => true },
  }, { performance, URL });
  const invalidWrite = await staff.PATCH({ headers: new Map(), json: async () => ({ action: "RECORD_PAYMENT", invoiceNumber: "INV-1", amount: 0, paymentDate: "2026-10-01", referenceNo: "PAY-1" }) }, { params: Promise.resolve({ customerId: "cust-1" }) });
  assert.equal(invalidWrite.status, 422);
  const validWrite = await staff.PATCH({ headers: new Map(), json: async () => ({ action: "RECORD_PAYMENT", invoiceNumber: "INV-1", amount: 100, paymentDate: "2026-10-01", referenceNo: "PAY-1" }) }, { params: Promise.resolve({ customerId: "cust-1" }) });
  assert.equal(validWrite.status, 201);
});

test("customer invoices resolve legacy CUST ids and tolerate pre-analytics C1 schema", async () => {
  const canonicalId = "99999999-9999-4999-8999-999999999999";
  const legacyInvoice = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    invoice_number: "INV-LEGACY-1",
    customer_name: "Legacy Company",
    customer_id: "a1-company-id",
    outstanding_amount: 500,
    due_date: "2026-10-20",
    create_date: "2026-10-01",
    job_number: "JOB-1",
    mawb: "MAWB-1",
    created_at: "2026-10-01T00:00:00Z",
  };
  const tables = {
    c1_customer: [{ customer_id: canonicalId, customer_name: "Legacy Company", customer_code: "LEG-001", active_status: true, created_at: "2026-01-01T00:00:00Z" }],
    c1_document_uploads: [{ id: legacyInvoice.document_id, validation_status: "validated", document_type: "OUTSTANDING_REPORT" }],
    c1_outstanding_staging_rows: [legacyInvoice],
  };
  const makeClient = () => ({
    from(table) {
      const state = { filters: [], range: null, forcedError: null };
      const query = {
        select(fields) {
          if (table === "c1_outstanding_staging_rows" && fields.includes("c1_customer_id")) state.forcedError = { message: "column c1_outstanding_staging_rows.c1_customer_id does not exist" };
          if (table === "c1_payment_transactions") state.forcedError = { message: "relation c1_payment_transactions does not exist" };
          return query;
        },
        eq(column, value) { state.filters.push([column, "eq", value]); return query; },
        ilike(column, value) { state.filters.push([column, "ilike", value]); return query; },
        neq(column, value) { state.filters.push([column, "neq", value]); return query; },
        in(column, values) { state.filters.push([column, "in", values]); return query; },
        order() { return query; },
        range(from) { state.range = from; return query; },
        limit() { return query; },
        async maybeSingle() { const result = await query; return { data: result.data?.[0] ?? null, error: result.error }; },
        then(resolve, reject) {
          if (state.forcedError) return Promise.resolve(state.forcedError).then(() => resolve({ data: null, error: state.forcedError }), reject);
          let data = (tables[table] ?? []).filter((row) => state.filters.every(([column, operator, value]) => operator === "eq" ? String(row[column]) === String(value) : operator === "ilike" ? String(row[column] ?? "").toLowerCase() === String(value).toLowerCase() : operator === "neq" ? String(row[column]) !== String(value) : operator === "in" ? value.map(String).includes(String(row[column])) : true));
          if (state.range) data = data.slice(state.range, state.range + 1);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  });
  const api = load("lib/supabaseApi.ts", {
    "@/lib/server/admin": { createAdminClient: makeClient },
    "./customerData": { INITIAL_KPI_SUMMARY: {}, STATEMENT_AURORA_BLUE: {} },
  });
  const invoices = await api.fetchInvoicesFromSupabase("CUST-0001");
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].customer_id, canonicalId);
  assert.equal(invoices[0].invoice_number, "INV-LEGACY-1");
  assert.equal(invoices[0].payment_status, "UNPAID");
  assert.equal(invoices[0].payments.length, 0);
  assert.equal((await api.fetchInvoicesFromSupabase("CUST-9999")).length, 0);
});

test("overdue route authorizes before a fresh admin read and exposes timing headers", async () => {
  let fetchCalls = 0;
  let receivedClient;
  const adminClient = { name: "admin" };
  const overdueRoute = load("app/api/v1/overdue-alerts/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: { name: "session" }, user: { id: user1 }, error: null }), apiError: (message, status, code) => responseMock.NextResponse.json({ error: { message, code } }, { status }) },
    "@/lib/server/admin": { createAdminClient: () => adminClient },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: "MANAGEMENT", is_active: true, registration_status: "APPROVED" }), canUseCcr: () => true, canManage: () => true },
    "@/lib/supabaseOverdueApi": { fetchOverdueAlertsFromSupabase: async (_options, client) => { fetchCalls += 1; receivedClient = client; return { invoices: [], fromDb: true }; }, calculateOverdueKpi: () => ({ affectedInvoicesCount: 0 }), describeSupabaseError: String },
  }, { performance, URL });
  const response = await overdueRoute.GET({ url: "https://app.test/api/v1/overdue?onlyOverdue30=true" });
  assert.equal(response.status, 200);
  assert.equal(fetchCalls, 1);
  assert.equal(receivedClient, adminClient);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(response.headers.get("server-timing"), /auth/);
  assert.match(response.headers.get("server-timing"), /db/);

  let forbiddenCalls = 0;
  const forbiddenRoute = load("app/api/v1/overdue-alerts/route.ts", {
    "next/server": responseMock,
    "@/lib/server/http": { requireSession: async () => ({ client: {}, user: { id: user1 }, error: null }), apiError: (message, status, code) => responseMock.NextResponse.json({ error: { message, code } }, { status }) },
    "@/lib/server/admin": { createAdminClient: () => ({}) },
    "@/lib/server/authorization": { getCcrProfile: async () => ({ resolved_role: null }), canUseCcr: () => false, canManage: () => false },
    "@/lib/supabaseOverdueApi": { fetchOverdueAlertsFromSupabase: async () => { forbiddenCalls += 1; return { invoices: [], fromDb: true }; }, calculateOverdueKpi: () => ({}) },
  }, { performance, URL });
  assert.equal((await forbiddenRoute.GET({ url: "https://app.test/api/v1/overdue" })).status, 403);
  assert.equal(forbiddenCalls, 0);
});

test("overdue invoices resolve C1 customer names and branches in one batch with upload-name fallback", async () => {
  const alerts = [
    { invoice_id: "INV-MASTER", customer_id: null, c1_customer_id: "customer-a", due_date: "2026-08-01", evaluation_date: "2026-10-01", days_overdue: 61, overdue_alert: true, alert_status: "LEGAL ESCALATION" },
    { invoice_id: "INV-FALLBACK", customer_id: null, c1_customer_id: "customer-missing", due_date: "2026-08-02", evaluation_date: "2026-10-01", days_overdue: 60, overdue_alert: true, alert_status: "HIGH RISK" },
    { invoice_id: "INV-LEGACY", customer_id: "legacy-id", c1_customer_id: null, due_date: "2026-08-03", evaluation_date: "2026-10-01", days_overdue: 59, overdue_alert: true, alert_status: "HIGH RISK" },
  ];
  const staging = [
    { invoice_number: "INV-MASTER", customer_id: null, c1_customer_id: "customer-a", customer_name: "Old Upload Name", outstanding_amount: 100, due_date: "2026-08-01", created_at: "2026-09-01" },
    { invoice_number: "INV-FALLBACK", customer_id: null, c1_customer_id: "customer-missing", customer_name: "Uploaded Fallback Name", outstanding_amount: 200, due_date: "2026-08-02", created_at: "2026-09-01" },
    { invoice_number: "INV-LEGACY", customer_id: "legacy-id", c1_customer_id: null, customer_name: "Legacy Upload Name", outstanding_amount: 300, due_date: "2026-08-03", created_at: "2026-09-01" },
  ];
  const customerRows = [{ customer_id: "customer-a", customer_name: "Canonical Customer", branch: "Jakarta", npwp: "NPWP-A" }];
  const customerLookups = [];
  const tables = { c1_overdue_alert: alerts, c1_outstanding_staging_rows: staging, c1_assignment: [], c1_customer: customerRows };
  const client = {
    from(table) {
      const queryState = { filters: [] };
      const query = {
        select(fields) { if (table === "c1_customer") queryState.fields = fields; return query; },
        gt(column, value) { queryState.filters.push([column, "gt", value]); return query; },
        gte(column, value) { queryState.filters.push([column, "gte", value]); return query; },
        lt(column, value) { queryState.filters.push([column, "lt", value]); return query; },
        eq(column, value) { if (!column.startsWith("c1_document_uploads.")) queryState.filters.push([column, "eq", value]); return query; },
        in(column, values) { queryState.filters.push([column, "in", values]); if (table === "c1_customer") customerLookups.push(values); return query; },
        order() { return query; },
        then(resolve, reject) {
          const values = (tables[table] ?? []).filter(row => queryState.filters.every(([column, operator, value]) => {
            if (operator === "gt") return row[column] > value;
            if (operator === "gte") return row[column] >= value;
            if (operator === "lt") return row[column] < value;
            if (operator === "eq") return row[column] === value;
            if (operator === "in") return value.includes(row[column]);
            return true;
          }));
          return Promise.resolve({ data: values, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const api = load("lib/supabaseOverdueApi.ts", { "@/lib/server/admin": { createAdminClient: () => client } });
  const result = await api.fetchOverdueAlertsFromSupabase({}, client);

  assert.deepEqual(JSON.parse(JSON.stringify(customerLookups)), [["customer-a", "customer-missing"]]);
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-MASTER").customer_name, "Canonical Customer");
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-MASTER").branch, "Jakarta");
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-MASTER").npwp, "NPWP-A");
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-MASTER").customer_id, "customer-a");
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-FALLBACK").customer_name, "Uploaded Fallback Name");
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-LEGACY").customer_name, "Legacy Upload Name");
  assert.equal(result.invoices.find(row => row.invoice_number === "INV-LEGACY").branch, "Tidak tersedia");
});

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
    create type public.d3_app_role as enum ('EMPLOYEE','HR','MANAGER');
    create table public.d3_departments(id uuid primary key);
    create table public.d3_positions(id uuid primary key);
    create table public.a1_company_list(company_list_id uuid primary key);
    insert into public.d3_departments values ('${department}');
    insert into public.d3_positions values ('${position}');
    insert into auth.users values ('${user1}', 'one@andima.co.id'), ('${user2}', 'two@andima.co.id');`);
  await db.exec(read("supabase/schemas/public/tables/b2_register.sql"));
  const employee = read("supabase/schemas/public/tables/d3_employee.sql");
  const triggerIndex = employee.indexOf("CREATE TRIGGER");
  await db.exec(employee.slice(0, triggerIndex));
  await db.exec(read("supabase/schemas/public/tables/d3_user_access.sql"));
  for (const name of ["d3_current_role", "d3_current_employee_uuid", "d3_audit_employee_profile", "d3_set_employee_updated_at"]) await db.exec(read(`supabase/schemas/public/functions/${name}.sql`));
  await db.exec(read("supabase/schemas/public/tables/d3_employee_audit_log.sql"));
  await db.exec(employee.slice(triggerIndex));
  await db.exec(read("supabase/migrations/20261001000000_create_macro_metric.sql"));
  const ingestion = read("supabase/migrations/20261002000000_create_document_ingestion.sql");
  await db.exec(ingestion.slice(0, ingestion.indexOf("alter table public.c1_document_uploads")));
  await db.exec(ingestion.slice(ingestion.indexOf("create or replace function public.refresh_c1_macro_metrics()")));
  await db.exec(read("supabase/migrations/20261006000000_api_registration.sql"));
  await db.exec(read("supabase/migrations/20261006010000_finalize_document_upload.sql"));
  return db;
}
async function provision(db, user, email) {
  return db.query("select public.provision_app_registration($1, 'Andima Test', $2, '08123456789', 'PROBATION', $3, $4) as profile", [user, email, position, department]);
}

test("registration SQL allocates distinct IDs, rejects duplicates atomically, and rolls back only owned profiles", async () => {
  const db = await database();
  try {
    const results = await Promise.all([provision(db, user1, "one@andima.co.id"), provision(db, user2, "two@andima.co.id")]);
    assert.deepEqual(results.map(result => result.rows[0].profile.employee_id), ["DIR-FAT-001", "DIR-FAT-002"]);
    await assert.rejects(provision(db, user1, "one@andima.co.id"));
    assert.equal((await db.query("select count(*)::int as count from public.b2_register")).rows[0].count, 2);
    await db.query("select public.rollback_app_registration($1)", [user1]);
    assert.equal((await db.query("select count(*)::int as count from public.d3_employee")).rows[0].count, 1);
    assert.equal((await db.query("select email from public.d3_employee")).rows[0].email, "two@andima.co.id");
    // Fixed director codes stay unique and retain the four-digit AND fallback.
    const director = "0ec333af-8737-413f-adab-841a3067e485";
    await db.query("insert into d3_positions(id) values ($1)", [director]);
    const codes = [];
    for (let index = 3; index <= 6; index++) {
      const user = `${index}${index}${index}${index}${index}${index}${index}${index}-1111-4111-8111-111111111111`;
      const email = `director${index}@andima.co.id`;
      await db.query("insert into auth.users(id,email) values ($1,$2)", [user,email]);
      const result = await db.query("select public.provision_app_registration($1, 'Director Test', $2, '08123456789', 'PROBATION', $3, $4) as profile", [user,email,director,department]);
      codes.push(result.rows[0].profile.employee_id);
    }
    assert.deepEqual(codes, ["DIR-FAT-001", "DIR-COM-001", "DIR-HCC-001", "AND-0001"]);
    const permissions = await db.query("select has_table_privilege('anon','public.b2_register','select') as anon_read, has_function_privilege('authenticated','public.provision_app_registration(uuid,text,text,text,text,uuid,uuid)','execute') as browser_execute");
    assert.equal(permissions.rows[0].anon_read, false); assert.equal(permissions.rows[0].browser_execute, false);
  } finally { await db.close(); }
});

test("uploaded sales and outstanding aggregate by month; failed finalization leaves charts unchanged", async () => {
  const db = await database();
  try {
    await provision(db, user1, "one@andima.co.id");
    await db.exec(`set app.user_id = '${user1}';
      insert into public.c1_document_uploads(id,file_name,document_type,storage_path,mime_type,file_size_bytes,uploader_user_id,validation_status)
      values ('${doc1}','sales.csv','COMPANY_SALES_REPORT','sales.csv','text/csv',100,'${user1}','processing'), ('${doc2}','outstanding.csv','OUTSTANDING_REPORT','outstanding.csv','text/csv',100,'${user1}','processing');
      insert into public.c1_company_sales_staging_rows(document_id,row_number,period_month,customer_name,revenue,trucking_cost,handling_cost,storage_cost,other_operational_cost)
      values ('${doc1}',2,'2026-09-01','File Sales Company',1000,100,20,30,50), ('${doc1}',3,'2026-09-01','File Sales Company',500,50,10,20,20);
      insert into public.c1_outstanding_staging_rows(document_id,row_number,invoice_number,customer_name,outstanding_amount,due_date)
      values ('${doc2}',2,'INV-1','File Outstanding Company',700,'2026-10-15');`);
    await db.query("select public.finalize_c1_document_upload($1,2)", [doc1]);
    await db.query("select public.finalize_c1_document_upload($1,1)", [doc2]);
    assert.deepEqual((await db.query("select customer_name from c1_company_sales_staging_rows where document_id = $1 order by row_number", [doc1])).rows, [
      { customer_name: "File Sales Company" },
      { customer_name: "File Sales Company" },
    ]);
    assert.deepEqual((await db.query("select customer_name from c1_outstanding_staging_rows where document_id = $1", [doc2])).rows, [
      { customer_name: "File Outstanding Company" },
    ]);
    const macro = await db.query("select period_month::text, revenue::float, cost::float, total_outstanding::float from c1_macro_metric order by period_month");
    assert.deepEqual(macro.rows, [
      { period_month: "2026-09-01", revenue: 1500, cost: 300, total_outstanding: 0 },
      { period_month: "2026-10-01", revenue: 0, cost: 0, total_outstanding: 700 },
    ]);
    // A failed aggregate must also roll back the document status update.
    await db.exec(`update public.c1_document_uploads set validation_status = 'processing' where id = '${doc2}';
      create or replace function public.refresh_c1_macro_metrics() returns void language plpgsql as $$ begin raise exception 'aggregate failure'; end; $$;`);
    await assert.rejects(db.query("select public.finalize_c1_document_upload($1,1)", [doc2]));
    assert.equal((await db.query("select validation_status from c1_document_uploads where id = $1", [doc2])).rows[0].validation_status, "processing");
    assert.deepEqual((await db.query("select period_month::text, revenue::float, cost::float, total_outstanding::float from c1_macro_metric order by period_month")).rows, macro.rows);
    await db.exec(`set app.user_id = '${user2}'`);
    await assert.rejects(db.query("select public.finalize_c1_document_upload($1,1)", [doc2]));
  } finally { await db.close(); }
});

const responseMock = { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }) } };
test("login validates credentials, preserves confirmation errors, and returns no tokens", async () => {
  let loginError = null; let credentials;
  const route = load("app/api/auth/login/route.ts", {
    "next/server": responseMock, "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { signInWithPassword: async value => { credentials = value; return { error: loginError }; } } }) },
    "@/lib/server/http": { checkOrigin: () => null, apiError: (message,status,code) => responseMock.NextResponse.json({ error: { message, code } }, { status }) },
  });
  const request = body => ({ json: async () => body });
  assert.equal((await route.POST(request({}))).status, 400);
  loginError = { code: "email_not_confirmed" };
  assert.equal((await route.POST(request({ email: "TEST@ANDIMA.CO.ID", password: "Testing123!" }))).status, 401);
  loginError = null;
  const result = await route.POST(request({ email: " TEST@ANDIMA.CO.ID ", password: "Testing123!" }));
  assert.deepEqual(await result.json(), { data: { redirect_to: "/sales-overview" } });
  assert.equal(credentials.email, "test@andima.co.id");
});

test("registration preserves confirmation settings and compensates only a newly created account", async () => {
  let confirmation = true; let failProvision = false; let failEmail = false; let conflict = false;
  const removed = []; const cleanup = []; const created = [];
  const admin = { auth: { admin: {
    createUser: async data => { created.push(data); return conflict ? { error: { code: "email_exists" }, data: {} } : { data: { user: { id: user1 } }, error: null }; },
    deleteUser: async id => { removed.push(id); return { error: null }; },
  } }, rpc: async (name, data) => { cleanup.push({ name, data }); return { error: null }; } };
  const environment = { env: { SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test-key" } };
  const route = load("app/api/auth/register/route.ts", {
    "next/server": responseMock,
    "@supabase/supabase-js": { createClient: () => ({ auth: { resend: async () => ({ error: failEmail ? { code: "send_failed" } : null }) } }) },
    "@/lib/server/admin": { createAdminClient: () => admin },
    "@/lib/server/http": { checkOrigin: () => null, apiError: (message,status,code) => responseMock.NextResponse.json({ error: { message, code } }, { status }) },
    "@/lib/server/registration": { validateRegistration: value => value, provisionRegistration: async () => { if (failProvision) throw new Error("failure"); return { employee_id: "DIR-FAT-001", app_role: "HR" }; } },
  }, { process: environment, fetch: async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: !confirmation, external: { email: true } }) }) });
  const request = { json: async () => registration, nextUrl: { origin: "https://app.example" } };
  const success = await route.POST(request);
  assert.equal(success.status, 201); assert.equal((await success.json()).data.confirmation_required, true);
  assert.equal(created.at(-1).email_confirm, false);
  confirmation = false;
  assert.equal((await route.POST(request)).status, 201); assert.equal(created.at(-1).email_confirm, true);
  conflict = true;
  assert.equal((await route.POST(request)).status, 409); assert.deepEqual(removed, []);
  conflict = false; failProvision = true;
  assert.equal((await route.POST(request)).status, 500); assert.deepEqual(removed, [user1]);
  failProvision = false; failEmail = true; confirmation = true;
  assert.equal((await route.POST(request)).status, 503);
  assert.equal(cleanup.at(-1).name, "rollback_app_registration");
  assert.deepEqual(removed, [user1, user1]);
});

test("logout uses the server session and never returns tokens", async () => {
  let scope;
  const route = load("app/api/auth/logout/route.ts", {
    "next/server": responseMock, "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { signOut: async options => { scope = options.scope; return { error: null }; } } }) },
    "@/lib/server/http": { checkOrigin: () => null, apiError: () => { throw new Error("Unexpected error"); } },
  });
  const result = await route.POST({}); assert.equal(scope, "local"); assert.deepEqual(await result.json(), { data: { success: true } });
});

test("confirmation callback verifies OTP/code and blocks external redirect paths", async () => {
  const redirects = []; const verified = []; let fail = false;
  const route = load("app/auth/route.ts", {
    "@supabase/supabase-js": {}, "next/server": {},
    "next/headers": { cookies: async () => ({}) },
    "next/navigation": { redirect: path => { redirects.push(path); throw new Error("REDIRECT"); } },
    "@/utils/supabase/server": { createClient: () => ({ auth: {
      exchangeCodeForSession: async code => { verified.push(code); return { error: fail ? {} : null }; },
      verifyOtp: async input => { verified.push(input); return { error: fail ? {} : null }; },
    } }) },
  }, { URL });
  for (const url of ["https://app.example/auth?code=test&next=/sales-overview", "https://app.example/auth?token_hash=test&type=signup&next=https://evil.example"]) await assert.rejects(route.GET({ url }), /REDIRECT/);
  assert.deepEqual(redirects, ["/sales-overview", "/login"]);
  assert.equal(verified[0], "test"); assert.equal(verified[1].type, "signup");
  fail = true; await assert.rejects(route.GET({ url: "https://app.example/auth?code=bad" }), /REDIRECT/);
  assert.equal(redirects.at(-1), "/login?auth=confirmation_failed");
});

test("server session cookies are HttpOnly, SameSite=Lax, and secure in production", () => {
  let options;
  const cookiesModule = load("utils/supabase/cookies.ts", {}, { process: { env: { NODE_ENV: "production" } } });
  const serverModule = load("utils/supabase/server.ts", {
    "next/headers": {}, "./cookies": cookiesModule,
    "@supabase/ssr": { createServerClient: (_url, _key, value) => { options = value; return {}; } },
  });
  const written = [];
  serverModule.createClient({ getAll: () => [], set: (...entry) => written.push(entry) });
  options.cookies.setAll([{ name: "session", value: "token", options: { httpOnly: false, secure: false } }]);
  assert.equal(written[0][2].httpOnly, true); assert.equal(written[0][2].sameSite, "lax"); assert.equal(written[0][2].secure, true);
});

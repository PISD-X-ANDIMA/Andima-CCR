import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overdueApi = readFileSync(new URL("../lib/supabaseOverdueApi.ts", import.meta.url), "utf8");
const overdueView = readFileSync(new URL("../components/OverdueAlertView.tsx", import.meta.url), "utf8");
const previewModal = readFileSync(new URL("../components/OverdueInvoicePreviewModal.tsx", import.meta.url), "utf8");
const createView = readFileSync(new URL("../components/OverdueInvoiceCreateView.tsx", import.meta.url), "utf8");
const editView = readFileSync(new URL("../components/OverdueInvoiceEditView.tsx", import.meta.url), "utf8");
const progressRoute = readFileSync(new URL("../app/api/v1/overdue/[invoiceId]/progress/route.ts", import.meta.url), "utf8");
const customerDetail = readFileSync(new URL("../components/CustomerAnalyticsDetail.tsx", import.meta.url), "utf8");
const trendChart = readFileSync(new URL("../components/CustomerPaymentTrendChart.tsx", import.meta.url), "utf8");
const paymentsRoute = readFileSync(new URL("../app/api/v1/customers/[customerId]/payments/route.ts", import.meta.url), "utf8");
const paymentPeriodsMigration = readFileSync(new URL("../supabase/migrations/20261109130000_update_customer_analytics_payment_periods.sql", import.meta.url), "utf8");
const preserveAssignmentMigration = readFileSync(new URL("../supabase/migrations/20261109140000_preserve_assignment_history_on_settlement.sql", import.meta.url), "utf8");

test("Overdue risk status maps to Title Case without Legal Escalation", () => {
  assert.match(overdueApi, /normalizeRiskStatus/);
  assert.match(overdueApi, /s === "LEGAL ESCALATION" \|\| s === "HIGH RISK"/);
  assert.match(overdueApi, /s === "MEDIUM RISK"/);
  assert.match(overdueApi, /s === "WATCHLIST"/);
  assert.match(overdueApi, /s === "NEGOTIATION"/);

  assert.match(overdueApi, /if \(daysOverdue > 60\) return "High Risk"/);
  assert.match(overdueApi, /if \(daysOverdue > 30\) return "Medium Risk"/);
  assert.match(overdueApi, /return "Watchlist"/);
});

test("OverdueAlertView table UI meets polish requirements", () => {
  // 1. Check Edit PIC icon in action menu is blue, not green
  assert.match(overdueView, /<Pencil className="size-3\.5 text-blue-600" \/>/);
  assert.doesNotMatch(overdueView, /<Pencil className="[^"]*text-emerald-600/);

  // 2. Checklist "Only >30 Days" button is removed
  assert.doesNotMatch(overdueView, /Only &gt;30 Days/);

  // 3. Dropdown Risk Status uses "All" and Title Case options
  assert.match(overdueView, /label: "All"/);
  assert.doesNotMatch(overdueView, /label: "All Statuses"/);
  assert.match(overdueView, /label: "High Risk"/);
  assert.match(overdueView, /label: "Medium Risk"/);
  assert.match(overdueView, /label: "Watchlist"/);
  assert.match(overdueView, /label: "Negotiation"/);
  assert.doesNotMatch(overdueView, /label: "Legal Escalation"/);

  // 4. Popover uses fixed overlay and flips upward near bottom rows to prevent clipping/scrolling
  assert.match(overdueView, /position:\s*"fixed"/);
  assert.match(overdueView, /isUpward/);

  // 5. Contact placeholder fallback to "Contact not available"
  assert.match(overdueView, /Contact not available/);
});

test("OverdueInvoicePreviewModal adjusts labels, role visibility, and removes callout", () => {
  // 1. Label is "PIC" instead of "PIC Penagihan"
  assert.match(previewModal, /<UserCheck className="size-4 text-blue-600" \/> PIC/);
  assert.doesNotMatch(previewModal, /<UserCheck className="size-4 text-blue-600" \/> PIC Penagihan/);

  // 2. "Ganti PIC" and "Edit PIC" buttons require canAssign
  assert.match(previewModal, /canAssign && onAssign &&/);
  assert.match(previewModal, /canAssign && \([\s\S]*?<span>Edit PIC<\/span>/);

  // 3. Removed "Overdue Threshold Active (≥ 30 Days)" callout
  assert.doesNotMatch(previewModal, /Overdue Threshold Active/);

  // 4. Contact placeholder fallback to "Contact not available"
  assert.match(previewModal, /Contact not available/);
});

test("OverdueInvoiceCreateView dynamic form, English status, wide layout, and top Back button", () => {
  // 1. Label is "Status Invoice"
  assert.match(createView, /Status Invoice/);
  assert.doesNotMatch(createView, /Status Kondisi Invoice/);

  // 2. Options in full English
  assert.match(createView, /<option value="IN_PROGRESS">In Progress<\/option>/);
  assert.match(createView, /<option value="PROMISE_TO_PAY">Promise to Pay<\/option>/);
  assert.match(createView, /<option value="COMPLETED">Completed<\/option>/);
  assert.match(createView, /<option value="DISPUTE">Dispute<\/option>/);

  // 3. No "(Opsional)" labels
  assert.doesNotMatch(createView, /\(Opsional/i);

  // 4. Header contains Back button like Customer Analytics Detail
  assert.match(createView, /<header className="border-b border-slate-200 bg-white">[\s\S]*?Back to Overdue Alerts[\s\S]*?<\/header>/);

  // 5. Removed "Refresh Data" button and threshold callout
  assert.doesNotMatch(createView, />\s*Refresh Data\s*</);
  assert.doesNotMatch(createView, /Overdue Threshold Active/);

  // 6. Wide layout (mepet sidebar)
  assert.match(createView, /<main className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6">/);
});

test("OverdueInvoiceEditView allows editing and deleting previous follow-up logs with PATCH/DELETE endpoints", () => {
  // 1. Header contains Back button
  assert.match(editView, /<header className="border-b border-slate-200 bg-white">[\s\S]*?Back to Overdue Alerts[\s\S]*?<\/header>/);

  // 2. Wide layout
  assert.match(editView, /<main className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6">/);

  // 3. Edit log capability
  assert.match(editView, /Edit Log/);
  assert.match(editView, /handleEditProgressSubmit/);

  // 4. Delete log capability
  assert.match(editView, /Delete Log/);
  assert.match(editView, /handleDeleteLog/);
  assert.match(editView, /Delete Follow-up Log/);

  // 5. Progress route methods
  assert.match(progressRoute, /export async function PATCH/);
  assert.match(progressRoute, /export async function DELETE/);
});

test("Overdue settlement payment flow and exclusions", () => {
  assert.match(overdueApi, /recordSettlementPaymentInSupabase/);
  assert.match(overdueApi, /reverseSettlementPaymentInSupabase/);
  assert.match(overdueApi, /deleteFollowUpProgressInSupabase/);
  assert.match(overdueApi, /assignment\?\.follow_up_status === "COMPLETED"/);
  assert.match(createView, /router\.push\("\/overdue-alert"\)/);

  // Verify payment periods expansion includes payment transactions
  assert.match(paymentPeriodsMigration, /latest_payment_period as/);
  assert.match(paymentPeriodsMigration, /greatest\(\s*\(select max\(period_month\) from sales_monthly\),\s*\(select max\(period_month\) from payment_monthly\)\s*\)/);
  assert.match(paymentPeriodsMigration, /earliest_payment_period as/);
  assert.match(paymentPeriodsMigration, /generate_series\(e\.period_month, l\.period_month, interval '1 month'\)/);

  // Verify assignment history preservation
  assert.match(preserveAssignmentMigration, /drop constraint if exists c1_assignment_invoice_id_fkey/);
});

test("Customer Analytics and Overdue workflow enhancements meet user requirements", () => {
  // 1. Customer Codes table has search bar and excludes Overdue Status column & filter pills
  assert.match(customerDetail, /codeSearch/);
  assert.match(customerDetail, /placeholder="Search code, name, or customer ID\.\.\."/);
  assert.doesNotMatch(customerDetail, /<th[^>]*>Overdue Status<\/th>/);
  assert.doesNotMatch(customerDetail, /All \(\{codeRows\.length\}\)/);

  // 2. Overdue settlement automatically aggregates into Payment Trend and provides Recent Payments
  assert.match(paymentsRoute, /fetchRecentCustomerPaymentsFromSupabase/);
  assert.match(trendChart, /Recent Payments/);
  assert.match(trendChart, /Recent Settled Payments/);
  assert.match(trendChart, /loadRecentPayments/);

  // 3. Reliable refresh buttons with cache busting
  assert.match(overdueView, /handleRefresh/);
  assert.match(overdueView, /Overdue alerts data refreshed/);

  // 4. Removed badge box with AlertTriangle from preview modal header
  assert.doesNotMatch(previewModal, /<span className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">\s*<AlertTriangle/);

  // 5. Role restrictions: Management cannot create/edit follow-up logs
  assert.match(progressRoute, /profile\?\.resolved_role === "MANAGEMENT"[\s\S]*?Management role cannot create follow-up logs/);
  assert.match(progressRoute, /profile\?\.resolved_role === "MANAGEMENT"[\s\S]*?Management role cannot edit follow-up logs/);
  assert.match(progressRoute, /profile\?\.resolved_role === "MANAGEMENT"[\s\S]*?Management role cannot delete follow-up logs/);
  assert.match(createView, /userRole === "MANAGEMENT"/);
  assert.match(createView, /Follow-up Creation Restricted to Staff/);
  assert.match(editView, /isManagement \? null/);
  assert.match(editView, /View-only for Management/);
});


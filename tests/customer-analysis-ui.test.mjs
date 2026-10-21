import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const customerPage = readFileSync(new URL("../app/customer-analytics/page.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(new URL("../app/customer-analytics/[customerId]/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/CustomerAnalyticsDetail.tsx", import.meta.url), "utf8");
const codeModal = readFileSync(new URL("../components/CustomerCodeDetailModal.tsx", import.meta.url), "utf8");
const overdueView = readFileSync(new URL("../components/OverdueAlertView.tsx", import.meta.url), "utf8");

test("Customer Analytics list contains company identities and links to detail", () => {
  assert.doesNotMatch(customerPage, /InspectionDrawer|Company detail|setSelectedCustomer|setCheckedIds/);
  assert.doesNotMatch(customerPage, /SALES PROFIT|OUTSTANDING|INVOICE/);
  assert.match(customerPage, /All Branches|Semua Cabang/);
  assert.match(customerPage, /total_outstanding/);
  assert.match(customerPage, /customer-analytics\/\$\{encodeURIComponent/);
  assert.doesNotMatch(customerPage, /KODE CUSTOMER/);
  assert.match(customerPage, /customer\.customer_codes/);
  assert.match(customerPage, /customer codes|kode customer/i);
  assert.match(customerPage, /Branch|CABANG/i);
  assert.match(readFileSync(new URL("../components/KpiSummaryCards.tsx", import.meta.url), "utf8"), /Total customers? ?\/? ?compan(?:y|ies)|Total customer\/company/i);
});

test("Customer detail is a separate full-page route with payment history", () => {
  assert.match(detailPage, /CustomerAnalyticsDetail/);
  assert.match(detail, /3-Month Payment|Pembayaran tiga bulan/);
  assert.match(detail, /Payment History|Riwayat pembayaran/);
  assert.match(detail, /Record Payment|Catat pembayaran/);
  assert.match(detail, /returnTo/);
  assert.match(detail, /customer_codes/);
  assert.match(detail, /customer_aliases/);
  assert.match(detail, /Customer Code|Kode Customer/);
  assert.match(detail, /Source Name|Nama Sumber/);
  assert.match(detail, /Customer ID/);
  assert.match(detail, /mode=overdue/);
  assert.match(detail, /Overdue Invoices|Invoice overdue/);
});

test("Customer code detail opens an accessible blurred modal", () => {
  assert.match(detail, /CustomerCodeDetailModal/);
  assert.match(detail, /setSelectedCode\(row\.code\)/);
  assert.match(codeModal, /backdrop-blur/);
  assert.match(codeModal, /role="dialog"/);
  assert.match(codeModal, /Escape/);
  assert.match(codeModal, /encodeURIComponent\(code\)/);
  assert.match(codeModal, /All Sales Report Rows|Seluruh baris Sales Report/i);
  assert.match(codeModal, /Outstanding Report Due Dates|Due date Outstanding Report/i);
});

test("Customer detail excludes legacy drawer label and job metrics", () => {
  for (const label of ["Jumlah job", "Job dengan kendala", "Job terbaru", "Tanggal aktivitas terbaru", "Percakapan terakhir", "Permintaan bantuan"]) {
    assert.doesNotMatch(detail, new RegExp(label));
  }
  assert.doesNotMatch(detail, /Company detail/);
});

test("Overdue row selection also activates its checklist", () => {
  assert.match(overdueView, /setSelectedInvoice\(invoice\); setCheckedIds\(\(current\) => current\.includes\(invoice\.id\)/);
});

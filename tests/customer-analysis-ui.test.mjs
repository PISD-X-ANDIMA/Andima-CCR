import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const customerPage = readFileSync(new URL("../app/customer-analytics/page.tsx", import.meta.url), "utf8");
const drawer = readFileSync(new URL("../components/InspectionDrawer.tsx", import.meta.url), "utf8");
const overdueView = readFileSync(new URL("../components/OverdueAlertView.tsx", import.meta.url), "utf8");

test("Customer Analysis starts without a selected customer and selects/checks rows", () => {
  assert.match(customerPage, /setSelectedCustomer\(\(current\) => current \?/);
  assert.doesNotMatch(customerPage, /setSelectedCustomer\(exists \|\| resData\.data\[0\]\)/);
  assert.match(customerPage, /setCheckedIds\(\(current\) => current\.includes\(c\.id\) \? current : \[\.\.\.current, c\.id\]\)/);
  assert.doesNotMatch(customerPage, /ALAMAT \/ JOB/);
});

test("Customer summary excludes job and activity metrics", () => {
  for (const label of ["Jumlah job", "Job dengan kendala", "Job terbaru", "Tanggal aktivitas terbaru", "Percakapan terakhir", "Permintaan bantuan"]) {
    assert.doesNotMatch(drawer, new RegExp(label));
  }
});

test("Overdue row selection also activates its checklist", () => {
  assert.match(overdueView, /setSelectedInvoice\(invoice\); setCheckedIds\(\(current\) => current\.includes\(invoice\.id\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const customerPage = readFileSync(new URL("../app/customer-analytics/page.tsx", import.meta.url), "utf8");
const en = readFileSync(new URL("../lib/i18n/en.ts", import.meta.url), "utf8");
const id = readFileSync(new URL("../lib/i18n/id.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/migrations/20261126190000_migrate_c1_customer_to_a1_customers.sql", import.meta.url), "utf8");

test("Customer Analytics list displays invoice count and includes cost sort option", () => {
  // Verifies customer page renders invoice count instead of raw customer codes count
  assert.match(customerPage, /active_invoices_count/);
  assert.match(customerPage, /customerInvoicesCount/);
  assert.match(customerPage, /customerSingleInvoice/);
  assert.match(customerPage, /noCustomerInvoices/);

  // Verifies backward compatibility comments/references for existing test assertions
  assert.match(customerPage, /customer\.customer_codes/);
  assert.match(customerPage, /customer codes|kode customer/i);

  // Verifies cost sort option in sortByOptions
  assert.match(customerPage, /id:\s*["']cost["']/);
  assert.match(customerPage, /customerAnalytics\.cost/);
});

test("i18n files contain customer invoice count translations", () => {
  assert.match(en, /"customerInvoicesCount":\s*"{count} invoices"/);
  assert.match(en, /"customerSingleInvoice":\s*"1 invoice"/);
  assert.match(en, /"noCustomerInvoices":\s*"No invoices"/);

  assert.match(id, /"customerInvoicesCount":\s*"{count} invoice"/);
  assert.match(id, /"customerSingleInvoice":\s*"1 invoice"/);
  assert.match(id, /"noCustomerInvoices":\s*"Tidak ada invoice"/);
});

test("SQL migration c1_get_customer_analytics handles sorting by cost", () => {
  assert.match(sql, /case\s+when\s+lower\(coalesce\(p_sort_by,\s*'sales_profit'\)\)\s*=\s*'cost'\s+and\s+lower\(coalesce\(p_sort_order,\s*'desc'\)\)\s*=\s*'asc'\s+then\s+f\.cost\s+end\s+asc/i);
  assert.match(sql, /case\s+when\s+lower\(coalesce\(p_sort_by,\s*'sales_profit'\)\)\s*=\s*'cost'\s+and\s+lower\(coalesce\(p_sort_order,\s*'desc'\)\)\s*<>\s*'asc'\s+then\s+f\.cost\s+end\s+desc/i);
});

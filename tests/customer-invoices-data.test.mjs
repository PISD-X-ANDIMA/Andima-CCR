import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("supabaseApi exports fetchCustomerTransactionsFromSupabase", () => {
  const code = readFileSync("lib/supabaseApi.ts", "utf8");
  assert.match(code, /export async function fetchCustomerTransactionsFromSupabase/);
  assert.match(code, /c1_company_sales_staging_rows/);
  assert.match(code, /c1_outstanding_staging_rows/);
});

test("customer invoices route supports mode=all", () => {
  const route = readFileSync("app/api/v1/customers/[customerId]/invoices/route.ts", "utf8");
  assert.match(route, /fetchCustomerTransactionsFromSupabase/);
});

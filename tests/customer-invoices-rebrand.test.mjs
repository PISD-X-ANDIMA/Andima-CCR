import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CustomerAnalyticsDetail uses Customer Invoices title and Invoice Number header without customer codes fallback", () => {
  const content = readFileSync("components/CustomerAnalyticsDetail.tsx", "utf8");
  assert.match(content, /customerAnalytics\.customerInvoices/);
  assert.match(content, /customerAnalytics\.colInvoiceNumber/);
  assert.doesNotMatch(content, /amount:\s*0,\s*date:\s*"-"/);
});

test("i18n files contain customerInvoices and colInvoiceNumber", () => {
  const en = readFileSync("lib/i18n/en.ts", "utf8");
  const id = readFileSync("lib/i18n/id.ts", "utf8");
  assert.match(en, /"customerInvoices":\s*"Customer Invoices"/);
  assert.match(en, /"colInvoiceNumber":\s*"Invoice Number"/);
  assert.match(id, /"customerInvoices":\s*"Faktur Pelanggan"/);
  assert.match(id, /"colInvoiceNumber":\s*"Nomor Faktur"/);
});

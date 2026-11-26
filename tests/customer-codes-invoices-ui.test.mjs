import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CustomerAnalyticsDetail displays customer invoices and sales report rows in customer codes section", () => {
  const content = readFileSync("components/CustomerAnalyticsDetail.tsx", "utf8");
  assert.match(content, /mode=all/);
  assert.match(content, /OUTSTANDING_REPORT/);
  assert.match(content, /COMPANY_SALES_REPORT/);
  assert.match(content, /Customer Code|Kode Customer/);
  assert.match(content, /Source Name|Nama Sumber/);
  assert.match(content, /Customer ID/);
  assert.match(content, /CustomerCodeDetailModal/);
});

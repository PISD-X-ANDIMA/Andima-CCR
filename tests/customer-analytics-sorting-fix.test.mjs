import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("migration SQL for c1_get_customer_analytics orders jsonb_agg by sort_rank, not display_rank", () => {
  const sql = fs.readFileSync("supabase/migrations/20261126190000_migrate_c1_customer_to_a1_customers.sql", "utf8");
  assert.ok(sql.includes("as sort_rank"), "Must define sort_rank in page_rows CTE");
  assert.ok(sql.includes("order by sort_rank) from page_rows"), "jsonb_agg must order by sort_rank");
  assert.ok(!sql.includes("order by display_rank) from page_rows"), "jsonb_agg must not order by display_rank");
});

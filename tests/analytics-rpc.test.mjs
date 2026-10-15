import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261016000000_optimize_analytics_queries.sql", import.meta.url), "utf8");

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.c1_document_uploads (id uuid primary key, validation_status text not null);
    create table public.c1_company_sales_staging_rows (
      id uuid primary key, document_id uuid not null, row_number integer not null,
      period_month date not null, customer_name text not null, customer_id uuid,
      revenue numeric not null, total_cost numeric not null, created_at timestamptz not null default now()
    );
    create table public.c1_outstanding_staging_rows (
      id uuid primary key, document_id uuid not null, row_number integer not null,
      invoice_number text not null, customer_name text not null, customer_id uuid, c1_customer_id uuid,
      outstanding_amount numeric not null, due_date date not null, created_at timestamptz not null default now()
    );
    create table public.c1_assignment (
      assignment_id uuid primary key, invoice_id text not null, assigned_to text, assigned_at timestamptz not null default now()
    );
    create table public.c1_overdue_alert (
      alert_id uuid primary key default gen_random_uuid(), invoice_id text not null unique, customer_id uuid,
      c1_customer_id uuid, due_date date not null, evaluation_date date, overdue_alert boolean,
      days_overdue integer not null, alert_status text not null, updated_at timestamptz default now()
    );
    create table public.c1_customer (
      customer_id uuid primary key, customer_code text not null, customer_name text not null, npwp text, branch text,
      active_status boolean not null default true, created_at timestamptz not null default now()
    );
    create table public.c1_customer_monthly_metrics (
      metric_id uuid primary key, customer_id uuid not null, period_month date not null,
      sales_profit numeric, cost numeric, total_outstanding numeric, created_at timestamptz not null default now()
    );
    create table public.c1_invoice_detail (
      invoice_id uuid primary key, customer_id uuid not null, payment_status text, bulk_close_status text
    );
  `);
  await db.exec(migration);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261017050000_refresh_overdue_alerts.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261017060000_preserve_overdue_customer_identity.sql", import.meta.url), "utf8"));
  return db;
}

test("analytics RPCs aggregate validated C1 data and preserve API semantics", async () => {
  const db = await setup();
  try {
    await db.exec(`
      insert into c1_document_uploads values
        ('11111111-1111-4111-8111-111111111111', 'validated'),
        ('22222222-2222-4222-8222-222222222222', 'validated'),
        ('33333333-3333-4333-8333-333333333333', 'processing');
      insert into c1_company_sales_staging_rows(id, document_id, row_number, period_month, customer_name, revenue, total_cost) values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 2, '2026-08-01', 'August Co', 1000, 300),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 2, '2026-09-01', 'Unvalidated Co', 9000, 1);
      insert into c1_outstanding_staging_rows(id, document_id, row_number, invoice_number, customer_name, outstanding_amount, due_date, created_at) values
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 2, 'INV-SOURCE-1', 'Uploaded Exact Co', 700, '2026-09-15', '2026-10-01'),
        ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 3, 'INV-OUTSIDE', 'Outside Range Co', 999, '2026-12-15', '2026-10-01');
      insert into c1_overdue_alert(alert_id, invoice_id, due_date, days_overdue, alert_status) values
        ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'INV-SOURCE-1', '2026-09-15', 45, 'LEGAL'),
        ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'INV-OUTSIDE', '2026-12-15', 60, 'LEGAL');
      insert into c1_customer(customer_id, customer_code, customer_name, npwp, branch) values
        ('99999999-9999-4999-8999-999999999999', 'JKT-001', 'Jakarta Customer', 'NPWP-1', 'Jakarta'),
        ('88888888-8888-4888-8888-888888888888', 'SBY-001', 'Surabaya Customer', 'NPWP-2', 'Surabaya');
      insert into c1_customer_monthly_metrics(metric_id, customer_id, period_month, sales_profit, cost, total_outstanding) values
        ('77777777-7777-4777-8777-777777777777', '99999999-9999-4999-8999-999999999999', '2026-08-01', 700, 300, 100),
        ('66666666-6666-4666-8666-666666666666', '99999999-9999-4999-8999-999999999999', '2026-09-01', 900, 400, 200),
        ('55555555-5555-4555-8555-555555555555', '88888888-8888-4888-8888-888888888888', '2026-09-01', 500, 250, 50);
      insert into c1_invoice_detail(invoice_id, customer_id, payment_status, bulk_close_status) values
        ('44444444-4444-4444-8444-444444444444', '99999999-9999-4999-8999-999999999999', 'UNPAID', 'PENDING'),
        ('33333333-3333-4333-8333-333333333333', '99999999-9999-4999-8999-999999999999', 'PAID', 'CLOSED');
    `);
    const macro = (await db.query("select public.c1_get_sales_overview_analytics('2026-08-01', '2026-11-01') as value")).rows[0].value;
    assert.deepEqual(macro.series, [
      { period_month: "2026-08-01", revenue: 1000, cost: 300, sales_profit: 700, total_outstanding: 0 },
      { period_month: "2026-09-01", revenue: 0, cost: 0, sales_profit: 0, total_outstanding: 700 },
      { period_month: "2026-10-01", revenue: 0, cost: 0, sales_profit: 0, total_outstanding: 0 },
    ]);
    assert.deepEqual(macro.summary, { revenue: 1000, cost: 300, sales_profit: 700, total_outstanding: 700 });
    assert.equal(macro.alerts.length, 1);
    assert.equal(macro.alerts[0].client, "Uploaded Exact Co");

    const customers = (await db.query("select public.c1_get_customer_analytics('Jakarta', '', '', 'sales_profit', 'desc', 1, 1) as value")).rows[0].value;
    assert.equal(customers.total_items, 1);
    assert.equal(customers.customers.length, 1);
    assert.equal(customers.customers[0].customer_name, "Jakarta Customer");
    assert.equal(customers.customers[0].active_invoices_count, 2);
    assert.equal(customers.kpi.totalActiveCustomers, 2);
  } finally {
    await db.close();
  }
});

test("overdue refresh uses latest validated upload rows and removes stale alerts", async () => {
  const db = await setup();
  try {
    await db.exec(`
      insert into c1_document_uploads values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'validated'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'validated');
      insert into c1_outstanding_staging_rows(id, document_id, row_number, invoice_number, customer_name, c1_customer_id, outstanding_amount, due_date, created_at) values
        ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2, 'INV-LATEST', 'Old Source Name', null, 100, '2026-08-01', '2026-09-01'),
        ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2, 'INV-LATEST', 'Uploaded Exact Name', '99999999-9999-4999-8999-999999999999', 250, '2026-09-01', '2026-10-01'),
        ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 3, 'INV-ZERO', 'Zero Source', null, 0, '2026-07-01', '2026-10-01');
      insert into c1_overdue_alert(alert_id, invoice_id, due_date, days_overdue, alert_status) values
        ('44444444-4444-4444-8444-444444444444', 'INV-LATEST', '2026-08-01', 75, 'HIGH RISK'),
        ('55555555-5555-4555-8555-555555555555', 'INV-STALE', '2026-07-01', 90, 'LEGAL ESCALATION'),
        ('66666666-6666-4666-8666-666666666666', 'INV-ZERO', '2026-07-01', 90, 'LEGAL ESCALATION');
    `);

    const result = (await db.query("select public.c1_refresh_overdue_alerts('2026-10-15') as value")).rows[0].value;
    assert.deepEqual(result, { evaluated: 1, overdue: 1, deleted: 2, "evaluationDate": "2026-10-15" });
    const alert = (await db.query("select invoice_id, c1_customer_id::text, due_date::text, days_overdue, overdue_alert, alert_status from c1_overdue_alert")).rows;
    assert.deepEqual(alert, [{ invoice_id: "INV-LATEST", c1_customer_id: "99999999-9999-4999-8999-999999999999", due_date: "2026-09-01", days_overdue: 44, overdue_alert: true, alert_status: "HIGH RISK" }]);
  } finally {
    await db.close();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const cleanupMigration = readFileSync(
  new URL("../supabase/migrations/20261109150000_cleanup_dead_c1_tables.sql", import.meta.url),
  "utf8"
);
const overdueApiSource = readFileSync(
  new URL("../lib/supabaseOverdueApi.ts", import.meta.url),
  "utf8"
);

test("c1 dead tables cleanup migration drops dead tables and decouples functions cleanly", async () => {
  const db = new PGlite();

  // 1. Initial setup with dummy tables (both active and dead tables)
  await db.exec(`
    create schema if not exists public;

    -- Active tables
    create table public.c1_document_uploads (
      id uuid primary key default gen_random_uuid(),
      file_name text not null default 'test.xlsx',
      document_type text not null default 'COMPANY_SALES_REPORT',
      validation_status text not null default 'validated',
      uploader_user_id uuid,
      storage_bucket text default 'c1_documents',
      storage_path text default 'test/path'
    );
    create table public.c1_customer (
      customer_id uuid primary key default gen_random_uuid(),
      customer_code text not null default 'TEST',
      customer_name text not null default 'Customer Test',
      source_type text default 'UPLOAD',
      source_document_id uuid
    );
    create table public.c1_company_sales_staging_rows (
      id uuid primary key default gen_random_uuid(),
      document_id uuid,
      period_month date,
      revenue numeric default 0,
      total_cost numeric default 0,
      c1_customer_id uuid
    );
    create table public.c1_outstanding_staging_rows (
      id uuid primary key default gen_random_uuid(),
      document_id uuid,
      due_date date,
      outstanding_amount numeric default 0,
      c1_customer_id uuid
    );
    create table public.c1_assignment (
      assignment_id uuid primary key default gen_random_uuid(),
      invoice_id text not null,
      assigned_to text
    );
    create table public.c1_overdue_alert (
      alert_id uuid primary key default gen_random_uuid(),
      invoice_id text not null,
      c1_customer_id uuid
    );
    create table public.c1_macro_metric (
      period_month date primary key,
      revenue numeric default 0,
      cost numeric default 0,
      total_outstanding numeric default 0,
      validation_status text default 'validated',
      updated_at timestamptz default now()
    );
    create table public.c1_document_validation_errors (
      error_id uuid primary key default gen_random_uuid(),
      document_id uuid
    );
    create table public.c1_document_deletion_audit (
      audit_id uuid primary key default gen_random_uuid(),
      document_id uuid,
      file_name text,
      document_type text,
      validation_status text,
      uploader_user_id uuid,
      deleted_by uuid,
      storage_bucket text,
      storage_path text,
      deleted_at timestamptz default now()
    );
    create table public.c1_payment_transactions (
      payment_id uuid primary key default gen_random_uuid(),
      customer_id uuid,
      amount numeric default 0,
      payment_date date default current_date
    );

    -- Mock refresh function
    create or replace function public.c1_refresh_overdue_alerts(p_eval_date date)
    returns void language plpgsql as $$ begin end; $$;

    -- Dead tables before cleanup
    create table public.c1_mid_feed (
      feed_id uuid primary key default gen_random_uuid(),
      feed_key text unique
    );
    create table public.c1_customer_monthly_metrics (
      metric_id uuid primary key default gen_random_uuid(),
      customer_id uuid
    );
    create table public.c1_invoice_detail (
      invoice_id uuid primary key default gen_random_uuid(),
      customer_id uuid
    );
    create table public.c1_export_request (
      request_id uuid primary key default gen_random_uuid(),
      requested_by uuid
    );
    create table public.c1_export_file (
      file_id uuid primary key default gen_random_uuid(),
      request_id uuid references public.c1_export_request(request_id)
    );
  `);

  // Verify all 5 dead tables exist before migration
  const beforeResult = await db.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('c1_mid_feed', 'c1_customer_monthly_metrics', 'c1_invoice_detail', 'c1_export_file', 'c1_export_request');"
  );
  assert.equal(beforeResult.rows.length, 5);

  // 2. Execute cleanup migration
  await db.exec(cleanupMigration);

  // 3. Verify all 5 dead tables are dropped
  const afterResult = await db.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('c1_mid_feed', 'c1_customer_monthly_metrics', 'c1_invoice_detail', 'c1_export_file', 'c1_export_request');"
  );
  assert.equal(afterResult.rows.length, 0);

  // 4. Verify updated c1_cleanup_unreferenced_upload_customers() executes without error
  const cleanupRes = await db.query(
    "select public.c1_cleanup_unreferenced_upload_customers('00000000-0000-0000-0000-000000000000'::uuid) as deleted_count;"
  );
  assert.equal(cleanupRes.rows[0].deleted_count, 0);

  // 5. Verify reset_c1_sales_overview_data() executes without error
  const resetRes = await db.query("select public.reset_c1_sales_overview_data() as result;");
  assert.ok(resetRes.rows[0].result);
});

test("supabaseOverdueApi source code is fully decoupled from dropped dead tables", () => {
  // Ensure none of the dropped tables are queried in lib/supabaseOverdueApi.ts
  assert.doesNotMatch(overdueApiSource, /\.from\(\s*["']c1_mid_feed["']\s*\)/);
  assert.doesNotMatch(overdueApiSource, /\.from\(\s*["']c1_customer_monthly_metrics["']\s*\)/);
  assert.doesNotMatch(overdueApiSource, /\.from\(\s*["']c1_invoice_detail["']\s*\)/);
  assert.doesNotMatch(overdueApiSource, /\.from\(\s*["']c1_export_request["']\s*\)/);
  assert.doesNotMatch(overdueApiSource, /\.from\(\s*["']c1_export_file["']\s*\)/);

  // Ensure deprecated MID feed and server export helpers are fully purged
  assert.doesNotMatch(overdueApiSource, /triggerBatchMidFeedEscalationInSupabase/);
  assert.doesNotMatch(overdueApiSource, /requestExportFileInSupabase/);
});

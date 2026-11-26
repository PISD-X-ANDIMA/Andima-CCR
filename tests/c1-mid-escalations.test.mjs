import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("MID escalation table migration and automatic triggers function properly", async () => {
  const migrationPath = new URL("../supabase/migrations/20261126210000_create_c1_mid_escalations.sql", import.meta.url);
  assert.ok(existsSync(migrationPath), "Migration file must exist");
  const migrationSql = readFileSync(migrationPath, "utf8");

  const db = new PGlite();

  // 1. Setup base schema matching C1 production environment
  await db.exec(`
    create schema if not exists public;

    create table public.a1_customers (
      id uuid primary key default gen_random_uuid(),
      company_code text,
      company_name text not null,
      created_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table public.c1_document_uploads (
      id uuid primary key default gen_random_uuid(),
      file_name text not null default 'test.xlsx',
      document_type text not null default 'OUTSTANDING_REPORT',
      validation_status text not null default 'validated',
      created_at timestamptz default now()
    );

    create table public.c1_outstanding_staging_rows (
      id uuid primary key default gen_random_uuid(),
      document_id uuid references public.c1_document_uploads(id) on delete cascade,
      invoice_number text not null,
      customer_name text not null,
      customer_id uuid,
      c1_customer_id uuid,
      outstanding_amount numeric(18,2) not null default 0,
      due_date date not null,
      bulk_close_status text,
      created_at timestamptz default now()
    );

    create table public.c1_overdue_alert (
      invoice_id text primary key,
      customer_id uuid,
      c1_customer_id uuid,
      due_date date not null,
      evaluation_date date not null default current_date,
      days_overdue integer not null default 0,
      overdue_alert boolean not null default false,
      alert_status text not null default 'Watchlist',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table public.c1_assignment (
      assignment_id uuid primary key default gen_random_uuid(),
      invoice_id text not null,
      assigned_to text not null default 'STAFF',
      assigned_by uuid,
      assigned_at timestamptz not null default now(),
      follow_up_status text not null default 'IN_PROGRESS',
      notes text,
      follow_up_action text,
      promise_date date,
      attachment_url text,
      updated_by uuid,
      payment_amount numeric(18,2) default 0,
      created_at timestamptz not null default now()
    );
  `);

  // 2. Execute the new MID escalation migration
  await db.exec(migrationSql);

  // 3. Verify c1_mid_escalations table structure with all 7 MID required fields
  const tableCheck = await db.query(`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'c1_mid_escalations'
    order by ordinal_position;
  `);
  const columns = tableCheck.rows.map((r) => r.column_name);

  // Check the 7 fields required by MID
  assert.ok(columns.includes("pic"), "Must have pic column");
  assert.ok(columns.includes("judul_issue"), "Must have judul_issue column");
  assert.ok(columns.includes("deskripsi_issue"), "Must have deskripsi_issue column");
  assert.ok(columns.includes("date"), "Must have date column");
  assert.ok(columns.includes("priority"), "Must have priority column");
  assert.ok(columns.includes("status"), "Must have status column");
  assert.ok(columns.includes("due_date"), "Must have due_date column");

  // Check metadata columns
  assert.ok(columns.includes("invoice_id"), "Must have invoice_id column");
  assert.ok(columns.includes("customer_name"), "Must have customer_name column");
  assert.ok(columns.includes("c1_customer_id"), "Must have c1_customer_id column");

  // 4. Test Scenario A: New Overdue Invoice appears (e.g. from document upload)
  await db.exec(`
    insert into public.a1_customers (id, company_name, company_code)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PT Nusantara Logistik Jaya', 'CMP-001');

    insert into public.c1_document_uploads (id, file_name, document_type, validation_status)
    values ('11111111-1111-1111-1111-111111111111', 'outstanding.xlsx', 'OUTSTANDING_REPORT', 'validated');

    insert into public.c1_outstanding_staging_rows (
      document_id, invoice_number, customer_name, c1_customer_id, outstanding_amount, due_date
    ) values (
      '11111111-1111-1111-1111-111111111111', 'INV-OVERDUE-001', 'PT Nusantara Logistik Jaya',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 15000000, current_date - 45
    );

    insert into public.c1_overdue_alert (
      invoice_id, customer_id, c1_customer_id, due_date, days_overdue, overdue_alert, alert_status
    ) values (
      'INV-OVERDUE-001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      current_date - 45, 45, true, 'Medium Risk'
    );

    -- Execute sync for overdue items
    select public.c1_sync_overdue_to_mid_escalations();
  `);

  // Verify escalation record created with status pending
  const esc1 = await db.query(`select * from public.c1_mid_escalations where invoice_id = 'INV-OVERDUE-001';`);
  assert.equal(esc1.rows.length, 1);
  assert.equal(esc1.rows[0].status, 'pending');
  assert.equal(esc1.rows[0].pic, 'Unassigned');
  assert.equal(esc1.rows[0].priority, 'Medium');
  assert.match(esc1.rows[0].judul_issue, /INV-OVERDUE-001/);
  assert.equal(esc1.rows[0].customer_name, 'PT Nusantara Logistik Jaya');

  // 5. Test Scenario B: Staff creates a follow-up log in c1_assignment
  await db.exec(`
    insert into public.c1_assignment (
      invoice_id, assigned_to, follow_up_status, notes, follow_up_action, promise_date
    ) values (
      'INV-OVERDUE-001', 'Budi Santoso', 'IN_PROGRESS', 'Customer berjanji bayar minggu depan.', 'CALL', current_date + 7
    );
  `);

  const esc2 = await db.query(`select * from public.c1_mid_escalations where invoice_id = 'INV-OVERDUE-001';`);
  assert.equal(esc2.rows.length, 1);
  assert.equal(esc2.rows[0].pic, 'Budi Santoso');
  assert.equal(esc2.rows[0].status, 'in_progress');
  assert.match(esc2.rows[0].deskripsi_issue, /Customer berjanji bayar minggu depan/);
  assert.match(esc2.rows[0].deskripsi_issue, /CALL/);

  // 6. Test Scenario C: Staff edits/updates the follow-up log
  await db.exec(`
    update public.c1_assignment
    set notes = 'Revisi: Customer sudah kirim bukti setor sebagian.',
        follow_up_action = 'WHATSAPP',
        promise_date = current_date + 3
    where invoice_id = 'INV-OVERDUE-001';
  `);

  const esc3 = await db.query(`select * from public.c1_mid_escalations where invoice_id = 'INV-OVERDUE-001';`);
  assert.equal(esc3.rows.length, 1);
  assert.match(esc3.rows[0].deskripsi_issue, /Revisi: Customer sudah kirim bukti setor sebagian/);
  assert.match(esc3.rows[0].deskripsi_issue, /WHATSAPP/);

  // 7. Test Scenario D: Staff completes follow-up / settlement marked COMPLETED
  await db.exec(`
    update public.c1_assignment
    set follow_up_status = 'COMPLETED',
        notes = 'Pelunasan penuh berhasil diverifikasi.'
    where invoice_id = 'INV-OVERDUE-001';
  `);

  const esc4 = await db.query(`select * from public.c1_mid_escalations where invoice_id = 'INV-OVERDUE-001';`);
  assert.equal(esc4.rows.length, 1);
  assert.equal(esc4.rows[0].status, 'done');
  assert.match(esc4.rows[0].deskripsi_issue, /Pelunasan penuh berhasil diverifikasi/);
});


test("MID escalation TypeScript types and API route exist", () => {
  const overdueTypes = readFileSync(new URL("../types/overdue.ts", import.meta.url), "utf8");
  assert.match(overdueTypes, /export interface MidEscalationRecord/);
  assert.match(overdueTypes, /pic:\s*string/);
  assert.match(overdueTypes, /judul_issue:\s*string/);
  assert.match(overdueTypes, /deskripsi_issue:\s*string/);
  assert.match(overdueTypes, /date:\s*string/);
  assert.match(overdueTypes, /priority:\s*'High'/);
  assert.match(overdueTypes, /status:\s*'pending'/);
  assert.match(overdueTypes, /due_date:\s*string/);

  const routePath = new URL("../app/api/v1/mid/escalations/route.ts", import.meta.url);
  assert.ok(existsSync(routePath), "API route must exist");
  const routeCode = readFileSync(routePath, "utf8");
  assert.match(routeCode, /export async function GET/);
  assert.match(routeCode, /fetchMidEscalationsFromSupabase/);
});

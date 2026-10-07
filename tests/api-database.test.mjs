import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, mocks = {}, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (name === "server-only") return {}; if (name in mocks) return mocks[name]; throw new Error(`Missing mock: ${name}`); }, process, console, ...extras });
  return exports;
}
const position = "10da1bac-a6a8-472e-a171-e4984ab768d9";
const department = "1653db5f-2b64-418f-b28b-68cb7b9dae8e";
const user1 = "11111111-1111-4111-8111-111111111111";
const user2 = "22222222-2222-4222-8222-222222222222";
const doc1 = "33333333-3333-4333-8333-333333333333";
const doc2 = "44444444-4444-4444-8444-444444444444";
const registration = { full_name: "Andima Test", email: "test@andima.co.id", password: "Testing123!", phone: "08123456789", employment_status: "probation", position_id: position, department_id: department };

test("registration validates types, domain, password, and position/department on the server", () => {
  const { validateRegistration } = load("lib/server/registration.ts", { "./admin": {} });
  assert.equal(validateRegistration(registration).employment_status, "PROBATION");
  for (const bad of [null, {}, { ...registration, phone: 123 }, { ...registration, email: "test@gmail.com" }, { ...registration, password: "weak" }, { ...registration, department_id: user1 }]) assert.equal(validateRegistration(bad), null);
});

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
    create type public.d3_app_role as enum ('EMPLOYEE','HR','MANAGER');
    create table public.d3_departments(id uuid primary key);
    create table public.d3_positions(id uuid primary key);
    create table public.a1_company_list(company_list_id uuid primary key);
    insert into public.d3_departments values ('${department}');
    insert into public.d3_positions values ('${position}');
    insert into auth.users values ('${user1}', 'one@andima.co.id'), ('${user2}', 'two@andima.co.id');`);
  await db.exec(read("supabase/schemas/public/tables/b2_register.sql"));
  const employee = read("supabase/schemas/public/tables/d3_employee.sql");
  const triggerIndex = employee.indexOf("CREATE TRIGGER");
  await db.exec(employee.slice(0, triggerIndex));
  await db.exec(read("supabase/schemas/public/tables/d3_user_access.sql"));
  for (const name of ["d3_current_role", "d3_current_employee_uuid", "d3_audit_employee_profile", "d3_set_employee_updated_at"]) await db.exec(read(`supabase/schemas/public/functions/${name}.sql`));
  await db.exec(read("supabase/schemas/public/tables/d3_employee_audit_log.sql"));
  await db.exec(employee.slice(triggerIndex));
  await db.exec(read("supabase/migrations/20261001000000_create_macro_metric.sql"));
  const ingestion = read("supabase/migrations/20261002000000_create_document_ingestion.sql");
  await db.exec(ingestion.slice(0, ingestion.indexOf("alter table public.c1_document_uploads")));
  await db.exec(ingestion.slice(ingestion.indexOf("create or replace function public.refresh_c1_macro_metrics()")));
  await db.exec(read("supabase/migrations/20261006000000_api_registration.sql"));
  await db.exec(read("supabase/migrations/20261006010000_finalize_document_upload.sql"));
  return db;
}
async function provision(db, user, email) {
  return db.query("select public.provision_app_registration($1, 'Andima Test', $2, '08123456789', 'PROBATION', $3, $4) as profile", [user, email, position, department]);
}

test("registration SQL allocates distinct IDs, rejects duplicates atomically, and rolls back only owned profiles", async () => {
  const db = await database();
  try {
    const results = await Promise.all([provision(db, user1, "one@andima.co.id"), provision(db, user2, "two@andima.co.id")]);
    assert.deepEqual(results.map(result => result.rows[0].profile.employee_id), ["DIR-FAT-001", "DIR-FAT-002"]);
    await assert.rejects(provision(db, user1, "one@andima.co.id"));
    assert.equal((await db.query("select count(*)::int as count from public.b2_register")).rows[0].count, 2);
    await db.query("select public.rollback_app_registration($1)", [user1]);
    assert.equal((await db.query("select count(*)::int as count from public.d3_employee")).rows[0].count, 1);
    assert.equal((await db.query("select email from public.d3_employee")).rows[0].email, "two@andima.co.id");
    // Fixed director codes stay unique and retain the four-digit AND fallback.
    const director = "0ec333af-8737-413f-adab-841a3067e485";
    await db.query("insert into d3_positions(id) values ($1)", [director]);
    const codes = [];
    for (let index = 3; index <= 6; index++) {
      const user = `${index}${index}${index}${index}${index}${index}${index}${index}-1111-4111-8111-111111111111`;
      const email = `director${index}@andima.co.id`;
      await db.query("insert into auth.users(id,email) values ($1,$2)", [user,email]);
      const result = await db.query("select public.provision_app_registration($1, 'Director Test', $2, '08123456789', 'PROBATION', $3, $4) as profile", [user,email,director,department]);
      codes.push(result.rows[0].profile.employee_id);
    }
    assert.deepEqual(codes, ["DIR-FAT-001", "DIR-COM-001", "DIR-HCC-001", "AND-0001"]);
    const permissions = await db.query("select has_table_privilege('anon','public.b2_register','select') as anon_read, has_function_privilege('authenticated','public.provision_app_registration(uuid,text,text,text,text,uuid,uuid)','execute') as browser_execute");
    assert.equal(permissions.rows[0].anon_read, false); assert.equal(permissions.rows[0].browser_execute, false);
  } finally { await db.close(); }
});

test("uploaded sales and outstanding aggregate by month; failed finalization leaves charts unchanged", async () => {
  const db = await database();
  try {
    await provision(db, user1, "one@andima.co.id");
    await db.exec(`set app.user_id = '${user1}';
      insert into public.c1_document_uploads(id,file_name,document_type,storage_path,mime_type,file_size_bytes,uploader_user_id,validation_status)
      values ('${doc1}','sales.csv','COMPANY_SALES_REPORT','sales.csv','text/csv',100,'${user1}','processing'), ('${doc2}','outstanding.csv','OUTSTANDING_REPORT','outstanding.csv','text/csv',100,'${user1}','processing');
      insert into public.c1_company_sales_staging_rows(document_id,row_number,period_month,customer_name,revenue,trucking_cost,handling_cost,storage_cost,other_operational_cost)
      values ('${doc1}',2,'2026-09-01','Test',1000,100,20,30,50), ('${doc1}',3,'2026-09-01','Test',500,50,10,20,20);
      insert into public.c1_outstanding_staging_rows(document_id,row_number,invoice_number,customer_name,outstanding_amount,due_date)
      values ('${doc2}',2,'INV-1','Test',700,'2026-10-15');`);
    await db.query("select public.finalize_c1_document_upload($1,2)", [doc1]);
    await db.query("select public.finalize_c1_document_upload($1,1)", [doc2]);
    const macro = await db.query("select period_month::text, revenue::float, cost::float, total_outstanding::float from c1_macro_metric order by period_month");
    assert.deepEqual(macro.rows, [
      { period_month: "2026-09-01", revenue: 1500, cost: 300, total_outstanding: 0 },
      { period_month: "2026-10-01", revenue: 0, cost: 0, total_outstanding: 700 },
    ]);
    // A failed aggregate must also roll back the document status update.
    await db.exec(`update public.c1_document_uploads set validation_status = 'processing' where id = '${doc2}';
      create or replace function public.refresh_c1_macro_metrics() returns void language plpgsql as $$ begin raise exception 'aggregate failure'; end; $$;`);
    await assert.rejects(db.query("select public.finalize_c1_document_upload($1,1)", [doc2]));
    assert.equal((await db.query("select validation_status from c1_document_uploads where id = $1", [doc2])).rows[0].validation_status, "processing");
    assert.deepEqual((await db.query("select period_month::text, revenue::float, cost::float, total_outstanding::float from c1_macro_metric order by period_month")).rows, macro.rows);
    await db.exec(`set app.user_id = '${user2}'`);
    await assert.rejects(db.query("select public.finalize_c1_document_upload($1,1)", [doc2]));
  } finally { await db.close(); }
});

const responseMock = { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }) } };
test("login validates credentials, preserves confirmation errors, and returns no tokens", async () => {
  let loginError = null; let credentials;
  const route = load("app/api/auth/login/route.ts", {
    "next/server": responseMock, "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { signInWithPassword: async value => { credentials = value; return { error: loginError }; } } }) },
    "@/lib/server/http": { checkOrigin: () => null, apiError: (message,status,code) => responseMock.NextResponse.json({ error: { message, code } }, { status }) },
  });
  const request = body => ({ json: async () => body });
  assert.equal((await route.POST(request({}))).status, 400);
  loginError = { code: "email_not_confirmed" };
  assert.equal((await route.POST(request({ email: "TEST@ANDIMA.CO.ID", password: "Testing123!" }))).status, 401);
  loginError = null;
  const result = await route.POST(request({ email: " TEST@ANDIMA.CO.ID ", password: "Testing123!" }));
  assert.deepEqual(await result.json(), { data: { redirect_to: "/sales-overview" } });
  assert.equal(credentials.email, "test@andima.co.id");
});

test("registration preserves confirmation settings and compensates only a newly created account", async () => {
  let confirmation = true; let failProvision = false; let failEmail = false; let conflict = false;
  const removed = []; const cleanup = []; const created = [];
  const admin = { auth: { admin: {
    createUser: async data => { created.push(data); return conflict ? { error: { code: "email_exists" }, data: {} } : { data: { user: { id: user1 } }, error: null }; },
    deleteUser: async id => { removed.push(id); return { error: null }; },
  } }, rpc: async (name, data) => { cleanup.push({ name, data }); return { error: null }; } };
  const environment = { env: { SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test-key" } };
  const route = load("app/api/auth/register/route.ts", {
    "next/server": responseMock,
    "@supabase/supabase-js": { createClient: () => ({ auth: { resend: async () => ({ error: failEmail ? { code: "send_failed" } : null }) } }) },
    "@/lib/server/admin": { createAdminClient: () => admin },
    "@/lib/server/http": { checkOrigin: () => null, apiError: (message,status,code) => responseMock.NextResponse.json({ error: { message, code } }, { status }) },
    "@/lib/server/registration": { validateRegistration: value => value, provisionRegistration: async () => { if (failProvision) throw new Error("failure"); return { employee_id: "DIR-FAT-001", app_role: "HR" }; } },
  }, { process: environment, fetch: async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: !confirmation, external: { email: true } }) }) });
  const request = { json: async () => registration, nextUrl: { origin: "https://app.example" } };
  const success = await route.POST(request);
  assert.equal(success.status, 201); assert.equal((await success.json()).data.confirmation_required, true);
  assert.equal(created.at(-1).email_confirm, false);
  confirmation = false;
  assert.equal((await route.POST(request)).status, 201); assert.equal(created.at(-1).email_confirm, true);
  conflict = true;
  assert.equal((await route.POST(request)).status, 409); assert.deepEqual(removed, []);
  conflict = false; failProvision = true;
  assert.equal((await route.POST(request)).status, 500); assert.deepEqual(removed, [user1]);
  failProvision = false; failEmail = true; confirmation = true;
  assert.equal((await route.POST(request)).status, 503);
  assert.equal(cleanup.at(-1).name, "rollback_app_registration");
  assert.deepEqual(removed, [user1, user1]);
});

test("logout uses the server session and never returns tokens", async () => {
  let scope;
  const route = load("app/api/auth/logout/route.ts", {
    "next/server": responseMock, "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({ auth: { signOut: async options => { scope = options.scope; return { error: null }; } } }) },
    "@/lib/server/http": { checkOrigin: () => null, apiError: () => { throw new Error("Unexpected error"); } },
  });
  const result = await route.POST({}); assert.equal(scope, "local"); assert.deepEqual(await result.json(), { data: { success: true } });
});

test("confirmation callback verifies OTP/code and blocks external redirect paths", async () => {
  const redirects = []; const verified = []; let fail = false;
  const route = load("app/auth/route.ts", {
    "@supabase/supabase-js": {}, "next/server": {},
    "next/headers": { cookies: async () => ({}) },
    "next/navigation": { redirect: path => { redirects.push(path); throw new Error("REDIRECT"); } },
    "@/utils/supabase/server": { createClient: () => ({ auth: {
      exchangeCodeForSession: async code => { verified.push(code); return { error: fail ? {} : null }; },
      verifyOtp: async input => { verified.push(input); return { error: fail ? {} : null }; },
    } }) },
  }, { URL });
  for (const url of ["https://app.example/auth?code=test&next=/sales-overview", "https://app.example/auth?token_hash=test&type=signup&next=https://evil.example"]) await assert.rejects(route.GET({ url }), /REDIRECT/);
  assert.deepEqual(redirects, ["/sales-overview", "/login"]);
  assert.equal(verified[0], "test"); assert.equal(verified[1].type, "signup");
  fail = true; await assert.rejects(route.GET({ url: "https://app.example/auth?code=bad" }), /REDIRECT/);
  assert.equal(redirects.at(-1), "/login?auth=confirmation_failed");
});

test("server session cookies are HttpOnly, SameSite=Lax, and secure in production", () => {
  let options;
  const cookiesModule = load("utils/supabase/cookies.ts", {}, { process: { env: { NODE_ENV: "production" } } });
  const serverModule = load("utils/supabase/server.ts", {
    "next/headers": {}, "./cookies": cookiesModule,
    "@supabase/ssr": { createServerClient: (_url, _key, value) => { options = value; return {}; } },
  });
  const written = [];
  serverModule.createClient({ getAll: () => [], set: (...entry) => written.push(entry) });
  options.cookies.setAll([{ name: "session", value: "token", options: { httpOnly: false, secure: false } }]);
  assert.equal(written[0][2].httpOnly, true); assert.equal(written[0][2].sameSite, "lax"); assert.equal(written[0][2].secure, true);
});

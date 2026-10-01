# Dokumentasi Backend C1 Sales Overview

Dokumen ini menjelaskan backend yang benar-benar tersedia pada branch `feature-C1-02-Sales-&-Outstanding-Overview`. Cakupan utamanya adalah Sales Overview, authentication, provisioning role, Supabase PostgreSQL, dan dependency master data.

Fitur yang belum ada dicatat sebagai **Not Implemented**, bukan dianggap aktif.

## 1. Arsitektur Backend

- **Next.js App Router** menyediakan halaman dan Route Handler di `app/api/**/route.ts`.
- **Supabase Auth** menangani login, signup, email confirmation, session, dan JWT.
- **Supabase PostgreSQL** menyimpan employee, role access, master company, dan metric macro C1.
- **Supabase SSR** digunakan oleh `utils/supabase/server.ts`, `utils/supabase/client.ts`, dan `utils/supabase/middleware.ts`.
- Authorization dilakukan server-side setelah user diambil dari session.

### Alur Sales Overview

1. Browser membuka `/sales-overview`.
2. Halaman memanggil `GET /api/v1/analytics/macro` dengan periode.
3. Route Handler membuat Supabase server client dari cookie session.
4. Server memanggil `supabase.auth.getUser()`.
5. Server membaca `d3_user_access.app_role`.
6. Server mengambil metric tervalidasi untuk role `HR` atau `MANAGER`.
7. Client merender kartu macro dan chart.

## 2. API Endpoint

### `GET /api/v1/analytics/macro`

Mengambil data macro tervalidasi untuk Sales Overview.

#### Query parameter

| Parameter | Wajib | Format | Default |
|---|---:|---|---|
| `start_period` | Tidak | `YYYY-MM` | Dua bulan sebelum end period |
| `end_period` | Tidak | `YYYY-MM` | Bulan UTC saat request |

`start_period` tidak boleh lebih besar dari `end_period`.

#### Authentication dan authorization

Endpoint membutuhkan session Supabase yang valid. Role yang diizinkan adalah `HR` dan `MANAGER`; role `EMPLOYEE` ditolak.

#### Query database

Endpoint membaca `c1_macro_metric` dengan filter:

```sql
validation_status = 'validated'
period_month >= start_date
period_month <= end_date
```

Hasil diurutkan berdasarkan `period_month` ascending.

#### Response sukses

```json
{
  "data": {
    "period": { "start_period": "2026-01", "end_period": "2026-03" },
    "summary": {
      "revenue": 100000000,
      "cost": 60000000,
      "sales_profit": 40000000,
      "total_outstanding": 12000000
    },
    "series": [
      {
        "period_month": "2026-01",
        "revenue": 30000000,
        "cost": 18000000,
        "sales_profit": 12000000,
        "total_outstanding": 4000000
      }
    ],
    "meta": { "source": "c1_macro_metric", "validation_status": "validated" }
  }
}
```

`summary` menggunakan periode terakhir dalam range. Jika tidak ada metric tervalidasi, `summary` bernilai `null` dan `series` berupa array kosong.

Formula:

```text
sales_profit = revenue - cost
```

#### Error response

| HTTP | Code | Kondisi |
|---:|---|---|
| 401 | `UNAUTHENTICATED` | Session/user tidak tersedia |
| 403 | `ACCESS_CHECK_FAILED` | Query role/access gagal |
| 403 | `FORBIDDEN` | Role bukan `HR` atau `MANAGER` |
| 400 | `INVALID_PERIOD` | Format periode salah atau range terbalik |
| 500 | `DATABASE_ERROR` | Query metric gagal |

Format error:

```json
{ "error": { "code": "INVALID_PERIOD", "message": "..." } }
```

### `POST /api/auth/provision-registration`

Membuat atau memperbarui profil employee dan role setelah Supabase signup.

#### Request body

```json
{
  "auth_user_id": "uuid",
  "full_name": "Nama Pengguna",
  "email": "user@example.com",
  "phone": "08123456789",
  "employment_status": "PROBATION",
  "position_id": "uuid",
  "department_id": "uuid"
}
```

`auth_user_id`, `full_name`, `email`, `position_id`, dan `department_id` wajib. UUID dan field wajib divalidasi server-side.

#### Alur server

1. Memastikan `SUPABASE_SERVICE_ROLE_KEY` dan URL Supabase tersedia.
2. Mem-parsing JSON dan memvalidasi field.
3. Memverifikasi user/email melalui `auth.admin.getUserById`.
4. Memvalidasi `position_id` dan `department_id`.
5. Menentukan role berdasarkan position.
6. Upsert `d3_employee` dengan conflict key `email`.
7. Upsert `d3_user_access` dengan conflict key `auth_user_id`.

#### Mapping role

- Position dalam `MANAGEMENT_POSITIONS` menjadi `MANAGER`.
- Position dalam `ADMIN_STAFF_POSITIONS` menjadi `HR`.
- Position lain menjadi `EMPLOYEE`.

#### Response

HTTP `201`:

```json
{ "data": { "employee_id": "AND-XXXXXXXXXXXX", "app_role": "HR" } }
```

| HTTP | Code | Kondisi |
|---:|---|---|
| 400 | `INVALID_JSON` | Body bukan JSON valid |
| 400 | `INVALID_REGISTRATION` | Field wajib/UUID invalid |
| 400 | `AUTH_USER_MISMATCH` | User Auth tidak ada atau email berbeda |
| 400 | `INVALID_REFERENCE` | Position/department tidak ada |
| 500 | `REFERENCE_LOOKUP_FAILED` | Lookup reference gagal |
| 500 | `EMPLOYEE_PROVISION_FAILED` | Upsert employee gagal |
| 500 | `ACCESS_PROVISION_FAILED` | Upsert access gagal |
| 503 | `PROVISIONING_UNAVAILABLE` | Konfigurasi server belum tersedia |

### `GET /auth`

Callback authentication.

- `code` ditukar menjadi session dengan `exchangeCodeForSession`.
- `token_hash` dan `type` diverifikasi dengan `verifyOtp`.
- `next` hanya menerima relative path yang tidak diawali `//` untuk mencegah open redirect.
- Kegagalan diarahkan ke `/login?auth=confirmation_failed`.

### Endpoint belum tersedia pada branch ini

Tidak ditemukan implementasi aktif untuk:

- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/{id}/validation`
- `GET/POST /api/v1/overdue-alerts`
- endpoint export atau ingestion dokumen

Upload PDF/XLSX, parser, staging rows, validation errors, dan storage ingestion belum menjadi backend aktif branch ini.

## 3. Authentication dan Authorization

### Environment variable

| Variable | Pemakaian | Sisi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase | Server/browser |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key SSR/browser | Server/browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Admin API provisioning | Server-only |

Service role key tidak boleh dikirim ke browser.

### Session dan role

- Browser memakai `createBrowserClient`.
- Server memakai `createServerClient` dengan cookie store Next.js.
- Middleware Supabase menyegarkan cookie session.
- Endpoint memakai `supabase.auth.getUser()`, bukan user ID dari client.
- Role disimpan pada `d3_user_access.app_role`.
- `d3_user_access.employee_id` menghubungkan user Auth ke `d3_employee`.

| Role | Makna internal | Sales Overview |
|---|---|---|
| `HR` | Admin/staff | Dapat membaca metric |
| `MANAGER` | Management/supervisor | Dapat membaca metric |
| `EMPLOYEE` | Employee umum | Ditolak endpoint macro |

## 4. Database dan Relasi

### `c1_macro_metric`

| Kolom | Tipe/aturan | Keterangan |
|---|---|---|
| `id` | `uuid`, primary key | ID metric |
| `period_month` | `date`, not null, unique | Periode metric |
| `revenue` | `numeric(18,2)`, default 0 | Total revenue |
| `cost` | `numeric(18,2)`, default 0 | Total cost |
| `sales_profit` | generated | `revenue - cost` |
| `total_outstanding` | `numeric(18,2)`, default 0 | Total outstanding |
| `validation_status` | text | `pending`, `validated`, `rejected` |
| `source_document` | text nullable | Sumber metric |
| `created_at` | timestamptz | Waktu dibuat |
| `updated_at` | timestamptz | Waktu diubah |

Constraint/index:

- Unique `period_month`.
- Status dibatasi ke `pending`, `validated`, `rejected`.
- `revenue`, `cost`, dan `total_outstanding` tidak boleh negatif.
- Index pada `period_month` dan `validation_status`.
- RLS aktif; API hanya mengambil status `validated`.

### `d3_user_access`

- Primary key `auth_user_id`.
- Foreign key ke `auth.users(id)` dengan cascade delete.
- Foreign key ke `d3_employee(id)`.
- `employee_id` unique.
- `app_role` menggunakan enum `public.d3_app_role`.
- Policy select membatasi user ke mapping access miliknya sendiri.

### `d3_employee`

Menyimpan `employee_id`, `full_name`, `email`, `phone`, `join_date`, `employment_status`, `work_location`, `position_id`, dan `department_id`. `email` dan `employee_id` unique. `position_id` dan `department_id` memiliki foreign key ke tabel reference.

### `d3_positions` dan `d3_departments`

Reference/master data yang digunakan saat provisioning registration. Route memvalidasi kedua UUID sebelum menulis employee.

### `a1_company_list`

Master customer/company dengan kolom `company_list_id`, `job_number`, `name`, `company_name`, `created_by`, `customer_code`, dan `address`. Endpoint macro saat ini tidak melakukan join langsung ke tabel ini.

### Supabase Auth `auth.users`

Sumber identitas authentication. `d3_user_access.auth_user_id` menghubungkan user Auth dengan profil employee dan role aplikasi.

## 5. RLS dan Security Policy

- `c1_macro_metric`: authenticated user dengan role `HR` atau `MANAGER` hanya dapat membaca row `validation_status = 'validated'`.
- `d3_user_access`: user hanya dapat membaca mapping dengan `auth_user_id = auth.uid()`.
- `d3_employee`: policy membedakan akses HR/manager dan profil milik employee sendiri.
- `d3_positions`: reference data dibaca authenticated user dengan role valid.
- `a1_company_list`: schema memiliki policy select publik dan policy authenticated.
- Service role hanya dipakai server-side pada provisioning.
- Publishable key boleh ada di browser; service role key wajib server-only.

RLS menjadi lapisan database, sedangkan pengecekan role pada route macro menjadi application-layer authorization.

## 6. Data Flow dan Formula

```text
Login -> Supabase Auth session -> cookie SSR
  -> Sales Overview mengirim periode
  -> GET /api/v1/analytics/macro
  -> verifikasi session dan role
  -> select c1_macro_metric tervalidasi
  -> bentuk series dan summary
  -> render kartu/chart atau empty state
```

```text
sales_profit = revenue - cost
```

`summary` memakai periode terakhir dalam range. Tanpa metric tervalidasi, backend mengembalikan `summary: null` dan `series: []`.

## 7. Configuration dan Deployment

Migration utama C1:

```text
supabase/migrations/20261001000000_create_macro_metric.sql
```

Perintah setup/verifikasi:

```bash
npx supabase db push
npx supabase migration list
npm run typecheck
npm run lint
```

`.env.local`, `.env*`, credential Supabase, dan service role key tidak boleh di-commit.

## 8. Limitasi Branch Saat Ini

Belum tersedia:

- endpoint upload dokumen;
- parser `.xlsx`, `.xls`, `.csv`, atau PDF;
- document staging rows;
- validation error endpoint;
- storage bucket ingestion;
- API overdue alert;
- API export;
- agregasi otomatis dari file upload ke `c1_macro_metric`;
- benchmark latency dan automated integration test.

`c1_macro_metric` masih menjadi sumber data langsung. Kontrol upload dan export pada UI masih disabled.

## 9. Test dan Verification Checklist

- User tanpa session menerima `401 UNAUTHENTICATED`.
- Role `EMPLOYEE` menerima `403 FORBIDDEN`.
- Role `HR` dan `MANAGER` dapat membaca metric tervalidasi.
- Periode `YYYY-MM` valid menghasilkan `period`, `summary`, dan `series`.
- Periode invalid/range terbalik menghasilkan `400 INVALID_PERIOD`.
- Tanpa metric tervalidasi, response berisi `summary: null` dan series kosong.
- `sales_profit` sama dengan `revenue - cost`.
- Registration dengan reference valid membuat employee dan access mapping.
- Registration dengan position/department invalid ditolak.
- Service role key tidak pernah dikirim ke browser.

## 10. Referensi Implementasi

- `app/api/v1/analytics/macro/route.ts`
- `app/api/auth/provision-registration/route.ts`
- `app/auth/route.ts`
- `app/sales-overview/page.tsx`
- `utils/supabase/server.ts`
- `utils/supabase/client.ts`
- `utils/supabase/middleware.ts`
- `supabase/migrations/20261001000000_create_macro_metric.sql`
- `supabase/schemas/public/tables/d3_user_access.sql`
- `supabase/schemas/public/tables/d3_employee.sql`
- `supabase/schemas/public/tables/d3_positions.sql`
- `supabase/schemas/public/tables/a1_company_list.sql`

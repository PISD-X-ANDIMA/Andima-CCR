# API and Sales Overview setup

All browser database and authentication operations use application APIs. Supabase clients live only in server modules. The account provider shares `/api/v1/account/me` between navigation and account labels.

## Required configuration

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the server environment (see `.env.example`). Existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are supported as server configuration fallbacks. Never expose the service-role key to browser code.

Apply these migrations, in order, after the existing migrations:

1. `supabase/migrations/20261006000000_api_registration.sql`
2. `supabase/migrations/20261006010000_finalize_document_upload.sql`

The registration migration retires auth triggers calling the legacy `handle_new_user_to_b2_register` function, closes anonymous registration-table access, and installs service-only profile provisioning/rollback functions. It preserves existing accounts and data. ID allocation and profile inserts happen inside one database transaction. The upload migration atomically finalizes the uploaded document and rebuilds macro metrics; a failed aggregation rolls back the validated status.

Configure Supabase Auth redirect allowlists to include the application's `/auth` callback. For the signup confirmation email template, link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup` so the server callback can verify the token without browser SDKs or URL-fragment session tokens. Registration reads the project's email-confirmation setting and sends confirmation email when required. Existing localStorage-only sessions require a fresh login after switching to server cookies.

## Endpoints

- `POST /api/auth/login`: email/password; creates server cookies and returns the redirect path.
- `POST /api/auth/logout`: clears the local server session.
- `POST /api/auth/register`: validated registration form; returns employee ID, role, and confirmation requirement. Passwords are never written to profile tables.
- `GET /api/v1/account/me`: current session's name, role, and initials; not cached.
- `GET /api/v1/analytics/macro`: one response for all four charts and metric cards, filtered by `start_period` and `end_period`.

Mutating endpoints check request Origin. Business endpoints require a valid session; Sales Overview requires HR/Manager, upload requires HR. Authentication uses HttpOnly cookies, SameSite=Lax, and Secure in production; proxy refreshes sessions server-side.

## Uploaded chart data

Sales reports sum revenue and generated total cost by `period_month`. Outstanding reports sum outstanding amounts by the month of `due_date`. Only validated uploads contribute. Multiple validated files are cumulative. A successful upload refreshes all four charts while preserving the active period filter; uploaded data outside that filter appears after changing the filter. No dummy chart data is used.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Database tests execute the new migrations against isolated PostgreSQL via PGlite, including ID allocation, duplicate rejection, rollback, monthly aggregates, and aggregate-failure rollback. Auth handler tests use mocked Supabase responses and never create real users. Browser checks should verify that no requests go directly to Supabase and should exercise upload refresh plus desktop/mobile layouts. Real-project confirmation email and uploads additionally require the server key and applied migrations.

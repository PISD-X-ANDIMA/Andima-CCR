import { checkOrigin, requireSession } from "@/lib/server/http";
import { NextRequest, NextResponse } from "next/server";
import { canUpload, canUseCcr, getCcrProfile } from "@/lib/server/authorization";
import { fetchInvoicesFromSupabase, recordPaymentInSupabase } from "@/lib/supabaseApi";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", "));
  return response;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function authorizedProfile(session: Awaited<ReturnType<typeof requireSession>>) {
  if (session.error) return { error: session.error, profile: null };
  try {
    return { error: null, profile: await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false }) };
  } catch {
    return { error: errorResponse("AUTHORIZATION_UNAVAILABLE", "Customer authorization is unavailable.", 503), profile: null };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  const auth = await authorizedProfile(session);
  if (auth.error) return timed(auth.error, startedAt, { auth: performance.now() - authStarted });
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(auth.profile)) return timed(errorResponse("FORBIDDEN", "CCR access is required.", 403), startedAt, { auth: authDuration });

  const databaseStarted = performance.now();
  try {
    const { customerId } = await params;
    const mode = new URL(req.url).searchParams.get("mode");
    const invoices = await fetchInvoicesFromSupabase(customerId, { includeClosed: mode === "all", overdueOnly: mode === "overdue" });
    return timed(NextResponse.json({ customerId, totalInvoices: invoices.length, invoices }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  } catch (error) {
    console.error("Customer invoice query failed:", error);
    return timed(errorResponse("DATABASE_ERROR", "Unable to process invoice request.", 500), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const originError = checkOrigin(req);
  if (originError) return timed(originError, startedAt, { auth: 0 });
  const session = await requireSession();
  const auth = await authorizedProfile(session);
  if (auth.error) return timed(auth.error, startedAt, { auth: performance.now() - authStarted });
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(auth.profile)) return timed(errorResponse("FORBIDDEN", "CCR access is required.", 403), startedAt, { auth: authDuration });
  if (!canUpload(auth.profile)) return timed(errorResponse("FORBIDDEN", "Only Staff users can record customer payments.", 403), startedAt, { auth: authDuration });

  try {
    const { customerId } = await params;
    const body = await req.json() as Record<string, unknown>;
    if (body.action !== "RECORD_PAYMENT") return timed(errorResponse("INVALID_ACTION", "Only RECORD_PAYMENT is supported.", 400), startedAt, { auth: authDuration });

    const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() : "";
    const referenceNo = typeof body.referenceNo === "string" ? body.referenceNo.trim() : "";
    const paymentDate = typeof body.paymentDate === "string" ? body.paymentDate : "";
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!invoiceNumber || !referenceNo || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(Date.parse(paymentDate)) || !Number.isFinite(amount) || amount <= 0) {
      return timed(errorResponse("INVALID_PAYMENT", "Invoice, nominal, tanggal, dan referensi pembayaran wajib valid.", 422), startedAt, { auth: authDuration });
    }

    const databaseStarted = performance.now();
    const result = await recordPaymentInSupabase({ customerId, invoiceNumber, amount, paymentDate, referenceNo, enteredBy: session.user!.id });
    if (!result.success) {
      const status = result.code === "INVOICE_NOT_FOUND" ? 404 : 422;
      return timed(errorResponse(result.code, result.message, status), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
    }
    return timed(NextResponse.json({ data: result.payment }, { status: 201 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  } catch (error) {
    console.error("Customer payment write failed:", error);
    return timed(errorResponse("DATABASE_ERROR", "Unable to record customer payment.", 500), startedAt, { auth: authDuration });
  }
}

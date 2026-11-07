import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import { getCcrProfile, canUseCcr } from "@/lib/server/authorization";
import { createAdminClient } from "@/lib/server/admin";
import { recordFollowUpProgressInSupabase } from "@/lib/supabaseOverdueApi";

export async function POST(req: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireSession();
  if (session.error) return session.error;
  const originError = checkOrigin(req);
  if (originError) return originError;

  const profile = await getCcrProfile(session.client, session.user!.id);
  if (!canUseCcr(profile)) {
    return apiError("You are not allowed to update overdue follow-up progress.", 403, "FORBIDDEN");
  }

  try {
    const { invoiceId } = await context.params;
    const cleanInvoiceId = invoiceId.trim();

    let followUpStatus = "IN_PROGRESS";
    let followUpAction: string | null = null;
    let promiseDate: string | null = null;
    let notes: string | null = null;
    let attachmentUrl: string | null = null;
    let paymentAmount: number | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      followUpStatus = (formData.get("followUpStatus") as string) || "IN_PROGRESS";
      followUpAction = (formData.get("followUpAction") as string) || null;
      promiseDate = (formData.get("promiseDate") as string) || null;
      notes = (formData.get("notes") as string) || null;
      const rawPayment = formData.get("paymentAmount") || formData.get("payment_amount");
      if (rawPayment) {
        const parsed = Number(rawPayment);
        if (!Number.isNaN(parsed)) paymentAmount = parsed;
      }

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return apiError("Lampiran bukti maksimal 5MB.", 422, "FILE_TOO_LARGE");
        }
        const admin = createAdminClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `evidence/${cleanInvoiceId}/${crypto.randomUUID()}-${safeName}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await admin.storage
          .from("c1-document-uploads")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error("Failed to upload evidence file", uploadError);
          return apiError("Gagal mengunggah bukti progress.", 500, "UPLOAD_FAILED");
        }

        const { data: signedData } = await admin.storage
          .from("c1-document-uploads")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

        attachmentUrl = signedData?.signedUrl ?? storagePath;
      }
    } else {
      const body = (await req.json()) as {
        followUpStatus?: string;
        followUpAction?: string;
        promiseDate?: string;
        notes?: string;
        attachmentUrl?: string;
        paymentAmount?: number | string;
        payment_amount?: number | string;
      };
      followUpStatus = body.followUpStatus || "IN_PROGRESS";
      followUpAction = body.followUpAction || null;
      promiseDate = body.promiseDate || null;
      notes = body.notes || null;
      attachmentUrl = body.attachmentUrl || null;
      const rawPayment = body.paymentAmount ?? body.payment_amount;
      if (rawPayment !== undefined && rawPayment !== null) {
        const parsed = Number(rawPayment);
        if (!Number.isNaN(parsed)) paymentAmount = parsed;
      }
    }

    const assignedTo = profile?.employee_id || profile?.full_name || "STAFF";

    const result = await recordFollowUpProgressInSupabase({
      invoiceId: cleanInvoiceId,
      followUpStatus,
      followUpAction,
      promiseDate,
      notes,
      attachmentUrl,
      paymentAmount,
      updatedBy: session.user!.id,
      assignedTo,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Failed to record follow-up progress", error);
    return apiError("Unable to save follow-up progress.", 500, "FOLLOW_UP_FAILED");
  }
}


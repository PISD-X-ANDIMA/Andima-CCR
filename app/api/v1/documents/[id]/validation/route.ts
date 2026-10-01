import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = createClient(await cookies());
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }, { status: 401 });
  const { id } = await context.params;
  const { data: document, error } = await supabase.from("c1_document_uploads").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load validation result." } }, { status: 500 });
  if (!document) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });
  const { data: errors } = await supabase.from("c1_document_validation_errors").select("row_number, field_name, error_code, error_message").eq("document_id", id).order("row_number");
  return NextResponse.json({ data: { ...document, errors: errors ?? [] } });
}

import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, requireSession } from "@/lib/server/http";
import { canUpload, getCcrProfile } from "@/lib/server/authorization";
import { parseDocumentRows, parseFailureMessage } from "@/lib/server/documentUploadParser";
import { validateRows, type DocumentType, type ValidationError } from "@/lib/documentUploadValidation";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "pdf"]);

function failure(message: string, status: number, code: string, errors: ValidationError[] = []) {
  return NextResponse.json({ error: { code, message, errors } }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const session = await requireSession();
  if (session.error) return session.error;
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  if (!canUpload(profile)) return failure("Only CCR staff users can preview document uploads.", 403, "FORBIDDEN");

  const form = await request.formData();
  const file = form.get("file");
  const documentType = form.get("document_type");
  if (!(file instanceof File) || (documentType !== "COMPANY_SALES_REPORT" && documentType !== "OUTSTANDING_REPORT")) {
    return failure("File and document type are required.", 400, "INVALID_REQUEST");
  }
  if (file.size > MAX_FILE_SIZE) return failure("File tidak boleh lebih dari 5 MB.", 413, "FILE_TOO_LARGE");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return failure("Format file tidak didukung.", 422, "UNSUPPORTED_FORMAT");

  const startedAt = performance.now();
  let rows: unknown[][];
  let result: ReturnType<typeof validateRows>;
  try {
    rows = await parseDocumentRows(file, documentType as DocumentType);
    result = validateRows(rows, documentType as DocumentType, new Map());
  } catch (error) {
    const code = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "PARSING_FAILED";
    const parseError: ValidationError = { field: "file", code, message: parseFailureMessage(code) };
    return failure(parseError.message, 422, "PARSE_FAILED", [parseError]);
  }

  const validationErrors = [...result.errors];
  if (!result.rows.length) {
    validationErrors.push({ field: "file", code: "NO_VALID_ROWS", message: "Tidak ada baris valid dalam file." });
  }
  const headers = (rows[0] ?? []).map((value, index) => String(value ?? "").trim() || `Column ${index + 1}`);
  const validRowNumbers = new Set(result.rows.map((row) => Number(row.row_number)));
  const errorRowNumbers = new Set(validationErrors.map((error) => error.row).filter((row): row is number => Number.isInteger(row)));
  const extractedRows = rows.slice(1).flatMap((row, index) => {
    if (row.every((value) => String(value ?? "").trim() === "")) return [];
    const rowNumber = index + 2;
    const status = errorRowNumbers.has(rowNumber) ? "invalid" : validRowNumbers.has(rowNumber) ? "valid" : "ignored";
    return [{ row_number: rowNumber, status, values: headers.map((_, column) => String(row[column] ?? "")) }];
  });

  return NextResponse.json({
    data: {
      fileName: file.name,
      documentType,
      headers,
      rows: extractedRows,
      errors: validationErrors,
      warnings: result.warnings,
      canFinalize: true,
    },
    meta: { durationMs: Math.round(performance.now() - startedAt) },
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

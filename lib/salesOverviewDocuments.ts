export type RecentDocument = {
  id: string;
  file_name: string;
  document_type: "COMPANY_SALES_REPORT" | "OUTSTANDING_REPORT";
  mime_type: string;
  file_size_bytes: number;
  storage_bucket: string;
  uploaded_at: string;
  processed_at: string | null;
  validation_status: "uploaded" | "processing" | "validated" | "rejected";
  row_count: number;
  valid_row_count: number;
  invalid_row_count: number;
  error_summary: string | null;
};

export type DocumentPreview = {
  document: RecentDocument & { storage_path: string };
  errors: Array<{ row_number: number | null; field_name: string; error_code: string; error_message: string; raw_value: string | null; severity?: string | null }>;
  rows: Array<Record<string, unknown>>;
  customers: Array<{ customer_id: string; customer_code: string; customer_name: string; branch: string; source_type: string; source_document_id: string | null }>;
  signedUrl: string | null;
};

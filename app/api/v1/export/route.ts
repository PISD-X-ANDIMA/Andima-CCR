import { requireSession, checkOrigin } from "@/lib/server/http";
import { NextRequest, NextResponse } from 'next/server';
import { requestExportFileInSupabase } from '@/lib/supabaseOverdueApi';

export async function POST(req: NextRequest) {
  const session = await requireSession(); if (session.error) return session.error;
  const originError = checkOrigin(req); if (originError) return originError;
  try {
    const body = await req.json();
    const { format, periodFilter } = body;

    const requestedUuid = session.user!.id;
    const exportResult = await requestExportFileInSupabase(
      format || 'XLSX',
      requestedUuid,
      periodFilter || { period: 'Q3-2026' }
    );

    return NextResponse.json(
      {
        success: true,
        message: `Export request for format ${format || 'XLSX'} created successfully.`,
        requestId: exportResult.requestId || `EXP-${Date.now()}`,
        downloadUrl: `/api/v1/export/download?fileId=${exportResult.fileId || 'demo-file'}&ref=${encodeURIComponent(exportResult.storageRef || 'exports/report.xlsx')}`,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to create export request', message: 'Unable to process request.' },
      { status: 500 }
    );
  }
}

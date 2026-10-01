import { NextRequest, NextResponse } from 'next/server';
import { requestExportFileInSupabase } from '@/lib/supabaseOverdueApi';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { format, requestedBy, periodFilter } = body;

    const requestedUuid = requestedBy || 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
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
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create export request', message: error.message },
      { status: 500 }
    );
  }
}

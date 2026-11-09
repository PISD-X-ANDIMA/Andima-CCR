import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canManage, getCcrProfile } from "@/lib/server/authorization";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", "));
  return response;
}

async function listFiles(storage: ReturnType<typeof createAdminClient>["storage"], bucket: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else files.push(...await listFiles(storage, bucket, path));
    }
    if (!data || data.length < 1000) break;
  }
  return files;
}

export async function POST() {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  const authDuration = performance.now() - authStarted;
  if (!canManage(profile)) return timed(NextResponse.json({ error: { code: "FORBIDDEN", message: "Management access is required." } }, { status: 403 }), startedAt, { auth: authDuration });

  try {
    const storageStarted = performance.now();
    const admin = createAdminClient();
    const bucket = "c1-document-uploads";
    const files = await listFiles(admin.storage, bucket);
    if (files.length) {
      const { error } = await admin.storage.from(bucket).remove(files);
      if (error) throw error;
    }
    const storageDuration = performance.now() - storageStarted;
    const databaseStarted = performance.now();
    const { data, error } = await admin.rpc("reset_c1_sales_overview_data");
    if (error) throw error;
    return timed(NextResponse.json({ data: { ...((data as Record<string, unknown>) ?? {}), deleted_storage_files: files.length } }), startedAt, { auth: authDuration, storage: storageDuration, db: performance.now() - databaseStarted });
  } catch {
    return timed(NextResponse.json({ error: { code: "RESET_FAILED", message: "C1 Sales Overview data could not be reset." } }, { status: 500 }), startedAt, { auth: authDuration });
  }
}

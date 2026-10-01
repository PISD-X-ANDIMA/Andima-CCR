import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MANAGEMENT_POSITIONS = new Set([
  "0ec333af-8737-413f-adab-841a3067e485",
  "48e90a83-86bd-4bd9-8b34-0fe7da11cc18",
  "4b7c8e36-f133-4e2b-9b98-c1a1554d1545",
  "8b14d133-0c6c-4867-a807-373cf462e5fe",
  "67a8e1ba-daa7-4230-9c82-8dfef7e8fd15",
]);

const ADMIN_STAFF_POSITIONS = new Set([
  "10da1bac-a6a8-472e-a171-e4984ab768d9",
  "58706b7f-950b-4e71-b066-792fbd91424d",
  "a8be934a-5d25-46cc-94c7-3be79e3ba035",
  "ba43f1eb-7e99-4a85-8471-9d3e54e526b9",
  "d7d206cc-6763-459f-9a70-771f65b89937",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return response("Server provisioning is not configured.", 503, "PROVISIONING_UNAVAILABLE");

  let body: { auth_user_id?: string; full_name?: string; email?: string; phone?: string; employment_status?: string; position_id?: string; department_id?: string };
  try { body = await request.json(); } catch { return response("Invalid request body.", 400, "INVALID_JSON"); }

  const { auth_user_id: authUserId, full_name: fullName, email, phone, employment_status: employmentStatus, position_id: positionId, department_id: departmentId } = body;
  if (!authUserId || !UUID.test(authUserId) || !fullName?.trim() || !email?.trim() || !positionId || !UUID.test(positionId) || !departmentId || !UUID.test(departmentId)) return response("Registration data is incomplete or invalid.", 400, "INVALID_REGISTRATION");

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(authUserId);
  if (authError || !authData.user || authData.user.email?.toLowerCase() !== email.trim().toLowerCase()) return response("Auth user could not be verified.", 400, "AUTH_USER_MISMATCH");

  const [{ data: position, error: positionError }, { data: department, error: departmentError }] = await Promise.all([
    admin.from("d3_positions").select("id").eq("id", positionId).maybeSingle(),
    admin.from("d3_departments").select("id").eq("id", departmentId).maybeSingle(),
  ]);
  if (positionError || departmentError) return response("Unable to validate position or department.", 500, "REFERENCE_LOOKUP_FAILED");
  if (!position || !department) return response("Selected position or department does not exist.", 400, "INVALID_REFERENCE");

  const appRole = MANAGEMENT_POSITIONS.has(positionId.toLowerCase()) ? "MANAGER" : ADMIN_STAFF_POSITIONS.has(positionId.toLowerCase()) ? "HR" : "EMPLOYEE";
  const employeeId = `AND-${authUserId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const { data: employee, error: employeeError } = await admin.from("d3_employee").upsert({ employee_id: employeeId, full_name: fullName.trim(), email: email.trim().toLowerCase(), phone: phone?.trim() || null, join_date: new Date().toISOString().slice(0, 10), employment_status: employmentStatus?.toUpperCase() || "PROBATION", position_id: positionId, department_id: departmentId, work_location: "HQ" }, { onConflict: "email" }).select("id, employee_id").single();
  if (employeeError || !employee) return response("Unable to provision employee profile.", 500, "EMPLOYEE_PROVISION_FAILED");

  const { error: accessError } = await admin.from("d3_user_access").upsert({ auth_user_id: authUserId, employee_id: employee.id, app_role: appRole }, { onConflict: "auth_user_id" });
  if (accessError) return response("Unable to provision account access.", 500, "ACCESS_PROVISION_FAILED");
  return NextResponse.json({ data: { employee_id: employee.employee_id, app_role: appRole } }, { status: 201 });
}

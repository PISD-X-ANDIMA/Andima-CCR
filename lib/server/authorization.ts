import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/server/admin";

export type CcrRole = "STAFF" | "MANAGEMENT";

export type CcrProfile = {
  auth_user_id: string;
  employee_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  position_id: string | null;
  department_id: string | null;
  position_title: string | null;
  department_name: string | null;
  registration_status: string;
  resolved_role: CcrRole | null;
  is_active: boolean;
};

function role(value: unknown): CcrRole | null {
  return value === "STAFF" || value === "MANAGEMENT" ? value : null;
}

export async function getCcrProfile(client: SupabaseClient, userId: string): Promise<CcrProfile | null> {
  const { data: registration, error } = await client
    .from("b2_register")
    .select("auth_user_id, id, employee_id, full_name, email, phone, position_id, departement_id, registration_status, resolved_role, is_active")
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle();
  if (error || !registration) return null;

  const positionId = registration.position_id as string | null;
  const departmentId = registration.departement_id as string | null;
  let position: { title: string } | null = null;
  let department: { name: string } | null = null;
  try {
    const admin = createAdminClient();
    const [{ data: positionData }, { data: departmentData }] = await Promise.all([
      positionId ? admin.from("d3_positions").select("title").eq("id", positionId).maybeSingle() : Promise.resolve({ data: null }),
      departmentId ? admin.from("d3_departments").select("name").eq("id", departmentId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    position = positionData;
    department = departmentData;
  } catch {
    // The b2 profile remains authoritative if reference metadata is unavailable.
  }
  return {
    auth_user_id: String(registration.auth_user_id ?? registration.id ?? userId),
    employee_id: registration.employee_id,
    full_name: registration.full_name,
    email: registration.email,
    phone: registration.phone,
    position_id: positionId,
    department_id: departmentId,
    position_title: position?.title ?? null,
    department_name: department?.name ?? null,
    registration_status: String(registration.registration_status ?? ""),
    resolved_role: role(registration.resolved_role),
    is_active: registration.is_active !== false,
  };
}

export function isProvisionedCcr(profile: CcrProfile | null): profile is CcrProfile & { resolved_role: CcrRole } {
  return Boolean(profile && profile.is_active && ["APPROVED", "PROVISIONED"].includes(profile.registration_status) && profile.resolved_role);
}

export function canUpload(profile: CcrProfile | null) {
  return isProvisionedCcr(profile) && profile.resolved_role === "STAFF";
}

export function canManage(profile: CcrProfile | null) {
  return isProvisionedCcr(profile) && profile.resolved_role === "MANAGEMENT";
}

export function canUseCcr(profile: CcrProfile | null) {
  return isProvisionedCcr(profile);
}

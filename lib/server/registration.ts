import "server-only";
import { createAdminClient } from "./admin";
export type Registration = { full_name: string; email: string; password: string; phone: string; employment_status: string; position_id: string; department_id: string };
const departments: Record<string, string> = {
  "40a8e1f1-0713-4e5d-a7af-061b6e5f495c": "d38c1ed7-abd4-4a57-ab9d-0ba1d396fbfc",
  "96c66ea1-44b6-474f-9410-ad992dd14b93": "72cd470d-216c-48b6-abd9-0cd05a4d8974",
  "265c9357-105c-437c-a244-6897122f17c1": "8113ab6f-d5cc-4c94-bbf6-e08047931fab",
  "10da1bac-a6a8-472e-a171-e4984ab768d9": "1653db5f-2b64-418f-b28b-68cb7b9dae8e",
  "58706b7f-950b-4e71-b066-792fbd91424d": "97ac5d35-5da2-4f5d-9d36-78500f403cc7",
};
export function validateRegistration(body: unknown): Registration | null {
  if (!body || typeof body !== "object") return null;
  const values = body as Record<string, unknown>;
  const keys = ["full_name", "email", "password", "phone", "employment_status", "position_id", "department_id"];
  if (keys.some(key => typeof values[key] !== "string")) return null;
  const data = Object.fromEntries(keys.map(key => [key, key === "password" ? values[key] : (values[key] as string).trim()])) as Registration;
  data.email = data.email.toLowerCase(); data.employment_status = data.employment_status.toUpperCase();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!/^[a-zA-Z\s]{1,255}$/.test(data.full_name) || !/^[^\s@]+@andima\.co\.id$/.test(data.email) || data.email.length > 255 || !/^\d{1,12}$/.test(data.phone)
      || data.password.length < 10 || data.password.length > 128 || !/[a-zA-Z]/.test(data.password) || !/\d/.test(data.password) || !/[^a-zA-Z0-9]/.test(data.password)
      || !["PROBATION", "PERMANENT"].includes(data.employment_status) || !uuid.test(data.position_id) || !uuid.test(data.department_id)) return null;
  if (data.position_id !== "0ec333af-8737-413f-adab-841a3067e485" && departments[data.position_id] !== data.department_id) return null;
  return data;
}
export async function provisionRegistration(admin: ReturnType<typeof createAdminClient>, userId: string, data: Registration) {
  const result = await admin.rpc("provision_app_registration", {
    p_user_id: userId, p_full_name: data.full_name, p_email: data.email, p_phone: data.phone,
    p_status: data.employment_status, p_position_id: data.position_id, p_department_id: data.department_id,
  });
  if (result.error || !result.data) throw new Error("Unable to provision registration.");
  return result.data as { employee_id: string; app_role: string };
}

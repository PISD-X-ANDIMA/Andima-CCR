import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env
const env = readFileSync(".env", "utf8");
const parsed = {};
for (const line of env.split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    parsed[m[1]] = v.trim();
  }
}

const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = parsed.SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ANON_KEY in .env");
}

const targetAccounts = [
  { email: "stevanusimanuel@andima.co.id", role: "MANAGEMENT", empId: "CCR-003", canManage: true, canUpload: false },
  { email: "jonathanindrawan@andima.co.id", role: "MANAGEMENT", empId: "CCR-004", canManage: true, canUpload: false },
  { email: "diazbara@andima.co.id", role: "MANAGEMENT", empId: "CCR-005", canManage: true, canUpload: false },
  { email: "jesichan@andima.co.id", role: "STAFF", empId: "CCR-006", canManage: false, canUpload: true },
  { email: "aldosapan@andima.co.id", role: "STAFF", empId: "CCR-007", canManage: false, canUpload: true },
  { email: "michaeljackson@andima.co.id", role: "STAFF", empId: "CCR-008", canManage: false, canUpload: true },
  { email: "taylorswift@andima.co.id", role: "STAFF", empId: "CCR-009", canManage: false, canUpload: true },
  { email: "keanureeves@andima.co.id", role: "STAFF", empId: "CCR-010", canManage: false, canUpload: true },
  { email: "emmawatson@andima.co.id", role: "STAFF", empId: "CCR-011", canManage: false, canUpload: true },
  { email: "tomhanks@andima.co.id", role: "STAFF", empId: "CCR-012", canManage: false, canUpload: true }
];

async function main() {
  console.log("=== VERIFYING CCR LOGIN AND ACCESS CONTROL FOR 10 TARGET ACCOUNTS ===");
  let passedCount = 0;

  for (const acc of targetAccounts) {
    // 1. Create client per user session
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 2. Sign in with password @CCR12345a
    const { data: authData, error: signInError } = await client.auth.signInWithPassword({
      email: acc.email,
      password: "@CCR12345a"
    });

    if (signInError || !authData.user) {
      console.error(`❌ [${acc.email}] Sign in failed:`, signInError?.message);
      continue;
    }

    // 3. Replicate exact logic from app/api/auth/login/route.ts
    const { data: profile, error: profileError } = await client
      .from("b2_register")
      .select("resolved_role, registration_status, is_active, employee_id")
      .or(`auth_user_id.eq.${authData.user.id},id.eq.${authData.user.id}`)
      .maybeSingle();

    if (profileError) {
      console.error(`❌ [${acc.email}] b2_register query error:`, profileError.message);
      continue;
    }

    if (!profile) {
      console.error(`❌ [${acc.email}] b2_register profile NOT FOUND`);
      continue;
    }

    const isActive = profile.is_active !== false;
    const isProvisioned = ["APPROVED", "PROVISIONED"].includes(String(profile.registration_status));
    const roleMatches = profile.resolved_role === acc.role;
    const empIdMatches = profile.employee_id === acc.empId;

    if (!isActive || !isProvisioned || !roleMatches || !empIdMatches) {
      console.error(`❌ [${acc.email}] Validation failure:`, {
        profile,
        isActive,
        isProvisioned,
        roleMatches,
        empIdMatches
      });
      continue;
    }

    // 4. Test authorization capabilities
    const canUseCcr = isProvisioned && isActive && ["STAFF", "MANAGEMENT"].includes(profile.resolved_role);
    const canManage = canUseCcr && profile.resolved_role === "MANAGEMENT";
    const canUpload = canUseCcr && profile.resolved_role === "STAFF";

    if (canManage !== acc.canManage || canUpload !== acc.canUpload || !canUseCcr) {
      console.error(`❌ [${acc.email}] Capability check failed:`, { canUseCcr, canManage, canUpload });
      continue;
    }

    console.log(`✅ [${acc.email}] (${profile.employee_id}) Login & Auth: SUCCESS | Role: ${profile.resolved_role} | Status: ${profile.registration_status} | canManage: ${canManage} | canUpload: ${canUpload}`);
    passedCount++;
  }

  console.log(`\nVerification Result: ${passedCount} / ${targetAccounts.length} ACCOUNTS VERIFIED SUCCESSFUL!`);
  if (passedCount !== targetAccounts.length) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Verification script error:", err);
  process.exit(1);
});

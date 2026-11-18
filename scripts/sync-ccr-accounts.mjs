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
const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const FAT_DEPT_ID = "1653db5f-2b64-418f-b28b-68cb7b9dae8e"; // Finance, Accounting & Tax
const COM_DEPT_ID = "97ac5d35-5da2-4f5d-9d36-78500f403cc7"; // Commercial & Customer Success

const targetAccountsToKeep = [
  {
    email: "stevanusimanuel@andima.co.id",
    full_name: "Stevanus Imanuel",
    position_code: "DIR-FAT",
    department_id: FAT_DEPT_ID,
    role: "MANAGEMENT",
    employee_id: "CCR-003",
    d3_app_role: "MANAGER",
    phone: "07635257352"
  },
  {
    email: "jonathanindrawan@andima.co.id",
    full_name: "Jonathan Indrawan",
    position_code: "FAT-ACC-MGR",
    department_id: FAT_DEPT_ID,
    role: "MANAGEMENT",
    employee_id: "CCR-004",
    d3_app_role: "MANAGER",
    phone: "0872635166"
  },
  {
    email: "diazbara1@andima.co.id",
    full_name: "Diaz Bara",
    position_code: "COM-CS-MGR",
    department_id: COM_DEPT_ID,
    role: "MANAGEMENT",
    employee_id: "CCR-005",
    d3_app_role: "MANAGER",
    phone: "628111000003"
  },
  {
    email: "aldosapan@andima.co.id",
    full_name: "Aldo Sapan",
    position_code: "FAT-TRS-MGR",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-007",
    d3_app_role: "HR",
    phone: "628111000005"
  },
  {
    email: "jesichan@andima.co.id",
    full_name: "Jesicha Novrani",
    position_code: "FAT-BIL",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-006",
    d3_app_role: "HR",
    phone: "0896352721"
  }
];

const targetAccountsToDelete = [
  { email: "michaeljackson@andima.co.id", employee_id: "CCR-008" },
  { email: "taylorswift@andima.co.id", employee_id: "CCR-009" },
  { email: "keanureeves@andima.co.id", employee_id: "CCR-010" },
  { email: "emmawatson@andima.co.id", employee_id: "CCR-011" },
  { email: "tomhanks@andima.co.id", employee_id: "CCR-012" }
];

async function main() {
  console.log("=== STEP 1: PROVISIONING / SYNCING TARGET ACCOUNTS ===");

  // Load existing positions
  const { data: positions, error: posError } = await supabase.from("d3_positions").select("id, code, title, department_id");
  if (posError) throw new Error("Failed to load positions: " + posError.message);

  const posByCode = new Map();
  for (const pos of positions) {
    posByCode.set(pos.code.trim().toUpperCase(), pos);
  }

  // Fetch all Auth users
  const { data: authData, error: authListError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authListError) throw new Error("Failed to list auth users: " + authListError.message);

  const authUserMap = new Map();
  for (const user of authData.users) {
    if (user.email) authUserMap.set(user.email.toLowerCase(), user);
  }

  for (const acc of targetAccountsToKeep) {
    const email = acc.email.toLowerCase();
    const pos = posByCode.get(acc.position_code.toUpperCase());
    if (!pos) throw new Error(`Required position code ${acc.position_code} not found in d3_positions`);

    let authUser = authUserMap.get(email);
    if (!authUser) {
      console.log(`Creating auth user: ${email}`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: "@CCR12345a",
        email_confirm: true,
        user_metadata: { full_name: acc.full_name }
      });
      if (createError) throw new Error(`Failed to create auth user ${email}: ${createError.message}`);
      authUser = newUser.user;
      authUserMap.set(email, authUser);
      console.log(`  Auth user created: id=${authUser.id}`);
    } else {
      console.log(`Auth user already exists: ${email} (id=${authUser.id}), updating password and metadata`);
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: "@CCR12345a",
        email_confirm: true,
        user_metadata: { full_name: acc.full_name }
      });
      if (updateAuthError) console.warn(`  [auth update warning for ${email}]: ${updateAuthError.message}`);
    }

    // Check if b2_register already exists for this user
    const { data: existingB2 } = await supabase
      .from("b2_register")
      .select("id, employee_id")
      .or(`id.eq.${authUser.id},email.eq.${email}`)
      .maybeSingle();

    if (existingB2) {
      console.log(`  Updating existing b2_register for ${email} (preserving employee_id=${existingB2.employee_id})`);
      const { error: updateB2Error } = await supabase
        .from("b2_register")
        .update({
          auth_user_id: authUser.id,
          full_name: acc.full_name,
          email: email,
          phone: acc.phone,
          position_id: pos.id,
          departement_id: acc.department_id,
          password: "@CCR12345a",
          registration_status: "PROVISIONED",
          resolved_role: acc.role,
          is_active: true
        })
        .eq("id", existingB2.id);
      if (updateB2Error) throw new Error(`Failed to update b2_register for ${email}: ${updateB2Error.message}`);
    } else {
      console.log(`  Inserting new b2_register for ${email} (${acc.role}, ${acc.employee_id})`);
      const { error: insertB2Error } = await supabase
        .from("b2_register")
        .insert({
          id: authUser.id,
          auth_user_id: authUser.id,
          employee_id: acc.employee_id,
          full_name: acc.full_name,
          email: email,
          phone: acc.phone,
          employment_status: "permanent",
          position_id: pos.id,
          departement_id: acc.department_id,
          password: "@CCR12345a",
          registration_status: "PROVISIONED",
          resolved_role: acc.role,
          approved_at: new Date().toISOString(),
          is_active: true
        });
      if (insertB2Error) throw new Error(`Failed to insert b2_register for ${email}: ${insertB2Error.message}`);
    }

    // Sync d3_employee
    const { data: existingEmp } = await supabase
      .from("d3_employee")
      .select("id, employee_id")
      .or(`email.eq.${email},employee_id.eq.${acc.employee_id}`)
      .maybeSingle();

    let empUuid = existingEmp?.id;
    if (existingEmp) {
      const { error: updateEmpError } = await supabase
        .from("d3_employee")
        .update({
          full_name: acc.full_name,
          email: email,
          position_id: pos.id,
          department_id: acc.department_id,
          employment_status: "PERMANENT"
        })
        .eq("id", existingEmp.id);
      if (updateEmpError) console.warn(`  [d3_employee update warn]: ${updateEmpError.message}`);
      else console.log(`  Updated d3_employee: ${existingEmp.id}`);
    } else {
      const { data: newEmp, error: insertEmpError } = await supabase
        .from("d3_employee")
        .insert({
          employee_id: acc.employee_id,
          full_name: acc.full_name,
          email: email,
          phone: acc.phone,
          join_date: new Date().toISOString().split("T")[0],
          employment_status: "PERMANENT",
          position_id: pos.id,
          department_id: acc.department_id,
          work_location: "HQ"
        })
        .select("id")
        .single();
      if (insertEmpError) console.warn(`  [d3_employee insert warn]: ${insertEmpError.message}`);
      else {
        empUuid = newEmp?.id;
        console.log(`  Inserted d3_employee: ${empUuid}`);
      }
    }

    // Sync d3_user_access
    if (empUuid) {
      const { error: accessError } = await supabase.from("d3_user_access").upsert({
        auth_user_id: authUser.id,
        employee_id: empUuid,
        app_role: acc.d3_app_role
      }, { onConflict: "auth_user_id" });
      if (accessError) console.warn(`  [d3_user_access warn]: ${accessError.message}`);
      else console.log(`  Updated d3_user_access: ${acc.d3_app_role}`);
    }
  }

  console.log("\n=== STEP 2: SAFELY DELETING REQUESTED OLD ACCOUNTS ===");
  const deleteEmails = targetAccountsToDelete.map(a => a.email.toLowerCase());
  const deleteEmpIds = targetAccountsToDelete.map(a => a.employee_id);

  // 1. Delete c1_assignment related to these employee IDs or auth user IDs
  console.log("Checking c1_assignment for assigned_to in:", deleteEmpIds);
  const { data: assignmentsToDelete } = await supabase
    .from("c1_assignment")
    .select("assignment_id, assigned_to, assigned_by, updated_by")
    .in("assigned_to", deleteEmpIds);

  if (assignmentsToDelete?.length) {
    console.log(`Found ${assignmentsToDelete.length} assignments to delete.`);
    const { error: delAssignError } = await supabase
      .from("c1_assignment")
      .delete()
      .in("assigned_to", deleteEmpIds);
    if (delAssignError) console.warn("  Failed to delete c1_assignment:", delAssignError.message);
    else console.log("  Successfully deleted assignments.");
  } else {
    console.log("No assignments found for target employee IDs.");
  }

  // 2. Look up Auth users and d3_employees for the accounts to delete
  for (const item of targetAccountsToDelete) {
    const email = item.email.toLowerCase();
    console.log(`\nProcessing deletion of: ${email} (${item.employee_id})`);

    const authUser = authUserMap.get(email);
    if (authUser) {
      // Delete any assignments where assigned_by or updated_by was this user
      await supabase.from("c1_assignment").delete().or(`assigned_by.eq.${authUser.id},updated_by.eq.${authUser.id}`);
      
      // Delete d3_user_access
      const { error: delAccessError } = await supabase.from("d3_user_access").delete().eq("auth_user_id", authUser.id);
      if (delAccessError) console.warn(`  [del d3_user_access warn]: ${delAccessError.message}`);

      // Delete b2_register
      const { error: delB2Error } = await supabase.from("b2_register").delete().eq("id", authUser.id);
      if (delB2Error) console.warn(`  [del b2_register warn]: ${delB2Error.message}`);

      // Delete auth user
      const { error: delAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
      if (delAuthError) console.warn(`  [del auth.users warn]: ${delAuthError.message}`);
      else console.log(`  Deleted auth user ${email} (id: ${authUser.id})`);
    } else {
      // In case b2_register has row with email
      await supabase.from("b2_register").delete().eq("email", email);
    }

    // Delete d3_employee
    const { error: delEmpError } = await supabase
      .from("d3_employee")
      .delete()
      .or(`email.eq.${email},employee_id.eq.${item.employee_id}`);
    if (delEmpError) console.warn(`  [del d3_employee warn]: ${delEmpError.message}`);
    else console.log(`  Deleted d3_employee record for ${email}`);
  }

  console.log("\nAccount synchronization and cleanup complete!");
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

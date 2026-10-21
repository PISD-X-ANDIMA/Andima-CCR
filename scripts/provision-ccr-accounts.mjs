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

const FAT_DEPT_ID = "1653db5f-2b64-418f-b28b-68cb7b9dae8e";
const COM_DEPT_ID = "97ac5d35-5da2-4f5d-9d36-78500f403cc7";

const targetAccounts = [
  {
    email: "stevanusimanuel@andima.co.id",
    full_name: "Stevanus Imanuel",
    position_title: "Director of Finance, Accounting & Digital Transformation",
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
    position_title: "Manager of Accounting",
    position_code: "FAT-ACC-MGR",
    department_id: FAT_DEPT_ID,
    role: "MANAGEMENT",
    employee_id: "CCR-004",
    d3_app_role: "MANAGER",
    phone: "0872635166"
  },
  {
    email: "diazbara@andima.co.id",
    full_name: "Diaz Bara",
    position_title: "Manager of Customer Success",
    position_code: "COM-CS-MGR",
    department_id: COM_DEPT_ID,
    role: "MANAGEMENT",
    employee_id: "CCR-005",
    d3_app_role: "MANAGER",
    phone: "628111000003"
  },
  {
    email: "jesichan@andima.co.id",
    full_name: "Jesicha Novrani",
    position_title: "Accounting Associate (Billing)",
    position_code: "FAT-BIL",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-006",
    d3_app_role: "HR",
    phone: "0896352721"
  },
  {
    email: "aldosapan@andima.co.id",
    full_name: "Aldo Sapan",
    position_title: "Cash Manager",
    position_code: "FAT-TRS-MGR",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-007",
    d3_app_role: "HR",
    phone: "628111000005"
  },
  {
    email: "michaeljackson@andima.co.id",
    full_name: "Michael Jackson",
    position_title: "Tax Manager",
    position_code: "FAT-TAX-MGR",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-008",
    d3_app_role: "HR",
    phone: "628111000006"
  },
  {
    email: "taylorswift@andima.co.id",
    full_name: "Taylor Swift",
    position_title: "Tax Associate",
    position_code: "FAT-TAX-ASC-002",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-009",
    d3_app_role: "HR",
    phone: "628111000007"
  },
  {
    email: "keanureeves@andima.co.id",
    full_name: "Keanu Reeves",
    position_title: "Sales Executive",
    position_code: "COM-SLS-003",
    department_id: COM_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-010",
    d3_app_role: "HR",
    phone: "628111000008"
  },
  {
    email: "emmawatson@andima.co.id",
    full_name: "Emma Watson",
    position_title: "Sales Administration Associate",
    position_code: "COM-SA",
    department_id: COM_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-011",
    d3_app_role: "HR",
    phone: "628111000009"
  },
  {
    email: "tomhanks@andima.co.id",
    full_name: "Tom Hanks",
    position_title: "Cash Manager Associate",
    position_code: "FAT-TRS-ASC",
    department_id: FAT_DEPT_ID,
    role: "STAFF",
    employee_id: "CCR-012",
    d3_app_role: "HR",
    phone: "628111000010"
  }
];

async function ensurePositions() {
  console.log("Checking and ensuring positions in d3_positions...");
  const { data: existingPositions, error } = await supabase.from("d3_positions").select("*");
  if (error) throw new Error(`Failed to fetch positions: ${error.message}`);

  const positionMap = new Map();
  for (const pos of existingPositions) {
    positionMap.set(pos.code.toUpperCase(), pos);
    positionMap.set(pos.title.trim().toLowerCase(), pos);
  }

  // Ensure DIR-FAT exists
  let dirFat = positionMap.get("DIR-FAT") || positionMap.get("director of finance, accounting & digital transformation");
  if (!dirFat) {
    console.log("Creating canonical position DIR-FAT...");
    const { data: newPos, error: insertError } = await supabase
      .from("d3_positions")
      .insert({
        code: "DIR-FAT",
        title: "Director of Finance, Accounting & Digital Transformation",
        department_id: FAT_DEPT_ID
      })
      .select()
      .single();
    if (insertError) throw new Error(`Failed to create DIR-FAT position: ${insertError.message}`);
    dirFat = newPos;
    console.log("DIR-FAT created:", dirFat.id);
  }

  // Update position titles/departments if needed to be clean and canonical
  const resolvedPositions = new Map();
  for (const acc of targetAccounts) {
    let match = null;
    if (acc.position_code === "DIR-FAT") {
      match = dirFat;
    } else {
      match = existingPositions.find(p => p.code.toUpperCase() === acc.position_code.toUpperCase());
      if (!match) {
        match = existingPositions.find(p => p.title.trim().toLowerCase() === acc.position_title.toLowerCase());
      }
    }

    if (!match) {
      throw new Error(`Could not find position for ${acc.position_code} (${acc.position_title})`);
    }

    resolvedPositions.set(acc.email.toLowerCase(), match);
  }

  return resolvedPositions;
}

async function main() {
  console.log("=== PROVISIONING CCR USER ACCOUNTS IN B2_REGISTER ===");
  const positionMap = await ensurePositions();

  // Fetch all Auth users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) throw new Error(`Failed to list auth users: ${authError.message}`);

  for (const acc of targetAccounts) {
    const email = acc.email.toLowerCase();
    const authUser = authData.users.find(u => u.email?.toLowerCase() === email);
    if (!authUser) {
      throw new Error(`Auth user not found for ${email}`);
    }

    const pos = positionMap.get(email);
    console.log(`\nProcessing: ${email} -> ${acc.employee_id} | ${acc.role} | Pos: ${pos.code} (${pos.id})`);

    // 1. Upsert into b2_register
    const b2Record = {
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
    };

    const { error: b2UpsertError } = await supabase
      .from("b2_register")
      .upsert(b2Record, { onConflict: "id" });

    if (b2UpsertError) {
      throw new Error(`Failed to upsert b2_register for ${email}: ${b2UpsertError.message}`);
    }
    console.log(`  [b2_register] OK (id=${authUser.id}, role=${acc.role}, emp=${acc.employee_id})`);

    // 2. Sync d3_employee
    const { data: existingEmp } = await supabase
      .from("d3_employee")
      .select("id, employee_id")
      .or(`email.eq.${email},employee_id.eq.${acc.employee_id}`)
      .maybeSingle();

    let employeeUuid = existingEmp?.id;
    if (existingEmp) {
      const { error: empUpdateError } = await supabase
        .from("d3_employee")
        .update({
          employee_id: acc.employee_id,
          full_name: acc.full_name,
          email: email,
          position_id: pos.id,
          department_id: acc.department_id,
          employment_status: "PERMANENT"
        })
        .eq("id", existingEmp.id);
      if (empUpdateError) console.warn(`  [d3_employee update warn]: ${empUpdateError.message}`);
      else console.log(`  [d3_employee] Updated ID ${existingEmp.id} to ${acc.employee_id}`);
    } else {
      const { data: newEmp, error: empInsertError } = await supabase
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
        .select()
        .single();
      if (empInsertError) console.warn(`  [d3_employee insert warn]: ${empInsertError.message}`);
      else {
        employeeUuid = newEmp?.id;
        console.log(`  [d3_employee] Inserted new record ID ${employeeUuid}`);
      }
    }

    // 3. Sync d3_user_access if employeeUuid exists
    if (employeeUuid) {
      const { error: accessError } = await supabase
        .from("d3_user_access")
        .upsert({
          auth_user_id: authUser.id,
          employee_id: employeeUuid,
          app_role: acc.d3_app_role
        }, { onConflict: "auth_user_id" });
      if (accessError) console.warn(`  [d3_user_access upsert warn]: ${accessError.message}`);
      else console.log(`  [d3_user_access] Set role ${acc.d3_app_role}`);
    }
  }

  console.log("\nAll 10 accounts successfully provisioned in b2_register!");
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CCR_DEMO_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
if (!password || password.length < 10) {
  throw new Error("CCR_DEMO_PASSWORD is required and must be at least 10 characters.");
}

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const accounts = [
  {
    email: "stevanusimanuel@andima.co.id",
    full_name: "CCR Demo Director",
    phone: "628111000001",
    positionCode: "DIR-FAT",
  },
  {
    email: "jonathanindrawan@andima.co.id",
    full_name: "CCR Demo Accounting Manager",
    phone: "628111000002",
    positionCode: "FAT-ACC-MGR",
  },
  {
    email: "diazbara@andima.co.id",
    full_name: "CCR Demo Customer Success Manager",
    phone: "628111000003",
    positionCode: "COM-CS-MGR",
  },
  {
    email: "jesichan@andima.co.id",
    full_name: "CCR Demo Billing Staff",
    phone: "628111000004",
    positionCode: "FAT-BIL",
  },
  {
    email: "aldosapan@andima.co.id",
    full_name: "CCR Demo Cash Manager",
    phone: "628111000005",
    positionCode: "FAT-TRS-MGR",
  },
  {
    email: "michaeljackson@andima.co.id",
    full_name: "CCR Demo Tax Manager",
    phone: "628111000006",
    positionCode: "FAT-TAX-MGR",
  },
  {
    email: "taylorswift@andima.co.id",
    full_name: "CCR Demo Tax Associate",
    phone: "628111000007",
    positionCode: "FAT-TAX-ASC",
  },
  {
    email: "keanureeves@andima.co.id",
    full_name: "CCR Demo Sales Executive",
    phone: "628111000008",
    positionCode: "COM-SLS",
  },
  {
    email: "emmawatson@andima.co.id",
    full_name: "CCR Demo Sales Administration",
    phone: "628111000009",
    positionCode: "COM-SA",
  },
  {
    email: "tomhanks@andima.co.id",
    full_name: "CCR Demo Cash Associate",
    phone: "628111000010",
    positionCode: "FAT-TRS-ASC",
  },
];

async function listAllAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Unable to list Auth users: ${error.message}`);
    users.push(...(data.users ?? []));
    if (!data.users || data.users.length < 1000) return users;
  }
}

async function resolvePositions() {
  const { data: positions, error: positionError } = await supabase
    .from("d3_positions")
    .select("id, code, title, department_id")
    .in("code", accounts.map((account) => account.positionCode));
  if (positionError) throw new Error(`Unable to load CCR positions: ${positionError.message}`);

  const byCode = new Map((positions ?? []).map((position) => [position.code.toUpperCase(), position]));
  const resolved = [];
  for (const account of accounts) {
    const position = byCode.get(account.positionCode);
    if (!position) throw new Error(`Canonical position ${account.positionCode} was not found.`);
    const { data: role, error: roleError } = await supabase.rpc("ccr_role_for_position", {
      p_position_id: position.id,
    });
    if (roleError) throw new Error(`Unable to resolve ${account.positionCode}: ${roleError.message}`);
    if (role !== "STAFF" && role !== "MANAGEMENT") {
      throw new Error(`${account.positionCode} is not an eligible CCR position.`);
    }
    resolved.push({ ...account, position, role });
  }
  return resolved;
}

function printPlan(resolved) {
  for (const account of resolved) {
    console.log(`${account.email}\t${account.position.code}\t${account.role}`);
  }
}

async function seed() {
  const resolved = await resolvePositions();
  console.log(`${dryRun ? "Dry run" : "Seeding"} ${resolved.length} CCR demo accounts:`);
  printPlan(resolved);
  if (dryRun) return;

  const authUsers = await listAllAuthUsers();
  const authByEmail = new Map(authUsers.map((user) => [user.email?.toLowerCase(), user]));
  const { data: registrations, error: registrationError } = await supabase
    .from("b2_register")
    .select("auth_user_id, id, email, employee_id, position_id, resolved_role, registration_status, is_active");
  if (registrationError) throw new Error(`Unable to load B2 registrations: ${registrationError.message}`);
  const registrationByEmail = new Map((registrations ?? []).map((registration) => [registration.email?.toLowerCase(), registration]));

  for (const account of resolved) {
    const email = account.email.toLowerCase();
    const existingAuth = authByEmail.get(email);
    const existingRegistration = registrationByEmail.get(email);

    if (existingRegistration) {
      const matches = existingRegistration.position_id === account.position.id
        && existingRegistration.resolved_role === account.role
        && existingRegistration.registration_status === "PROVISIONED"
        && existingRegistration.is_active === true;
      if (!matches) {
        throw new Error(`Existing B2 account ${email} conflicts with the requested position or role.`);
      }
      if (!existingAuth || existingAuth.id !== (existingRegistration.auth_user_id ?? existingRegistration.id)) {
        throw new Error(`Existing B2 account ${email} is not linked to its Auth user.`);
      }
      console.log(`SKIP\t${email}\t${existingRegistration.employee_id}\t${account.position.code}\t${account.role}`);
      continue;
    }

    if (existingAuth) {
      throw new Error(`Auth user ${email} already exists without a matching B2 profile; refusing to modify it.`);
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name, position_id: account.position.id },
    });
    if (createError || !created.user) {
      throw new Error(`Unable to create Auth user ${email}: ${createError?.message ?? "unknown error"}`);
    }

    try {
      const { data: profile, error: provisionError } = await supabase.rpc("provision_app_registration", {
        p_user_id: created.user.id,
        p_full_name: account.full_name,
        p_email: email,
        p_phone: account.phone,
        p_status: "PERMANENT",
        p_position_id: account.position.id,
        p_department_id: account.position.department_id,
      });
      if (provisionError || !profile) {
        throw new Error(provisionError?.message ?? "Provisioning returned no profile.");
      }
      console.log(`CREATED\t${email}\t${profile.employee_id}\t${account.position.code}\t${profile.app_role}`);
    } catch (error) {
      await supabase.rpc("rollback_app_registration", { p_user_id: created.user.id });
      await supabase.auth.admin.deleteUser(created.user.id);
      throw new Error(`Provisioning failed for ${email}; newly-created Auth user was rolled back. ${error.message}`);
    }
  }
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

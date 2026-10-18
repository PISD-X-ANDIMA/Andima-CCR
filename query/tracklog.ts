
import { supabase } from "@/lib/supabaseClient";

const LOGIN_LOG_SESSION_KEY = "b3_log_login_id";
const LOG_TIME_ZONE = "Asia/Jakarta";

function getJakartaDateTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LOG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    tanggal: `${values.year}-${values.month}-${values.day}`,
    waktu: `${values.hour}:${values.minute}:${values.second}`,
  };
}

export type LoginLogRecord = {
  id: string;
  register_id: string | null;
  nama: string | null;
  email: string | null;
  position: string | null;
  departement: string | null;
  tanggal_login: string;
  waktu_login: string | null;
  tanggal_logout: string | null;
  waktu_logout: string | null;
};

export async function fetchLoginLogs(
  startDate?: string,
  endDate?: string
): Promise<LoginLogRecord[]> {
  let query = supabase
    .from("b3_log_login")
    .select(`
      id,
      register_id,
      nama,
      email,
      "position",
      departement,
      tanggal_login,
      waktu_login,
      tanggal_logout,
      waktu_logout
    `);

  if (startDate) query = query.gte("tanggal_login", startDate);
  if (endDate) query = query.lte("tanggal_login", endDate);

  const { data, error } = await query
    .order("tanggal_login", { ascending: false })
    .order("waktu_login", { ascending: false });

  if (error) {
    throw new Error(
      `Gagal mengambil log login: ${error.message}`
    );
  }

  return (data ?? []) as LoginLogRecord[];
}

export async function recordLogin(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    throw new Error(
      `Tidak dapat membaca pengguna yang login: ${
        userError?.message ?? "email pengguna tidak tersedia"
      }`
    );
  }

  const { data: register, error: registerError } = await supabase
    .from("b2_register")
    .select(`
      id,
      full_name,
      email,
      position_id,
      departement_id
    `)
    .ilike("email", user.email)
    .single();

  if (registerError || !register) {
    throw new Error(
      `Gagal membaca profil b2_register: ${
        registerError?.message ?? "profil tidak ditemukan"
      }`
    );
  }

  if (!register.position_id) {
    throw new Error(
      "Profil pengguna belum memiliki position_id di b2_register."
    );
  }

  if (!register.departement_id) {
    throw new Error(
      "Profil pengguna belum memiliki departement_id di b2_register."
    );
  }

  const { data: positionData, error: positionError } = await supabase
    .from("d3_positions")
    .select("title")
    .eq("id", register.position_id)
    .maybeSingle();

  if (positionError || !positionData?.title) {
    throw new Error(
      `Gagal membaca posisi dari d3_positions: ${
        positionError?.message ??
        "posisi tidak ditemukan atau tidak diizinkan oleh RLS/Data API"
      }`
    );
  }

  const { data: departmentData, error: departmentError } = await supabase
    .from("d3_departments")
    .select("name")
    .eq("id", register.departement_id)
    .maybeSingle();

  if (departmentError || !departmentData?.name) {
    throw new Error(
      `Gagal membaca departemen dari d3_departments: ${
        departmentError?.message ??
        "departemen tidak ditemukan atau tidak diizinkan oleh RLS/Data API"
      }`
    );
  }

  const loginTime = getJakartaDateTime();

  const { data: log, error: logError } = await supabase
    .from("b3_log_login")
    .upsert(
      {
        register_id: register.id,
        nama: register.full_name,
        email: register.email,
        position: positionData.title,
        departement: departmentData.name,
        tanggal_login: loginTime.tanggal,
        waktu_login: loginTime.waktu,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "register_id, tanggal_login", // Mencegah error duplicate key
      }
    )
    .select("id")
    .single();

  if (logError || !log) {
    throw new Error(
      `Gagal menyimpan riwayat login: ${
        logError?.message ?? "ID log tidak dikembalikan"
      }`
    );
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(
      LOGIN_LOG_SESSION_KEY,
      log.id
    );
  }
}

export async function recordLogout(): Promise<void> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return;
    }

    const loginLogId =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(
            LOGIN_LOG_SESSION_KEY
          );

    if (!loginLogId) {
      return;
    }

    const logoutTime = getJakartaDateTime();

    const { error } = await supabase
      .from("b3_log_login")
      .update({
        tanggal_logout: logoutTime.tanggal,
        waktu_logout: logoutTime.waktu,
      })
      .eq("id", loginLogId)
      .eq("email", user.email)
      .is("waktu_logout", null);

    if (error) {
      console.error(
        "Gagal mencatat logout:",
        error
      );
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(
        LOGIN_LOG_SESSION_KEY
      );
    }
  } catch (error) {
    console.error("Error recordLogout:", error);
  }
}

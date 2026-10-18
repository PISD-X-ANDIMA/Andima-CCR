"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { logoutWithActivity, trackActivity } from "@/query/activity";
import { 
  Users, 
  Truck, 
  UserCheck, 
  ShieldCheck, 
  Briefcase, 
  Wallet, 
  BarChart3,
  ArrowRight,
  Building2,
  HeartHandshake
} from "lucide-react";
import router from "next/dist/shared/lib/router/router";

/* UUID POSISI DIREKTUR & DEPARTEMEN */
const DIRECTOR_POSITION_ID = "4acac2d4-8441-4cd8-bcd3-cf3ce4ca0ee0";

/* PEMETAAN UUID JABATAN KE NAMA TAMPILAN (Sesuai dengan database b2_register) */
const UUID_POSITION_MAP: Record<string, string> = {
  "4acac2d4-8441-4cd8-bcd3-cf3ce4ca0ee0": "Director",
  "446c8f5a-e923-4668-924d-75e28002fa03": "HR Manager",
  "265c9357-105c-437c-a244-6897122f17c1": "Information Technology",
  "8669bd7b-bad6-497e-8bbd-39039949224a": "Accounting Associate",
  "bc015ef6-0515-4875-a15d-0f38dbf3d2c3": "Sales Executive",
  "0ec333af-8737-413f-adab-841a3067e485": "Director",
  "48e90a83-86bd-4bd9-8b34-0fe7da11cc18": "Manager of Customer Success",
  "2f1901c6-0617-45ba-852f-9556ed957f21": "Field Agent",
  "8b14d133-0c6c-4867-a807-373cf462e5fe": "Manager of Accounting",
  "a8be934a-5d25-46cc-94c7-3be79e3ba035": "Cash Associate",
  "67a8e1ba-daa7-4230-9c82-8dfef7e8fd15": "Tax Manager",
  "44f4f4b2-edb9-46c8-933d-9c0dc0fd3646": "Tax Associate",
  "ba43f1eb-7e99-4a85-8471-9d3e54e526b9": "Sales Administration Associate",
  "7539f5e1-5729-423e-bd87-e15a51fae54c": "Billing",
  "7f6c629b-2300-4229-8c24-9df137c3cff2": "Associate Officer",
  "4b7c8e36-f133-4e2b-9b98-c1a1554d1545": "Cash Manager", 
};

const getInitials = (name?: string) => {
  if (!name) return "US";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

type ModuleCard = {
  id: string;
  code: string;
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  bgLight: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
};

const ALL_MODULES: ModuleCard[] = [
  {
    id: "mid",
    code: "MID",
    title: "Management Information Dashboard",
    description: "Analisis performa bisnis menyeluruh, profit perusahaan, dan laporan eksekutif.",
    path: "/dashboard", // Dihubungkan ke /dashboard sesuai permintaan
    icon: <BarChart3 className="w-7 h-7 text-[#3B6FF5]" />,
    bgLight: "#EFF6FF",
    borderColor: "#BFDBFE",
    accentColor: "#3B6FF5",
    textColor: "#1E40AF",
  },
  {
    id: "commercial",
    code: "Commercial",
    title: "Commercial Department",
    description: "Kelola data peluang penjualan, klien korporat, dan strategi sales perusahaan.",
    path: "/crm/dashboard",
    icon: <Briefcase className="w-7 h-7 text-[#10B981]" />,
    bgLight: "#E6F9F0",
    borderColor: "#BDF2D5",
    accentColor: "#10B981",
    textColor: "#065F46",
  },
  {
    id: "customer_success",
    code: "Customer Success",
    title: "Customer Success Department",
    description: "Kelola kepuasan pelanggan, retensi klien, dan penanganan layanan dukungan.",
    path: "/crm/dashboard",
    icon: <HeartHandshake className="w-7 h-7 text-[#0EA5E9]" />,
    bgLight: "#E0F2FE",
    borderColor: "#BAE6FD",
    accentColor: "#0EA5E9",
    textColor: "#0369A1",
  },
  {
    id: "hr",
    code: "Human Resources",
    title: "Human Capital & Management",
    description: "Pengelolaan data karyawan, absensi, struktur divisi, dan penggajian.",
    path: "/hrms/dashboard",
    icon: <UserCheck className="w-7 h-7 text-[#EF4444]" />,
    bgLight: "#FEF2F2",
    borderColor: "#FCA5A5",
    accentColor: "#EF4444",
    textColor: "#991B1B",
  },
  {
    id: "it",
    code: "IT",
    title: "Information Security Management",
    description: "Manajemen keamanan informasi, audit log aktivitas, dan keaktifan akun sistem.",
    path: "/smki/dashboard", // Diarahkan ke /smki/dashboard
    icon: <ShieldCheck className="w-7 h-7 text-[#A855F7]" />,
    bgLight: "#FAF5FF",
    borderColor: "#E9D5FF",
    accentColor: "#A855F7",
    textColor: "#6B21A8",
  },
  {
    id: "finance",
    code: "Finance",
    title: "Finance, Accounting & Tax",
    description: "Manajemen arus kas, laporan pajak perusahaan, billing, dan invoicing.",
    path: "/fat/dashboard",
    icon: <Wallet className="w-7 h-7 text-[#F97316]" />,
    bgLight: "#FFF7ED",
    borderColor: "#FFEDD5",
    accentColor: "#F97316",
    textColor: "#9A3412",
  },
];

export default function LandingPageHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{
    fullName: string;
    positionName: string;
    departmentId: string;
    positionId: string;
  } | null>(null);
  const [accessibleModules, setAccessibleModules] = useState<ModuleCard[]>([]);

  // Otomatis cek pergantian hari setiap beberapa detik
  useEffect(() => {
    const getLocalDateString = () => {
      const now = new Date();
      return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    };

    const initialDate = getLocalDateString();

    const interval = setInterval(() => {
      const currentDate = getLocalDateString();

      // Jika tanggal hari ini berbeda dengan saat pertama kali halaman dibuka
      if (currentDate !== initialDate) {
        clearInterval(interval);
        // Hapus sesi atau paksa keluar ke halaman login/landing page ulang
        supabase.auth.signOut();
        window.location.href = "/login";
      }
    }, 10000); // Cek setiap 10 detik

    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    // 1. Tambahkan event listener untuk hapus sesi pas ditutup
    const handleBeforeUnload = () => {
      supabase.auth.signOut();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const checkUserAccess = async () => {
       // ... kode pengecekan akses yang sudah ada ...
    };

    checkUserAccess();

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router]);

  useEffect(() => {
    const checkUserAccess = async () => {
     const urlParams = new URLSearchParams(window.location.search);
     const isFromDashboard = urlParams.get("from_dashboard") === "true";

      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !isFromDashboard) {
        router.replace("/login");
        return;
      }

      if (isFromDashboard) {
        sessionStorage.removeItem("return_to_hub");
      }

      let userId = session?.user?.id;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id;
      }

      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data: user, error } = await supabase
        .from("b2_register")
        .select("full_name, position_id, departement_id, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (error || !user || user.is_active === false) {
        alert("Sesi tidak valid atau akun dinonaktifkan.");
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const exactPositionName = UUID_POSITION_MAP[user.position_id] || "Employee";

      setUserData({
        fullName: user.full_name || "Karyawan",
        positionName: exactPositionName,
        departmentId: user.departement_id,
        positionId: user.position_id,
      });

      trackActivity('Login', `User ${user.full_name} (${exactPositionName}) berada di Landing Page.`);
      
      let allowed: ModuleCard[] = [];

      // 1. DIREKTUR: Melihat semua modul KECUALI IT
      if (user.position_id === DIRECTOR_POSITION_ID) {
        allowed = ALL_MODULES.filter((mod) => mod.id !== "it");
      } 
      // 2. KHUSUS IT/SMKI: Hanya boleh melihat modul IT dan HRMS
      else if (
        user.departement_id === "8113ab6f-d5cc-4c94-bbf6-e08047931fab" || 
        user.position_id === "265c9357-105c-437c-a244-6897122f17c1"
      ) {
        allowed = ALL_MODULES.filter((mod) => mod.id === "it" || mod.id === "hr");
      }
      // 3. SALES EXECUTIVE & MANAGER CUSTOMER SUCCESS: Bisa akses Commercial, Customer Success, & HRMS
      else if (
        user.position_id === "58706b7f-950b-4e71-b066-792fbd91424d" || // Sales Executive
        user.position_id === "48e90a83-86bd-4bd9-8b34-0fe7da11cc18"    // Manager of Customer Success
      ) {
        allowed = ALL_MODULES.filter((mod) => mod.id === "commercial" || mod.id === "customer_success" || mod.id === "hr");
      } 
      // 4. POSISI / DEPARTEMEN LAINNYA (Termasuk Field Agent yang sudah disesuaikan sebelumnya)
      else {
        allowed = ALL_MODULES.filter((mod) => {
          if (mod.id === "hr") return true; 
          
          // Field Agent: Hanya boleh akses Commercial (CRM), TIDAK boleh Customer Success (CCR)
          if (user.position_id === "2f1901c6-0617-45ba-852f-9556ed957f21") {
            return mod.id === "commercial" || mod.id === "hr";
          }
          
          // Finance, Accounting & Tax
          if (mod.id === "finance") {
            return user.departement_id === "1653db5f-2b64-418f-b28b-68cb7b9dae8e";
          }
          
          // Commercial & Customer Success umum untuk departemen Commercial
          if (mod.id === "commercial" || mod.id === "customer_success") {
            return user.departement_id === "97ac5d35-5da2-4f5d-9d36-78500f403cc7";
          }
          
          return false;
        });
      }

      setAccessibleModules(allowed);
      setLoading(false);
    };

    checkUserAccess();
}, [router]);
   

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#07111F] text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Memuat Landing Page ANDIMA...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col bg-[#07111F] text-slate-100 font-sans overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1600&auto=format&fit=crop"
          alt="Cargo Logistics Background"
          className="h-full w-full object-cover object-right opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07111F] via-[#07111F]/90 to-[#07111F]/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07111F]/80 via-transparent to-[#07111F]" />
      </div>

      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-white/10 bg-[#0f2038]/90 px-6 py-3.5 backdrop-blur-md lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-ANDIMA-wzx4gpZx20EFE5IYcH3jqabixELIo3.png"
              alt="Logo ANDIMA"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wider text-white">
              PT. ANDIMA TRANSPORTINDO
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-bold text-white">{userData?.fullName}</div>
            <div className="text-xs font-semibold text-blue-400">{userData?.positionName}</div>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#3B6FF5] to-[#18C7C0] text-sm font-extrabold text-white shadow-[0_0_15px_rgba(59,111,245,0.4)] border border-white/20 select-none">
            {getInitials(userData?.fullName)}
          </div>
        </div>
      </header>

      

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-6xl">
          <div className="mb-10 text-center sm:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-300 backdrop-blur-sm mb-3">
              <Building2 className="h-3.5 w-3.5" /> Enterprise Landing Page
            </span>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight">
              Selamat Datang, <span className="text-blue-400">{userData?.fullName}</span>
            </h2>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl font-medium">
              Pilih modul divisi di bawah ini untuk masuk ke dashboard operasional Anda. Hak akses modul disesuaikan dengan posisi jabatan dan departemen Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {accessibleModules.map((module) => (
              <div
                key={module.id}
                onClick={() => router.push(module.path)}
                style={{
                  backgroundColor: module.bgLight,
                  borderColor: module.borderColor,
                }}
                className="group relative flex flex-col justify-between rounded-2xl border p-6 shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 shadow-sm backdrop-blur-xs">
                      {module.icon}
                    </div>
                    <span 
                      style={{ color: module.textColor, backgroundColor: `${module.accentColor}20` }}
                      className="rounded-lg px-2.5 py-1 text-xs font-extrabold tracking-wider"
                    >
                      {module.code}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {module.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 font-medium">
                    {module.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-200/60 pt-4">
                  <span className="text-xs font-bold text-slate-700">Masuk Modul</span>
                  <div 
                    style={{ backgroundColor: module.accentColor }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {accessibleModules.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
              <p className="text-sm text-slate-300">
                Anda belum terhubung ke modul manapun. Silakan hubungi Administrator IT.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
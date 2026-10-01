"use client";

import { CircleAlert, CircleCheck, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Notice = { tone: "error" | "success"; text: string } | null;

export default function LoginPage() {
  const router = useRouter();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setNotice({ tone: "error", text: "Email dan password wajib diisi." });
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        setNotice({ tone: "error", text: "Email atau password tidak sesuai." });
        return;
      }

      const { data: access, error: accessError } = await supabase
        .from("d3_employee")
        .select("app_role")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if ((accessError || !access) && process.env.NODE_ENV === "production") {
        await supabase.auth.signOut();
        setNotice({ tone: "error", text: "Akun ini belum dipetakan ke akses HRMS D3. Hubungi HR Admin." });
        return;
      }

      const view = access?.app_role === "EMPLOYEE" ? "employee" : "manager";
      setNotice({ tone: "success", text: "Login berhasil. Mengarahkan ke workspace Anda..." });
      window.setTimeout(() => {
        router.replace(`/employee-report-ticket?view=${view}`);
        router.refresh();
      }, 700);
    } catch {
      setNotice({ tone: "error", text: "Koneksi login belum siap. Periksa .env.local lalu coba kembali." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#07111f] text-[#172033]">
      <Image
        src="/images/andima-login-warehouse.png"
        alt="Aktivitas gudang PT Andima Transportindo"
        fill
        priority
        className="-z-20 object-cover object-center opacity-65"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,17,31,0.96),rgba(7,17,31,0.81)_52%,rgba(7,17,31,0.28))]" />

      <section className="flex min-h-dvh w-full items-center px-5 py-10 sm:px-10 lg:px-20">
        <div className="w-full max-w-xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white/90 via-white/78 to-white/66 p-7 shadow-[0_20px_50px_rgba(7,17,31,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] backdrop-blur-2xl sm:p-11">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-b from-white/80 to-transparent blur-md" />

            <header className="relative z-10 mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b6ff5]">ANDIMA HRMS</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0d1b2a] sm:text-3xl">Selamat datang kembali</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">Masuk dengan akun yang sudah terdaftar untuk membuka workspace Anda.</p>
            </header>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-5" noValidate>
              <LoginField label="Email" icon={<Mail size={18} />}>
                <input name="email" type="email" autoComplete="email" placeholder="nama@email.com" disabled={isSubmitting} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
              </LoginField>

              <LoginField label="Password" icon={<LockKeyhole size={18} />}>
                <input name="password" type={isPasswordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan password" disabled={isSubmitting} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
                <button type="button" onClick={() => setIsPasswordVisible((visible) => !visible)} disabled={isSubmitting} className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-[#3b6ff5] disabled:cursor-not-allowed" aria-label={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}>
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </LoginField>

              {notice && <NoticeBanner notice={notice} />}

              <button type="submit" disabled={isSubmitting} className="mt-2 h-14 w-full rounded-xl bg-[#3b6ff5] px-5 text-sm font-extrabold tracking-wider text-white shadow-[0_8px_25px_rgba(59,111,245,0.4)] transition hover:bg-[#2b5ce5] focus:outline-none focus:ring-4 focus:ring-[#3b6ff5]/30 disabled:cursor-wait disabled:opacity-60">
                {isSubmitting ? "MEMERIKSA AKUN..." : "LOGIN"}
              </button>
            </form>

            <p className="relative z-10 mt-7 text-center text-sm font-medium text-slate-600">
              Belum punya akun?{" "}
              <Link href="/register" className="font-bold text-[#2b5ce5] underline-offset-4 hover:underline">Daftar</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0f172a]">{label}</span>
      <span className="flex h-14 items-center gap-3 rounded-xl border border-white/90 bg-white/75 px-4 text-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] transition focus-within:border-[#3b6ff5] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3b6ff5]/30">
        <span className="shrink-0 text-[#3b6ff5]" aria-hidden="true">{icon}</span>
        {children}
      </span>
    </label>
  );
}

function NoticeBanner({ notice }: { notice: Exclude<Notice, null> }) {
  const isSuccess = notice.tone === "success";
  return (
    <p role={isSuccess ? "status" : "alert"} className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm font-semibold ${isSuccess ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-red-500/30 bg-red-500/10 text-red-700"}`}>
      {isSuccess ? <CircleCheck size={19} className="mt-0.5 shrink-0" /> : <CircleAlert size={19} className="mt-0.5 shrink-0" />}
      <span>{notice.text}</span>
    </p>
  );
}

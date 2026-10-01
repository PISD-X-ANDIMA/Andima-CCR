"use client";

import { CircleAlert, CircleCheck, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Notice = { tone: "error" | "success"; text: string } | null;

export default function RegisterPage() {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const phone = String(formData.get("phone") ?? "").trim();

    if (fullName.length < 3) {
      setNotice({ tone: "error", text: "Nama lengkap minimal terdiri dari 3 karakter." });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setNotice({ tone: "error", text: "Masukkan alamat email yang valid." });
      return;
    }
    if (username.length < 3) {
      setNotice({ tone: "error", text: "Username minimal terdiri dari 3 karakter." });
      return;
    }
    if (password.length < 8) {
      setNotice({ tone: "error", text: "Password minimal terdiri dari 8 karakter." });
      return;
    }
    if (phone && !/^[0-9+()\-\s]{8,20}$/.test(phone)) {
      setNotice({ tone: "error", text: "Nomor telepon belum valid." });
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const emailRedirectTo = new URL("/auth/confirm?next=/login", window.location.origin).toString();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: { full_name: fullName, username, phone_number: phone || null },
        },
      });

      if (error) {
        const message = error.code === "email_address_invalid"
          ? "Alamat email ditolak. Pastikan tidak ada spasi atau karakter tambahan."
          : error.code === "over_email_send_rate_limit"
            ? "Terlalu banyak permintaan email konfirmasi. Tunggu beberapa saat sebelum mencoba lagi."
            : error.code === "user_already_exists"
              ? "Email ini sudah terdaftar. Gunakan halaman Login."
              : "Pendaftaran belum berhasil. Periksa data lalu coba kembali.";
        setNotice({ tone: "error", text: message });
        return;
      }

      if (!data.user || data.user.identities?.length === 0) {
        setNotice({ tone: "error", text: "Email ini sudah terdaftar. Gunakan halaman Login." });
        return;
      }

      if (data.session) {
        await supabase.auth.signOut();
        setNotice({ tone: "success", text: "Pendaftaran berhasil. Akun sudah aktif; silakan masuk melalui halaman Login." });
      } else {
        setNotice({ tone: "success", text: "Pendaftaran berhasil. Periksa email untuk konfirmasi akun, lalu login. HR Admin kemudian perlu memetakan role D3 Anda." });
      }
      form.reset();
    } catch {
      setNotice({ tone: "error", text: "Koneksi pendaftaran belum siap. Periksa .env.local lalu coba kembali." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative isolate min-h-dvh overflow-y-auto bg-[#07111f] text-[#172033]">
      <Image src="/images/andima-register-warehouse.png" alt="Area operasional PT Andima Transportindo" fill priority className="-z-20 object-cover object-center opacity-65" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,17,31,0.96),rgba(7,17,31,0.81)_52%,rgba(7,17,31,0.28))]" />

      <section className="flex min-h-dvh w-full items-center px-5 py-10 sm:px-10 lg:px-20">
        <div className="w-full max-w-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-b from-white/90 via-white/78 to-white/66 p-7 shadow-[0_20px_50px_rgba(7,17,31,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] backdrop-blur-2xl sm:p-10">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-b from-white/80 to-transparent blur-md" />

            <header className="relative z-10 mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b6ff5]">ANDIMA HRMS</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0d1b2a] sm:text-3xl">Daftarkan akun</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">Buat akun terlebih dahulu. Akses fitur aktif setelah HR Admin menetapkan role D3.</p>
            </header>

            <form onSubmit={handleSubmit} noValidate className="relative z-10 grid gap-4 sm:grid-cols-2">
              <RegisterField label="Nama lengkap" icon={<UserRound size={18} />} name="fullName" autoComplete="name" placeholder="Masukkan nama lengkap" disabled={isSubmitting} />
              <RegisterField label="Email" icon={<Mail size={18} />} name="email" type="email" autoComplete="email" placeholder="nama@email.com" disabled={isSubmitting} />
              <RegisterField label="Username" icon={<UserRound size={18} />} name="username" autoComplete="username" placeholder="Username untuk profil" disabled={isSubmitting} />
              <RegisterField label="Nomor telepon" icon={<Phone size={18} />} name="phone" type="tel" autoComplete="tel" placeholder="Contoh: 0812xxxx" disabled={isSubmitting} />
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0f172a]">Password</span>
                  <span className="flex h-14 items-center gap-3 rounded-xl border border-white/90 bg-white/75 px-4 text-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] transition focus-within:border-[#3b6ff5] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3b6ff5]/30">
                    <LockKeyhole size={18} className="shrink-0 text-[#3b6ff5]" aria-hidden="true" />
                    <input name="password" type={isPasswordVisible ? "text" : "password"} autoComplete="new-password" placeholder="Minimal 8 karakter" disabled={isSubmitting} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
                    <button type="button" onClick={() => setIsPasswordVisible((visible) => !visible)} disabled={isSubmitting} className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-[#3b6ff5] disabled:cursor-not-allowed" aria-label={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}>
                      {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              </div>

              {notice && <div className="sm:col-span-2"><NoticeBanner notice={notice} /></div>}

              <button type="submit" disabled={isSubmitting} className="mt-2 h-14 w-full rounded-xl bg-[#3b6ff5] px-5 text-sm font-extrabold tracking-wider text-white shadow-[0_8px_25px_rgba(59,111,245,0.4)] transition hover:bg-[#2b5ce5] focus:outline-none focus:ring-4 focus:ring-[#3b6ff5]/30 disabled:cursor-wait disabled:opacity-60 sm:col-span-2">
                {isSubmitting ? "MEMBUAT AKUN..." : "REGISTER"}
              </button>
            </form>

            <p className="relative z-10 mt-7 text-center text-sm font-medium text-slate-600">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-bold text-[#2b5ce5] underline-offset-4 hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function RegisterField({ label, icon, name, type = "text", autoComplete, placeholder, disabled }: { label: string; icon: React.ReactNode; name: string; type?: string; autoComplete: string; placeholder: string; disabled: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0f172a]">{label}</span>
      <span className="flex h-14 items-center gap-3 rounded-xl border border-white/90 bg-white/75 px-4 text-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] transition focus-within:border-[#3b6ff5] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3b6ff5]/30">
        <span className="shrink-0 text-[#3b6ff5]" aria-hidden="true">{icon}</span>
        <input name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} disabled={disabled} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
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
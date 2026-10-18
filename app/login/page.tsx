'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getLoginDestination } from '@/lib/loginDestination';
import { recordLogin } from '@/query/tracklog';
import { trackActivity } from '@/query/activity';


function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [greeting, setGreeting] = useState<string>('Good Morning'); 
  const [showPopup, setShowPopup] = useState<boolean>(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'unauthorized') {
      setShowPopup(true);
      
      // Otomatis tutup pop-up setelah 5 detik (opsional)
      const timer = setTimeout(() => {
        setShowPopup(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 3 && hour < 12) setGreeting('Good Morning');
    else if (hour >= 12 && hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'day_changed') {
      alert('Hari telah berganti. Sesi Anda telah berakhir, silakan login kembali.');
    }
  }, [searchParams]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isLocked && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0 && isLocked && !isPermanentlyBlocked) {
      setIsLocked(false);
      setErrorMessage('');
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLocked, countdown, isPermanentlyBlocked]);

  const validateEmailFormat = (emailVal: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailVal);
  };

  const validatePasswordStrength = (passVal: string): boolean => {
    const hasLetter = /[a-zA-Z]/.test(passVal);
    const hasDigit = /\d/.test(passVal);
    const hasSpecial = /[^a-zA-Z0-9]/.test(passVal);
    return passVal.length >= 8 && hasLetter && hasDigit && hasSpecial;
  };

  const handleFailedAttempt = (customMessage: string) => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= 5) {
      setIsLocked(true);
      setIsPermanentlyBlocked(true);
      setErrorMessage('Your account has been blocked. Please contact the IT administrator.');
    } else if (newAttempts === 4) {
      setErrorMessage(
        `${customMessage} Warning: 1 more failed attempt will block your account!`
      );
    } else if (newAttempts === 3) {
      setIsLocked(true);
      setCountdown(30);
      setErrorMessage(
        'Too many failed login attempts (3/5). Please wait 30 seconds before trying again.'
      );
    } else {
      setErrorMessage(`${customMessage} (Remaining attempts: ${5 - newAttempts})`);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isLocked || isPermanentlyBlocked) return;

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and Password are required.');
      return;
    }

    if (!validateEmailFormat(email)) {
      setErrorMessage('Invalid email format (example: name@andima.co.id).');
      return;
    }

    if (!validatePasswordStrength(password)) {
      setErrorMessage(
        'Password must be at least 10 characters long and contain a mix of letters, numbers, and special characters.'
      );
      return;
    }

    // Authenticate first, then route using the position stored in the profile.
    setIsSigningIn(true);
    try {
      // 1. Autentikasi dengan Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) {
        const message = authError.message.toLowerCase().includes('email not confirmed')
          ? 'Email belum dikonfirmasi. Selesaikan konfirmasi melalui email terlebih dahulu.'
          : 'Email atau password salah.';
        handleFailedAttempt(message);
        return;
      }

      // 2. Ambil Profil User dari b2_register
      const { data: profileData, error: profileError } = await supabase
        .from('b2_register')
        .select('position_id, full_name, is_active')
        .eq('id', authData.user.id)
        .maybeSingle();

      // Jika ada error dari Supabase (misal masalah RLS / query)
      if (profileError) {
        console.error('Error Database Supabase:', profileError.message);
        setErrorMessage('Gagal mengambil data profil dari server.');
        return;
      }

      // Jika query sukses tapi datanya tidak ditemukan di tabel b2_register
      if (!profileData) {
        setErrorMessage('Email Anda terautentikasi, namun data profil belum terdaftar di database.');
        return;
      }

      // 3. Cek apakah akun dinonaktifkan oleh Admin
      if (profileData.is_active === false) {
        setErrorMessage('Akun Anda telah dinonaktifkan. Silakan hubungi IT / HR Admin.');
        return;
      }

      const targetRoute = getLoginDestination(profileData.position_id);

      try {
        await recordLogin();
      } catch (logError) {
        console.error('Gagal mencatat riwayat login:', logError);
        setErrorMessage('Login berhasil, tetapi riwayat login tidak berhasil disimpan.');
      }

      setLoginAttempts(0);
      trackActivity('Login', 'Berhasil login ke aplikasi.');
      setSuccessMessage(`Login berhasil! Selamat datang, ${profileData.full_name || 'User'}. Mengalihkan...`);

      // Mengarahkan langsung ke landing page modular setelah login berhasil
      window.setTimeout(() => {
        router.replace('/landing-page');
      }, 1200);

    } catch (err) {
      setErrorMessage('Tidak dapat menghubungi server login. Silakan coba lagi.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#07111F] text-[#0D1B2A] selection:bg-[#3B6FF5] selection:text-white font-[family-name:var(--font-inter)]">

      {/* POP-UP NOTIFIKASI DI TENGAH ATAS LAYAR */}
      {showPopup && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#D9364F]/95 backdrop-blur-md text-white px-6 py-4.5 rounded-2xl shadow-[0_20px_50px_rgba(217,54,79,0.5)] border border-[#D9364F]/60 transition-all max-w-md w-[90%] sm:w-auto">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-xs tracking-wide uppercase font-[family-name:var(--font-poppins)]">Akses Ditolak</h4>
            <p className="text-xs text-rose-100 font-medium mt-0.5">Silakan login terlebih dahulu untuk mengakses Dashboard.</p>
          </div>
          <button 
            type="button"
            onClick={() => setShowPopup(false)}
            className="ml-2 text-rose-200 hover:text-white font-bold text-base transition-colors"
          >
          </button>
        </div>
      )}

      {/* 1. BACKGROUND GAMBAR LOGISTIK FULL SCREEN */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1600&auto=format&fit=crop"
          alt="Cargo Ship Logistics"
          className="w-full h-full object-cover object-right opacity-60"
        />
        {/* Soft Blending Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1B2A] via-[#0D1B2A]/85 via-40% to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Ambient Light Glows */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#18C7C0]/30 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-[#3B6FF5]/30 rounded-full blur-3xl pointer-events-none z-0" />

      {/* 2. BRAND TEXT (TITLE) MENGGUNAKAN FONT SYNE */}
      <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-8 lg:right-16 xl:right-24 z-20 pointer-events-none flex-col items-end text-right max-w-lg">
        
        {/* Logo ANDIMA di Luar Frame */}
        <div className="w-32 sm:w-40 lg:w-48 mb-4">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-ANDIMA-wzx4gpZx20EFE5IYcH3jqabixELIo3.png"
            alt="Logo ANDIMA"
            width={400}
            height={246}
            className="w-full h-auto object-contain drop-shadow-lg"
          />
        </div>
        {/* Frame Transparan dengan Warna #0F2342 */}
          <h1 className="font-[family-name:var(--font-poppins)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-md leading-tight">
            PT. ANDIMA<br />
            <span className="font-[family-name:var(--font-poppins)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-md leading-tight">
              TRANSPORTINDO
            </span>
          </h1>
      </div>

      {/* 3. FORM LOGIN CONTAINER */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-start px-6 py-8 sm:px-12 lg:px-20">
        <div className="w-full max-w-xl">

          {/* FRAME LIQUID GLASS */}
           <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-white/85 via-white/70 to-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_20px_50px_rgba(7,17,31,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] relative overflow-y-auto max-h-[92vh] [scrollbar-width:none]">
            
            {/* Top Liquid Highlight Specular Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-white/80 to-transparent blur-md pointer-events-none rounded-full" />

            {/* Greeting */}
            <div className="mb-7 text-left relative z-10">
              <h2 className="font-[family-name:var(--font-poppins)] text-xl sm:text-2xl font-bold text-[#0D1B2A] tracking-tight">
                {greeting},
              </h2>
              <p className="font-[family-name:var(--font-poppins)] text-sm text-[#334155] mt-1.5 font-medium">
                Please sign in with your registered account to access the dashboard.
              </p>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-6 font-[family-name:var(--font-inter)] relative z-10" noValidate>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="name@andima.co.id"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  disabled={isLocked || isPermanentlyBlocked}
                  className="w-full px-4.5 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    disabled={isLocked || isPermanentlyBlocked}
                    className="w-full pl-4.5 pr-12 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                  />

                  <button
                    type="button"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    disabled={isLocked || isPermanentlyBlocked}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#3B6FF5] p-1 transition-colors disabled:opacity-50"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908A8.982 8.982 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-4 rounded-xl bg-[#059669]/10 border border-[#059669]/30 text-[#059669] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Tombol Login */}
              <button
                type="submit"
                disabled={isLocked || isPermanentlyBlocked || isSigningIn}
                className="w-full py-4 px-5 text-white font-extrabold rounded-xl text-sm tracking-wider uppercase transition-all mt-2 disabled:opacity-50 bg-[#3B6FF5] hover:bg-[#2B5CE5] shadow-[0_8px_25px_rgba(59,111,245,0.4)] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed font-[family-name:var(--font-poppins)]"
              >
                {isPermanentlyBlocked
                  ? 'ACCOUNT BLOCKED'
                  : isLocked
                  ? `Please wait ${countdown}s`
                  : isSigningIn ? 'SIGNING IN…' : 'LOGIN'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111F]" />}>
      <LoginContent />
    </Suspense>
  );
}
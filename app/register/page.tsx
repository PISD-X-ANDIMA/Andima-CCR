'use client';

import React, { useState, useRef, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  employmentStatus?: string;
  positionId?: string;
  departementId?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>('');
  const [employmentStatus, setEmploymentStatus] = useState<string>('');
  const [positionId, setPositionId] = useState<string>('');
  const [departementId, setDepartementId] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const submitting = useRef(false);

  // States Error UI
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const VALID_POSITION_DEPARTMENTS: Record<string, string> = {
    '40a8e1f1-0713-4e5d-a7af-061b6e5f495c': 'd38c1ed7-abd4-4a57-ab9d-0ba1d396fbfc', // Freight Forwarding Specialist -> Logistics
    '96c66ea1-44b6-474f-9410-ad992dd14b93': '72cd470d-216c-48b6-abd9-0cd05a4d8974', // HR Administrator -> Human Resources
    '265c9357-105c-437c-a244-6897122f17c1': '8113ab6f-d5cc-4c94-bbf6-e08047931fab', // Information Technology -> IT
    '10da1bac-a6a8-472e-a171-e4984ab768d9': '1653db5f-2b64-418f-b28b-68cb7b9dae8e', // Accounting Associate -> Finance, Accounting & Tax
    '58706b7f-950b-4e71-b066-792fbd91424d': '97ac5d35-5da2-4f5d-9d36-78500f403cc7', // Sales Executive -> Commercial
  };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (submitting.current || successMessage) return;

      setFieldErrors({});
      setGeneralError('');
      setSuccessMessage('');

      const errors: FieldErrors = {};

      // Validasi Full Name
      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!fullName.trim()) {
        errors.fullName = 'Full name is required.';
      } else if (!nameRegex.test(fullName.trim())) {
        errors.fullName = 'Full name must contain letters and spaces only.';
      }

      // Validasi Email
      const emailLower = email.trim().toLowerCase();
      if (!email.trim()) {
        errors.email = 'Email address is required.';
      } else if (!/^[^\s@]+@andima\.co\.id$/.test(emailLower)) {
        errors.email = 'Email address must use the domain @andima.co.id';
      }

      // Validasi Password
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar =
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      if (!password) {
        errors.password = 'Password is required.';
      } else if (password.length < 10) {
        errors.password = 'Password must be at least 10 characters long.';
      } else if (!hasLetter || !hasNumber || !hasSpecialChar) {
        errors.password =
          'Password must include letters, numbers, and special characters.';
      }

      // Validasi Phone
      const phoneDigitsOnly = /^\d+$/;
      if (!phone.trim()) {
        errors.phone = 'Phone number is required.';
      } else if (!phoneDigitsOnly.test(phone.trim())) {
        errors.phone = 'Phone number must contain numbers only.';
      } else if (phone.trim().length > 12) {
        errors.phone = 'Phone number cannot exceed 12 digits.';
      }

      // Validasi Employment Status
      if (!employmentStatus) {
        errors.employmentStatus = 'Please select employment status.';
      }

      // Validasi Position
      if (!positionId) {
        errors.positionId = 'Please select a position.';
      }

      // Validasi Department
      if (!departementId) {
        errors.departementId = 'Please select a department.';
      }

      // --- VALIDASI RELEVANSI POSISI & DEPARTEMEN ---
      const DIRECTOR_POSITION_ID = '0ec333af-8737-413f-adab-841a3067e485';

      if (positionId && departementId && positionId !== DIRECTOR_POSITION_ID) {
        const expectedDepartmentId = VALID_POSITION_DEPARTMENTS[positionId];
        if (expectedDepartmentId && expectedDepartmentId !== departementId) {
          errors.positionId = 'Selected position does not match the department.';
          errors.departementId = 'Selected department does not match the position.';
        }
      }

      // Kalau validasi gagal
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setGeneralError('Please fix the errors below before submitting.');
        return;
      }

      submitting.current = true;
      setIsLoading(true);

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName, email: emailLower, password, phone, employment_status: employmentStatus, position_id: positionId, department_id: departementId }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? 'Registration failed.');
        setSuccessMessage(`Registration successful! Your ID is ${body.data.employee_id}.${body.data.confirmation_required ? ' Silakan konfirmasi email sebelum login.' : ''} Redirecting to login page...`);

        setTimeout(() => {
          router.replace('/login');
        }, 1500);

      } catch (err: unknown) {
        setGeneralError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menyimpan. Silakan coba lagi.'
        );
      } finally {
        submitting.current = false;
        setIsLoading(false);
      }
    };
  return (
    <main className="relative h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#07111F] text-[#172033] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* CONTAINER FORM REGISTRASI */}
      <div className="w-full min-h-full lg:w-1/2 min-w-0 flex flex-col justify-center p-4 sm:p-8 lg:p-10 relative z-10">
        <div className="w-full max-w-2xl shrink-0 mx-auto p-6 sm:p-9 rounded-3xl bg-gradient-to-b from-white/85 via-white/70 to-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_20px_50px_rgba(7,17,31,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] relative overflow-hidden">

          {/* Header */}
          <div className="mb-5 sm:mb-6 relative z-10">
            <span className="text-xs sm:text-sm text-[#172033] uppercase tracking-widest block mb-1 font-bold">
              Register Account
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wide text-[#172033] uppercase leading-tight">
              PT ANDIMA TRANSPORTINDO
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3.5 sm:space-y-4 w-full relative z-10">

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                className={`w-full px-4 py-3 rounded-2xl bg-white/90 text-[#172033] placeholder-[#172033]/50 text-sm focus:outline-none border shadow-sm transition-all ${
                  fieldErrors.fullName ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                }`}
              />
              {fieldErrors.fullName && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.fullName}</p>}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                Email Address
              </label>
              <input
                type="text"
                placeholder="username@andima.co.id"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`w-full px-4 py-3 rounded-2xl bg-white/90 text-[#172033] placeholder-[#172033]/50 text-sm focus:outline-none border shadow-sm transition-all ${
                  fieldErrors.email ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                }`}
              />
              {fieldErrors.email && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                Password
              </label>
              <div className="relative w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 10 chars (letters, numbers, symbols)"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`w-full pl-4 pr-12 py-3 rounded-2xl bg-white/90 text-[#172033] placeholder-[#172033]/50 text-sm focus:outline-none border shadow-sm transition-all ${
                    fieldErrors.password ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                  }`}
                />
                <button
                  type="button"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={() => setShowPassword(true)}
                  onTouchEnd={() => setShowPassword(false)}
                  tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#172033]/60 hover:text-[#172033] p-1 transition-colors focus:outline-none select-none cursor-pointer"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#172033]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.573 16.49 16.638 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#172033]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.password}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="Max. 12 digits (e.g. 08123456789)"
                value={phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                className={`w-full px-4 py-3 rounded-2xl bg-white/90 text-[#172033] placeholder-[#172033]/50 text-sm focus:outline-none border shadow-sm transition-all ${
                  fieldErrors.phone ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                }`}
              />
              {fieldErrors.phone && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.phone}</p>}
            </div>

            {/* Employment Status */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                Employment Status
              </label>
              <select
                value={employmentStatus}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setEmploymentStatus(e.target.value);
                  if (fieldErrors.employmentStatus) setFieldErrors((prev) => ({ ...prev, employmentStatus: undefined }));
                }}
                className={`w-full px-4 py-3 rounded-2xl bg-white/90 text-[#172033] text-sm focus:outline-none border shadow-sm transition-all ${
                  fieldErrors.employmentStatus ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                }`}
              >
                <option value="">Select Status</option>
                <option value="probation">Probation</option>
                <option value="permanent">Permanent</option>
              </select>
              {fieldErrors.employmentStatus && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.employmentStatus}</p>}
            </div>

            {/* Grid Position & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Position */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  Position
                </label>
                <select
                  value={positionId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setPositionId(e.target.value);
                    if (fieldErrors.positionId) setFieldErrors((prev) => ({ ...prev, positionId: undefined }));
                  }}
                  className={`w-full px-4 py-3 rounded-2xl bg-white/90 text-[#172033] text-sm focus:outline-none border shadow-sm transition-all ${
                    fieldErrors.positionId ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                  }`}
                >
                  <option value="">Select Position</option>
                  {/* GANTI DENGAN UUID ASLI DARI TABEL POSISI KAMU */}
                  <option value="40a8e1f1-0713-4e5d-a7af-061b6e5f495c">Freight Forwarding Specialist</option>
                  <option value="96c66ea1-44b6-474f-9410-ad992dd14b93">HR Administrator</option>
                  <option value="265c9357-105c-437c-a244-6897122f17c1">Information Technology</option>
                  <option value="0ec333af-8737-413f-adab-841a3067e485">Director</option>
                  <option value="10da1bac-a6a8-472e-a171-e4984ab768d9">Accounting Associate</option>
                  <option value="58706b7f-950b-4e71-b066-792fbd91424d">Sales Executive </option>
                </select>
                {fieldErrors.positionId && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.positionId}</p>}
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  Department
                </label>
                <select
                  value={departementId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setDepartementId(e.target.value);
                    if (fieldErrors.departementId) setFieldErrors((prev) => ({ ...prev, departementId: undefined }));
                  }}
                  className={`w-full px-4 py-3 rounded-2xl bg-white/90 text-[#172033] text-sm focus:outline-none border shadow-sm transition-all ${
                    fieldErrors.departementId ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' : 'border-[#172033]/15 focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30'
                  }`}
                >
                  <option value="">Select Department</option>
                  {/* GANTI DENGAN UUID ASLI DARI TABEL DEPARTEMEN KAMU */}
                  <option value="72cd470d-216c-48b6-abd9-0cd05a4d8974">Human Resources</option>
                  <option value="d38c1ed7-abd4-4a57-ab9d-0ba1d396fbfc">Logistics & Shipment Operations</option>
                  <option value="8113ab6f-d5cc-4c94-bbf6-e08047931fab">Information Technology</option>
                  <option value="1653db5f-2b64-418f-b28b-68cb7b9dae8e">Finance, Accounting & Tax</option>
                  <option value="97ac5d35-5da2-4f5d-9d36-78500f403cc7">Commercial & Customer Success</option>
                </select>
                {fieldErrors.departementId && <p className="text-red-600 text-xs font-semibold mt-1 ml-1">{fieldErrors.departementId}</p>}
              </div>
            </div>

            {/* Error / Success Banner */}
            {generalError && (
              <div role="alert" className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs sm:text-sm font-semibold">
                {generalError}
              </div>
            )}

            {successMessage && (
              <div role="status" className="p-3 rounded-2xl bg-[#16A37A]/15 border border-[#16A37A]/30 text-[#16A37A] text-xs sm:text-sm font-semibold">
                {successMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || Boolean(successMessage)}
              className={`w-full py-3.5 px-6 text-[#172033] font-extrabold rounded-2xl text-sm sm:text-base tracking-wider uppercase transition-all mt-4 shadow-[0_6px_24px_rgba(59,111,245,0.4)] ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed opacity-70'
                  : 'bg-[#3B6FF5] hover:bg-[#2B5CE5] active:scale-[0.99] cursor-pointer'
              }`}
            >
              {successMessage ? 'Tersimpan' : isLoading ? 'Processing...' : 'Register'}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center text-xs sm:text-sm text-[#172033] pt-4 relative z-15 font-medium">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-bold text-[#172033] hover:opacity-80 underline transition-opacity"
            >
              Login
            </Link>
          </div>
        </div>
      </div>

      {/* BACKGROUND IMAGE LOGISTICS */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1600&auto=format&fit=crop"
          alt="Cargo Ship Logistics"
          className="w-full h-full object-cover object-right opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1B2A] via-[#0D1B2A]/85 via-40% to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent pointer-events-none" />
      </div>
    </main>
  );
}

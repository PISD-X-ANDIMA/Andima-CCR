"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, accountRole } from "@/components/account-provider";
import {
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

type SidebarProps = {
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
};

function HrmsLink({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex w-full items-center rounded-md px-3 py-2 text-xs transition-colors ${
        isActive ? "bg-[#B0C6D4] text-[#0f2324]" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Sidebar({ userName, userRole, userInitials, onSignOut, isSigningOut = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCcrOpen, setIsCcrOpen] = useState(true);
  const [isInternalSigningOut, setIsInternalSigningOut] = useState(false);
  const { account: loaded, clearAccount } = useAccount();
  const account = { name: userName ?? loaded?.full_name ?? "Andima User", role: userRole ?? accountRole(loaded?.app_role, "CCR User"), initials: userInitials ?? loaded?.initials ?? "AU" };
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
      return;
    }
    setIsInternalSigningOut(true);
    try {
      setSignOutError(null);
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout gagal. Silakan coba lagi.");
      clearAccount();
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Logout gagal. Silakan coba lagi.");
    } finally {
      setIsInternalSigningOut(false);
    }
  }

  if (isPublicRoute) return null;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f2342] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="size-9 shrink-0"><Image src="/images/Logo ANDIMA.png" alt="Logo ANDIMA" width={36} height={36} className="h-9 w-9 object-contain" /></div>
          <div><p className="text-xl font-bold tracking-[-0.5px] text-white">ANDIMA</p><p className="text-xs text-[#d9e2fc]/80">Logistics Suite</p></div>
          <button type="button" onClick={() => setIsSidebarOpen(false)} className="ml-auto rounded p-1 text-[#d9e2fc] lg:hidden" aria-label="Tutup navigasi"><X size={18} /></button>
        </div>

        <nav className="mt-8 space-y-1.5 text-sm font-semibold">
          <div>
            <button
              type="button"
              onClick={() => setIsCcrOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg bg-[#155cfd] px-3 py-2.5 text-white shadow-sm"
            >
              <span className="flex items-center gap-3">CCR</span>
              <ChevronDown size={16} className={`transition-transform ${isCcrOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            {isCcrOpen && (
              <div className="ml-5 mt-2 border-l border-[#d9e2fc]/20 pl-3">
                <div className="mt-1 space-y-1">
                  <HrmsLink label="Sales Overview" href="/sales-overview" />
                  <HrmsLink label="Customer Analytics" href="/customer-analytics" />
                  <HrmsLink label="Overdue Alert" href="/overdue-alert" />
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="mt-auto space-y-3">
          {signOutError && <p role="alert" className="text-xs text-red-400">{signOutError}</p>}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            {/* <span className="grid size-7 place-items-center rounded-full bg-[#16834b] text-[10px] font-bold text-white">{account.initials}</span> */}
            {/* <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{account.name}</p><p className="text-[10px] text-[#d9e2fc]/75">{account.role}</p></div> */}
            <button
              type="button"
              data-account-role={account.role}
              onClick={() => void handleSignOut()}
              disabled={isSigningOut || isInternalSigningOut}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-red-600 px-3 py-1.5 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
              aria-label="Logout"
              title="Logout"
            >
              {/* <LogOut size={16} /> */}
              <span className="text-sm font-bold text-align-center">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-lg bg-[#0f2342] p-2 text-white lg:hidden"
        aria-label="Buka navigasi"
      >
        <Menu size={20} />
      </button>
    </>
  );
}

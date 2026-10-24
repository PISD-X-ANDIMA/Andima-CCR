"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
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
  const isC1Route = ["/sales-overview", "/uploaded-documents", "/customer-analytics", "/overdue-alert"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isC2Route = ["/dashboard", "/cost-exception", "/priority-exception", "/customer-cost", "/evidence", "/monthly-closing", "/export-report"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const [isCcrOpen, setIsCcrOpen] = useState(true);
  const [isC1Open, setIsC1Open] = useState(isC1Route);
  const [isC2Open, setIsC2Open] = useState(isC2Route);
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
      if (!response.ok) throw new Error("Logout failed. Please try again.");
      clearAccount();
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Logout failed. Please try again.");
    } finally {
      setIsInternalSigningOut(false);
    }
  }

  if (isPublicRoute) return null;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#203d70] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="size-9 shrink-0"><Image src="/images/Logo ANDIMA.png" alt="Logo ANDIMA" width={36} height={36} className="h-9 w-9 object-contain" /></div>
          <div><p className="text-xl font-bold tracking-[-0.5px] text-white font-heading">ANDIMA</p><p className="text-xs text-[#d9e2fc]/80 font-heading">Logistics Suite</p></div>
          <button type="button" onClick={() => setIsSidebarOpen(false)} className="ml-auto rounded p-1 text-[#d9e2fc] lg:hidden cursor-pointer" aria-label="Close navigation"><X size={18} /></button>
        </div>

        <nav className="mt-8 space-y-1.5 text-sm font-semibold">
          <div>
            <button
              type="button"
              onClick={() => setIsCcrOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg bg-[#155cfd] px-3 py-2.5 text-white shadow-sm font-heading cursor-pointer"
            >
              <span className="flex items-center gap-3">CCR</span>
              <ChevronDown size={16} className={`transition-transform ${isCcrOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            {isCcrOpen && (
              <div className="ml-5 mt-2 border-l border-[#d9e2fc]/20 pl-3">
                <SidebarGroup label="C1" open={isC1Open} active={isC1Route} onToggle={() => setIsC1Open((value) => !value)}>
                  <HrmsLink label="Sales Overview" href="/sales-overview" />
                  <HrmsLink label="Uploaded Documents" href="/uploaded-documents" />
                  <HrmsLink label="Customer Analytics" href="/customer-analytics" />
                  <HrmsLink label="Overdue Alert" href="/overdue-alert" />
                </SidebarGroup>
                <SidebarGroup label="C2" open={isC2Open} active={isC2Route} onToggle={() => setIsC2Open((value) => !value)}>
                  <HrmsLink label="Dashboard" href="/dashboard" />
                  <HrmsLink label="Cost Exception" href="/cost-exception" />
                  <HrmsLink label="Priority Exception" href="/priority-exception" />
                  <HrmsLink label="Customer Cost" href="/customer-cost" />
                  <HrmsLink label="Evidence" href="/evidence" />
                  <HrmsLink label="Monthly Closing" href="/monthly-closing" />
                  <HrmsLink label="Export Report" href="/export-report" />
                </SidebarGroup>
              </div>
            )}
          </div>
        </nav>

        <div className="mt-auto space-y-3">
          {signOutError && <p role="alert" className="text-xs text-red-400">{signOutError}</p>}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <button
              type="button"
              data-account-role={account.role}
              onClick={() => void handleSignOut()}
              disabled={isSigningOut || isInternalSigningOut}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-red-600 px-3 py-1.5 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50 cursor-pointer font-heading font-bold"
              aria-label="Logout"
              title="Logout"
            >
              <span className="text-sm font-bold text-align-center">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-lg bg-[#203d70] p-2 text-white lg:hidden cursor-pointer"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
    </>
  );
}

function SidebarGroup({ label, open, active, onToggle, children }: { label: string; open: boolean; active: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="mt-1">
      <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${active ? "text-white" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"}`} aria-expanded={open}>
        <span>{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}

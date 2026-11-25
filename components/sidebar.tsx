"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, accountRole } from "@/components/account-provider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSidebar } from "@/components/sidebar-context";
import { ChevronDown, X } from "lucide-react";

type SidebarProps = {
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
};

function CcrNavLink({
  label,
  href,
  onNavigate,
}: {
  label: string;
  href: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`w-full rounded-[8px] px-3.5 py-2 flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
        isActive
          ? "bg-[#B0C6D4] hover:bg-[#A3BCCB] text-[#45556C]"
          : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
      }`}
    >
      <span
        className={`w-[6px] h-[6px] rounded-full shrink-0 ${
          isActive ? "bg-[#14B8A6]" : "bg-transparent"
        }`}
      />
      <span
        className={`text-[13px] leading-snug tracking-[-0.01em] ${
          isActive ? "font-semibold text-[#45556C]" : "font-medium"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar({
  userName,
  userRole,
  userInitials,
  onSignOut,
  isSigningOut = false,
}: SidebarProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute =
    pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");
  const { isCollapsed, isMobileOpen, closeMobileSidebar, requestLogout } = useSidebar();
  const [isCcrOpen, setIsCcrOpen] = useState(true);
  const [isInternalSigningOut, setIsInternalSigningOut] = useState(false);
  const { account: loaded, clearAccount } = useAccount();
  const account = {
    name: userName ?? loaded?.full_name ?? "Andima User",
    role: userRole ?? accountRole(loaded?.app_role, "CCR User"),
    initials: userInitials ?? loaded?.initials ?? "AU",
  };
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
    <aside
      id="sidebar"
      aria-label="Primary Sidebar Navigation"
      className={`fixed inset-y-0 left-0 z-40 bg-[#0F2342] flex flex-col justify-between select-none transition-all duration-250 ease-out ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 ${
        isCollapsed
          ? "md:w-0 md:p-0 md:overflow-hidden md:opacity-0 pointer-events-none"
          : "w-[250px] p-4 md:opacity-100"
      }`}
    >
      {/* Top Section: Brand Header & Navigation */}
      <div className="w-full min-w-[218px]">
        {/* Brand Header: AST Vector Emblem + Title */}
        <div className="pt-1.5 pb-6 px-1.5 flex items-center justify-between gap-3">
          <Link href="/sales-overview" className="flex items-center gap-3 group">
            {/* Official ANDIMA Logo Image */}
            <div className="shrink-0 size-9 flex items-center justify-center">
              <Image
                src="/images/Logo ANDIMA.png"
                alt="Logo ANDIMA"
                width={38}
                height={38}
                className="h-9 w-9 object-contain"
                priority
              />
            </div>

            {/* Stacked Brand Title */}
            <div className="flex flex-col">
              <span className="text-[#FFFFFF] text-[19px] font-extrabold tracking-tight leading-none">
                ANDIMA
              </span>
              <span className="text-[#8FA3BF] text-[12px] font-normal leading-tight mt-1">
                Logistics Suite
              </span>
            </div>
          </Link>

          {/* Burger collapse button on mobile */}
          <button
            id="mobileSidebarCollapseBtn"
            type="button"
            onClick={closeMobileSidebar}
            className="md:hidden w-[28px] h-[28px] rounded-[6px] bg-[#3B6FF5] hover:bg-[#2E61E6] active:bg-[#2554D1] flex flex-col items-center justify-center gap-[3.5px] transition-colors cursor-pointer shadow-2xs"
            aria-label="Collapse Sidebar"
            title="Collapse Sidebar"
          >
            <span className="w-[14px] h-[1.75px] bg-[#FFFFFF] rounded-full block" />
            <span className="w-[14px] h-[1.75px] bg-[#FFFFFF] rounded-full block" />
            <span className="w-[14px] h-[1.75px] bg-[#FFFFFF] rounded-full block" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-2.5" aria-label="Module Navigation">
          {/* Primary Dropdown Button: CCR */}
          <button
            id="ccrToggleBtn"
            type="button"
            onClick={() => setIsCcrOpen((prev) => !prev)}
            aria-expanded={isCcrOpen}
            aria-controls="ccrSubmenu"
            className="w-full bg-[#0550D7] hover:bg-[#0447C0] active:bg-[#043FA9] text-[#FFFFFF] rounded-[8px] px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer shadow-xs"
          >
            <span className="flex items-center gap-2.5">
              {/* Group / Module Icon */}
              <svg
                className="w-[18px] h-[18px] text-[#FFFFFF] shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#FFFFFF]">
                CCR
              </span>
            </span>

            {/* Chevron Icon */}
            <ChevronDown
              size={15}
              className={`text-[#FFFFFF] transition-transform duration-200 ${
                isCcrOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>

          {/* Collapsible Submenu Container */}
          {isCcrOpen && (
            <div id="ccrSubmenu" className="pt-0.5">
              <div className="flex items-stretch">
                {/* Vertical Tree Connector Line */}
                <div className="ml-4 mr-3 w-[1.5px] bg-[#263B5E] rounded-full shrink-0" />

                {/* Submenu Links List */}
                <div className="flex-1 space-y-1.5">
                  <CcrNavLink
                    label={t("nav.salesOverview", "Sales Overview")}
                    href="/sales-overview"
                    onNavigate={closeMobileSidebar}
                  />
                  <CcrNavLink
                    label={t("nav.uploadedDocuments", "Uploaded Documents")}
                    href="/uploaded-documents"
                    onNavigate={closeMobileSidebar}
                  />
                  <CcrNavLink
                    label={t("nav.customerAnalytics", "Customer Analytics")}
                    href="/customer-analytics"
                    onNavigate={closeMobileSidebar}
                  />
                  <CcrNavLink
                    label={t("nav.overdueAlert", "Overdue Alert")}
                    href="/overdue-alert"
                    onNavigate={closeMobileSidebar}
                  />
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Bottom Section: Outlined Red Pill Logout Button */}
      <div className="pt-4 w-full min-w-[218px]">
        {signOutError && (
          <p role="alert" className="text-xs text-red-400 mb-2 px-1">
            {signOutError}
          </p>
        )}
        <button
          id="logoutBtn"
          type="button"
          data-account-role={account.role}
          onClick={() => {
            if (onSignOut) {
              onSignOut();
            } else {
              requestLogout();
            }
          }}
          disabled={isSigningOut || isInternalSigningOut}
          className="w-full py-2 rounded-full border-[1.5px] border-[#D92D43] bg-transparent hover:bg-[#D92D43]/10 active:bg-[#D92D43]/15 text-[#D92D43] font-bold text-[15px] tracking-wide flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          aria-label={t("nav.logout", "Logout")}
          title={t("nav.logout", "Logout")}
        >
          {t("nav.logout", "Logout")}
        </button>
      </div>
    </aside>
  );
}

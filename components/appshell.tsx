"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountProvider } from "@/components/account-provider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import Sidebar from "@/components/sidebar";

function AppShellInner({ children }: { children: ReactNode }) {
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();

  return (
    <div className="min-h-screen flex bg-white text-[#121B2E]">
      {/* Mobile Backdrop Overlay */}
      <div
        onClick={closeMobileSidebar}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-30 md:hidden transition-opacity ${
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Primary Left Sidebar */}
      <Sidebar />

      {/* Main Content Area with dynamic padding transition */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-white transition-all duration-250 ease-out ${
          isCollapsed ? "md:pl-0" : "md:pl-[250px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");

  if (isPublicRoute) {
    return (
      <AccountProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </AccountProvider>
    );
  }

  return (
    <AccountProvider>
      <LanguageProvider>
        <SidebarProvider>
          <AppShellInner>{children}</AppShellInner>
        </SidebarProvider>
      </LanguageProvider>
    </AccountProvider>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AccountProvider, useAccount } from "@/components/account-provider";
import { LanguageProvider, useLanguage } from "@/lib/i18n/LanguageContext";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import Sidebar from "@/components/sidebar";
import { ConfirmDeleteModal } from "@/components/AlertModal";

function AppShellInner({ children }: { children: ReactNode }) {
  const { isCollapsed, isMobileOpen, closeMobileSidebar, isLogoutConfirmOpen, closeLogoutConfirm } = useSidebar();
  const { clearAccount } = useAccount();
  const { t } = useLanguage();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed. Please try again.");
      clearAccount();
      closeLogoutConfirm();
      router.replace("/login");
      router.refresh();
    } catch {
      // Fallback
    } finally {
      setIsSigningOut(false);
    }
  }

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
        <ConfirmDeleteModal
          isOpen={isLogoutConfirmOpen}
          onClose={closeLogoutConfirm}
          onConfirm={() => void handleSignOut()}
          title={t("auth.confirmLogoutTitle", "Confirm Logout?")}
          message={t("auth.confirmLogoutMessage", "Are you sure you want to log out from Andima CCR?")}
          confirmText={t("common.yes", "Yes")}
          cancelText={t("common.no", "No")}
          loading={isSigningOut}
        />
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

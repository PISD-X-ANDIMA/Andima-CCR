"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountProvider } from "@/components/account-provider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import Sidebar from "@/components/sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");

  return (
    <AccountProvider>
      <LanguageProvider>
        {isPublicRoute ? (
          children
        ) : (
          <>
            <Sidebar />
            <div className="min-h-full lg:pl-[260px]">{children}</div>
          </>
        )}
      </LanguageProvider>
    </AccountProvider>
  );
}
